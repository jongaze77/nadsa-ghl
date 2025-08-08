import type { Contact } from '@prisma/client';
import { prisma } from './prisma';
import { fetchAllContactsFromGHL, mapGHLContactToPrisma } from './ghl-api';
import type { ParsedPaymentData } from './CsvParsingService';

export interface MatchSuggestion {
  contact: Contact;
  confidence: number;
  reasoning: {
    nameMatch?: {
      score: number;
      extractedName: string;
      matchedAgainst: string;
    };
    amountMatch?: {
      score: number;
      expectedRange: string;
      actualAmount: number;
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
  private readonly NAME_WEIGHT = 0.6;
  private readonly AMOUNT_WEIGHT = 0.4;

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
      const nameMatch = this.calculateNameMatch(paymentData.description || '', contact);
      const amountMatch = this.calculateAmountMatch(paymentData.amount, contact.membershipType);

      // Calculate combined confidence score
      const confidence = (nameMatch.score * this.NAME_WEIGHT) + (amountMatch.score * this.AMOUNT_WEIGHT);

      if (confidence > 0) {
        suggestions.push({
          contact,
          confidence,
          reasoning: {
            nameMatch,
            amountMatch
          }
        });
      }
    }

    return suggestions;
  }

  private calculateNameMatch(description: string, contact: Contact) {
    if (!description) {
      return { score: 0, extractedName: '', matchedAgainst: '' };
    }

    // Extract names from transaction description
    const extractedNames = this.extractNamesFromDescription(description);
    
    if (extractedNames.length === 0) {
      return { score: 0, extractedName: '', matchedAgainst: '' };
    }

    // Get contact names for matching
    const contactNames = this.getContactNames(contact);
    
    if (contactNames.length === 0) {
      return { score: 0, extractedName: '', matchedAgainst: '' };
    }

    let bestScore = 0;
    let bestExtracted = '';
    let bestMatched = '';

    // Compare each extracted name against each contact name
    for (const extractedName of extractedNames) {
      for (const contactName of contactNames) {
        const score = this.calculateLevenshteinSimilarity(extractedName, contactName);
        if (score > bestScore) {
          bestScore = score;
          bestExtracted = extractedName;
          bestMatched = contactName;
        }
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

  private getContactNames(contact: Contact): string[] {
    const names: string[] = [];

    // Full name
    if (contact.name) {
      names.push(contact.name.toUpperCase());
    }

    // First + Last name
    if (contact.firstName && contact.lastName) {
      names.push(`${contact.firstName} ${contact.lastName}`.toUpperCase());
      names.push(`${contact.lastName} ${contact.firstName}`.toUpperCase());
    }

    // Individual names
    if (contact.firstName) {
      names.push(contact.firstName.toUpperCase());
    }
    if (contact.lastName) {
      names.push(contact.lastName.toUpperCase());
    }

    // Handle initials
    if (contact.firstName && contact.lastName) {
      names.push(`${contact.firstName[0]} ${contact.lastName}`.toUpperCase());
      names.push(`${contact.firstName} ${contact.lastName[0]}`.toUpperCase());
    }

    return [...new Set(names)].filter(name => name.trim().length > 0);
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