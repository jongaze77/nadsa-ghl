import type { Contact } from '@prisma/client';
import { prisma } from './prisma';
import { fetchAllContactsFromGHL, mapGHLContactToPrisma } from './ghl-api';
import type { ParsedPaymentData } from './CsvParsingService';

export interface MatchSuggestion {
  contact: Contact;
  contactId: string; // Add contactId field for frontend compatibility
  confidence: number;
  reasoning: {
    nameMatch?: {
      score: number;
      extractedName: string;
      matchedAgainst: string;
    };
    emailMatch?: {
      score: number;
      providedEmail: string;
      contactEmail: string;
    };
    amountMatch?: {
      score: number;
      expectedRange: string;
      actualAmount: number;
    };
    postcodeMatch?: {
      score: number;
      providedPostcode: string;
      contactPostcode: string;
    };
  };
}

export interface MatchingResult {
  suggestions: MatchSuggestion[];
  totalMatches: number;
  processingTimeMs: number;
}

interface MembershipFeeRange {
  min: number;
  max: number;
  exact?: number;
}

export class MatchingService {
  private contactsCache: Contact[] = [];
  private cacheExpiry: number = 0;
  private readonly CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes
  private readonly MIN_CONFIDENCE_THRESHOLD = 0.3;
  private readonly MAX_SUGGESTIONS = 5;
  private readonly NAME_WEIGHT = 0.35;
  private readonly EMAIL_WEIGHT = 0.25;
  private readonly POSTCODE_WEIGHT = 0.25;
  private readonly AMOUNT_WEIGHT = 0.15;

  private readonly membershipFees: Record<string, MembershipFeeRange> = {
    'Full': { min: 60, max: 80 },
    'Associate': { min: 40, max: 60 },
    'Newsletter Only': { min: 10, max: 20 }
  };

  constructor() {}

  async findMatches(paymentData: ParsedPaymentData): Promise<MatchingResult> {
    const startTime = Date.now();

    try {
      // Load and filter contacts
      const availableContacts = await this.getAvailableContacts();
      
      if (availableContacts.length === 0) {
        return {
          suggestions: [],
          totalMatches: 0,
          processingTimeMs: Date.now() - startTime
        };
      }

      // Generate match suggestions
      const suggestions = await this.generateMatchSuggestions(paymentData, availableContacts);

      // Filter by confidence threshold and limit results
      const filteredSuggestions = suggestions
        .filter(s => s.confidence >= this.MIN_CONFIDENCE_THRESHOLD)
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, this.MAX_SUGGESTIONS);

      return {
        suggestions: filteredSuggestions,
        totalMatches: suggestions.length,
        processingTimeMs: Date.now() - startTime
      };

    } catch (error) {
      console.error('Error in findMatches:', error);
      return {
        suggestions: [],
        totalMatches: 0,
        processingTimeMs: Date.now() - startTime
      };
    }
  }

  async findBatchMatches(paymentDataArray: ParsedPaymentData[]): Promise<Map<string, MatchingResult>> {
    const results = new Map<string, MatchingResult>();
    
    // Ensure contacts are cached for batch processing
    await this.getAvailableContacts();

    for (const paymentData of paymentDataArray) {
      const result = await this.findMatches(paymentData);
      results.set(paymentData.transactionFingerprint, result);
    }

    return results;
  }

  private async getAvailableContacts(): Promise<Contact[]> {
    // Check cache validity
    if (this.contactsCache.length > 0 && Date.now() < this.cacheExpiry) {
      return await this.filterReconciledContacts(this.contactsCache);
    }

    try {
      // Fetch contacts from GHL
      const ghlResponse = await fetchAllContactsFromGHL(1, 1000);
      const ghlContacts = ghlResponse.contacts || [];

      // Map to Prisma format
      this.contactsCache = ghlContacts.map(mapGHLContactToPrisma).filter((contact: any) => contact.id);
      this.cacheExpiry = Date.now() + this.CACHE_DURATION_MS;

      return await this.filterReconciledContacts(this.contactsCache);

    } catch (error) {
      console.error('Error fetching contacts:', error);
      // Fall back to database contacts if GHL fails
      const dbContacts = await prisma.contact.findMany();
      return await this.filterReconciledContacts(dbContacts);
    }
  }

  private async filterReconciledContacts(contacts: Contact[]): Promise<Contact[]> {
    // Get contacts with recent reconciliation records (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const reconciledContactIds = await prisma.reconciliationLog.findMany({
      where: {
        reconciledAt: {
          gte: thirtyDaysAgo
        }
      },
      select: {
        contactId: true
      }
    });

    const reconciledIds = new Set(reconciledContactIds.map(r => r.contactId));

    return contacts.filter(contact => !reconciledIds.has(contact.id));
  }

  private async generateMatchSuggestions(
    paymentData: ParsedPaymentData, 
    contacts: Contact[]
  ): Promise<MatchSuggestion[]> {
    const suggestions: MatchSuggestion[] = [];

    for (const contact of contacts) {
      const nameMatch = this.calculateNameMatch(paymentData, contact);
      const amountMatch = this.calculateAmountMatch(paymentData.amount, contact.membershipType);
      const emailMatch = this.calculateEmailMatch(paymentData, contact);
      const postcodeMatch = this.calculatePostcodeMatch(paymentData, contact);

      // Calculate combined confidence score including postcode matching
      const confidence = (nameMatch.score * this.NAME_WEIGHT) + 
                        (emailMatch.score * this.EMAIL_WEIGHT) + 
                        (postcodeMatch.score * this.POSTCODE_WEIGHT) +
                        (amountMatch.score * this.AMOUNT_WEIGHT);

      if (confidence > 0) {
        suggestions.push({
          contact,
          contactId: contact.id, // Add contactId for frontend compatibility
          confidence,
          reasoning: {
            nameMatch,
            emailMatch: emailMatch.score > 0 ? emailMatch : undefined,
            postcodeMatch: postcodeMatch.score > 0 ? postcodeMatch : undefined,
            amountMatch
          }
        });
      }
    }

    return suggestions;
  }

  private calculateNameMatch(paymentData: ParsedPaymentData, contact: Contact) {
    let bestScore = 0;
    let bestExtracted = '';
    let bestMatched = '';
    
    // First, try to match using customer_name from Stripe data (highest priority)
    if (paymentData.customer_name) {
      const customerNameScore = this.matchSingleName(paymentData.customer_name, contact);
      if (customerNameScore.score > bestScore) {
        bestScore = customerNameScore.score;
        bestExtracted = paymentData.customer_name;
        bestMatched = customerNameScore.matchedAgainst;
      }
    }
    
    // Fall back to extracting names from description if no customer_name or low score
    if (bestScore < 0.8 && paymentData.description) {
      const descriptionMatch = this.matchFromDescription(paymentData.description, contact);
      if (descriptionMatch.score > bestScore) {
        bestScore = descriptionMatch.score;
        bestExtracted = descriptionMatch.extractedName;
        bestMatched = descriptionMatch.matchedAgainst;
      }
    }
    
    return {
      score: bestScore,
      extractedName: bestExtracted,
      matchedAgainst: bestMatched
    };
  }
  
  private matchSingleName(providedName: string, contact: Contact) {
    const cleanProvidedName = providedName.toUpperCase().trim();
    
    // Extract surname (last word or hyphenated word) from provided name
    const nameWords = cleanProvidedName.split(/\s+/);
    const providedSurname = nameWords[nameWords.length - 1];
    
    // Check for hyphenated surnames
    const hyphenatedParts = providedSurname.split('-');
    const possibleSurnames = [providedSurname, ...hyphenatedParts];
    
    // Check if contact's surname matches any of the possible surnames
    const contactSurname = contact.lastName?.toUpperCase().trim();
    if (!contactSurname) {
      return { score: 0, matchedAgainst: '' };
    }
    
    let surnameMatch = false;
    for (const surname of possibleSurnames) {
      if (contactSurname === surname) {
        surnameMatch = true;
        break;
      }
    }
    
    if (!surnameMatch) {
      // No surname match, very low score
      return { score: 0.1, matchedAgainst: contactSurname };
    }
    
    // Surname matches, now check forename
    const providedForename = nameWords.slice(0, -1).join(' ');
    const contactForename = contact.firstName?.toUpperCase().trim();
    
    if (!contactForename || !providedForename) {
      // Surname match only
      return { score: 0.6, matchedAgainst: `${contactForename || ''} ${contactSurname}`.trim() };
    }
    
    // Check for exact forename match
    if (providedForename === contactForename) {
      return { score: 1.0, matchedAgainst: `${contactForename} ${contactSurname}` };
    }
    
    // Check if contact forename could be a reasonable abbreviation of provided forename
    if (this.isReasonableAbbreviation(providedForename, contactForename)) {
      return { score: 0.9, matchedAgainst: `${contactForename} ${contactSurname}` };
    }
    
    // Check if provided forename could be a reasonable abbreviation of contact forename
    if (this.isReasonableAbbreviation(contactForename, providedForename)) {
      return { score: 0.9, matchedAgainst: `${contactForename} ${contactSurname}` };
    }
    
    // Check for similar forenames using Levenshtein
    const forenameScore = this.calculateLevenshteinSimilarity(providedForename, contactForename);
    if (forenameScore > 0.7) {
      return { score: forenameScore * 0.8, matchedAgainst: `${contactForename} ${contactSurname}` };
    }
    
    // Surname match but different forename
    return { score: 0.3, matchedAgainst: `${contactForename} ${contactSurname}` };
  }
  
  private isReasonableAbbreviation(fullName: string, abbreviation: string): boolean {
    // Check if abbreviation is reasonable for the full name
    if (abbreviation.length > fullName.length) return false;
    
    // Single letter abbreviation
    if (abbreviation.length === 1) {
      return fullName.startsWith(abbreviation);
    }
    
    // Multi-letter abbreviation - should be prefix of full name
    if (abbreviation.length <= 5 && fullName.startsWith(abbreviation)) {
      return true;
    }
    
    // For longer abbreviations, use more lenient matching
    if (abbreviation.length > 5) {
      return fullName.startsWith(abbreviation) && abbreviation.length >= fullName.length * 0.5;
    }
    
    return false;
  }
  
  private matchFromDescription(description: string, contact: Contact) {
    if (!description) {
      return { score: 0, extractedName: '', matchedAgainst: '' };
    }

    // Extract names from transaction description
    const extractedNames = this.extractNamesFromDescription(description);
    
    if (extractedNames.length === 0) {
      return { score: 0, extractedName: '', matchedAgainst: '' };
    }

    let bestScore = 0;
    let bestExtracted = '';
    let bestMatched = '';

    // Test each extracted name using the same surname-first logic
    for (const extractedName of extractedNames) {
      const nameResult = this.matchSingleName(extractedName, contact);
      if (nameResult.score > bestScore) {
        bestScore = nameResult.score;
        bestExtracted = extractedName;
        bestMatched = nameResult.matchedAgainst;
      }
    }

    return {
      score: bestScore,
      extractedName: bestExtracted,
      matchedAgainst: bestMatched
    };
  }

  private extractNamesFromDescription(description: string): string[] {
    const names: string[] = [];
    const cleanDesc = description.toUpperCase().trim();

    // Common patterns for membership payments
    const patterns = [
      /MEMBERSHIP\s*-\s*([A-Z\s]+?)(?:\s*$)/,
      /RENEWAL\s*-?\s*([A-Z\s]+?)(?:\s*$)/,
      /PAYMENT\s*-?\s*([A-Z\s]+?)(?:\s*$)/,
      /([A-Z]+\s+[A-Z]+)\s+MEMBERSHIP/,
      /([A-Z]+\s+[A-Z]+)\s+PAYMENT/,
      /([A-Z]{2,}\s+[A-Z]{2,})/
    ];

    for (const pattern of patterns) {
      const match = cleanDesc.match(pattern);
      if (match) {
        let nameMatch = match[1] || match[0];
        nameMatch = nameMatch.trim().replace(/\s+/g, ' ');
        
        // Filter out common non-name words
        const filtered = nameMatch.split(' ')
          .filter(word => !['MEMBERSHIP', 'PAYMENT', 'RENEWAL', 'FEE', 'ANNUAL', 'TRANSFER', 'BANK'].includes(word))
          .join(' ');

        if (filtered.length >= 2 && filtered.split(' ').length >= 2 && filtered.split(' ').length <= 4) {
          names.push(filtered);
        }
      }
    }

    // Deduplicate
    return [...new Set(names)];
  }

  private calculateEmailMatch(paymentData: ParsedPaymentData, contact: Contact) {
    // If no customer email provided, return 0 score
    if (!paymentData.customer_email) {
      return { score: 0, providedEmail: '', contactEmail: '' };
    }
    
    // If contact has no email, return 0 score
    if (!contact.email) {
      return { score: 0, providedEmail: paymentData.customer_email, contactEmail: '' };
    }
    
    const providedEmail = paymentData.customer_email.toLowerCase().trim();
    const contactEmail = contact.email.toLowerCase().trim();
    
    // Exact match gets full score
    if (providedEmail === contactEmail) {
      return { score: 1.0, providedEmail: paymentData.customer_email, contactEmail: contact.email };
    }
    
    // Check domain match (less reliable but still useful)
    const providedDomain = providedEmail.split('@')[1];
    const contactDomain = contactEmail.split('@')[1];
    
    if (providedDomain && contactDomain && providedDomain === contactDomain) {
      // Same domain gets partial score
      const usernameScore = this.calculateLevenshteinSimilarity(
        providedEmail.split('@')[0],
        contactEmail.split('@')[0]
      );
      return { 
        score: Math.min(0.7, usernameScore * 0.7), 
        providedEmail: paymentData.customer_email, 
        contactEmail: contact.email 
      };
    }
    
    return { score: 0, providedEmail: paymentData.customer_email, contactEmail: contact.email };
  }

  private calculatePostcodeMatch(paymentData: ParsedPaymentData, contact: Contact) {
    // Check if we have postcode data from payment (Stripe billing address or other source)
    const providedPostcode = paymentData.card_address_postal_code || null;
    
    if (!providedPostcode) {
      return { score: 0, providedPostcode: '', contactPostcode: contact.postalCode || '' };
    }
    
    // Check if contact has postcode
    if (!contact.postalCode) {
      return { score: 0, providedPostcode, contactPostcode: '' };
    }
    
    const normalizedProvided = this.normalizePostcode(providedPostcode);
    const normalizedContact = this.normalizePostcode(contact.postalCode);
    
    // Exact match gets full score
    if (normalizedProvided === normalizedContact) {
      return { score: 1.0, providedPostcode, contactPostcode: contact.postalCode };
    }
    
    // UK postcodes: check if the outward code matches (e.g., "TQ12" from "TQ12 3LY")
    const providedOutward = normalizedProvided.split(' ')[0];
    const contactOutward = normalizedContact.split(' ')[0];
    
    if (providedOutward && contactOutward && providedOutward === contactOutward) {
      return { score: 0.8, providedPostcode, contactPostcode: contact.postalCode };
    }
    
    // Check if the district matches (e.g., "TQ" from "TQ12")
    const providedDistrict = providedOutward?.substring(0, providedOutward.length - 1);
    const contactDistrict = contactOutward?.substring(0, contactOutward.length - 1);
    
    if (providedDistrict && contactDistrict && providedDistrict === contactDistrict && providedDistrict.length >= 2) {
      return { score: 0.5, providedPostcode, contactPostcode: contact.postalCode };
    }
    
    // Check if the area matches (first letter(s), e.g., "TQ" from "TQ12")
    const providedArea = providedOutward?.substring(0, 2);
    const contactArea = contactOutward?.substring(0, 2);
    
    if (providedArea && contactArea && providedArea === contactArea) {
      return { score: 0.3, providedPostcode, contactPostcode: contact.postalCode };
    }
    
    return { score: 0, providedPostcode, contactPostcode: contact.postalCode };
  }

  private normalizePostcode(postcode: string): string {
    return postcode.toUpperCase().replace(/\s+/g, ' ').trim();
  }

  private calculateLevenshteinSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1.0;
    
    const distance = this.levenshteinDistance(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);
    
    if (maxLength === 0) return 1.0;
    
    return 1 - (distance / maxLength);
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  private calculateAmountMatch(paymentAmount: number, membershipType: string | null) {
    if (!membershipType || !this.membershipFees[membershipType]) {
      // No membership type or unknown type - use generic scoring
      return {
        score: this.getGenericAmountScore(paymentAmount),
        expectedRange: 'Unknown membership type',
        actualAmount: paymentAmount
      };
    }

    const feeRange = this.membershipFees[membershipType];
    let score = 0;

    if (feeRange.exact && paymentAmount === feeRange.exact) {
      score = 1.0; // Perfect match
    } else if (paymentAmount >= feeRange.min && paymentAmount <= feeRange.max) {
      // Within range - score based on how close to midpoint
      const midpoint = (feeRange.min + feeRange.max) / 2;
      const distance = Math.abs(paymentAmount - midpoint);
      const maxDistance = (feeRange.max - feeRange.min) / 2;
      score = 1 - (distance / maxDistance);
      score = Math.max(0.7, score); // Minimum score for within-range amounts
    } else {
      // Outside range - score based on proximity
      const closestBoundary = paymentAmount < feeRange.min ? feeRange.min : feeRange.max;
      const distance = Math.abs(paymentAmount - closestBoundary);
      const tolerance = (feeRange.max - feeRange.min) * 0.5; // 50% of range as tolerance
      
      if (distance <= tolerance) {
        score = Math.max(0.3, 1 - (distance / tolerance));
      }
    }

    return {
      score: Math.max(0, Math.min(1, score)),
      expectedRange: `£${feeRange.min}-${feeRange.max}`,
      actualAmount: paymentAmount
    };
  }

  private getGenericAmountScore(amount: number): number {
    // Generic scoring for unknown membership types
    // Favor common membership amounts
    const commonAmounts = [15, 20, 30, 40, 50, 60, 70, 80, 100];
    
    for (const commonAmount of commonAmounts) {
      if (Math.abs(amount - commonAmount) <= 5) {
        return 0.4; // Moderate confidence for common amounts
      }
    }

    // Lower confidence for unusual amounts
    if (amount >= 10 && amount <= 100) {
      return 0.2;
    }

    return 0; // Zero confidence for extreme amounts to prevent false matches
  }

  async refreshContactsCache(): Promise<void> {
    this.contactsCache = [];
    this.cacheExpiry = 0;
    await this.getAvailableContacts();
  }

  getCacheInfo(): { cached: number; expiresIn: number } {
    return {
      cached: this.contactsCache.length,
      expiresIn: Math.max(0, this.cacheExpiry - Date.now())
    };
  }
}