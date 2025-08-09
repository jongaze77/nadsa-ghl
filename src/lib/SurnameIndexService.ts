import type { Contact } from '@prisma/client';

export interface SurnameMatch {
  normalizedSurname: string;
  originalSurnames: string[];
  contacts: Contact[];
}

export interface SurnameSearchResult {
  matches: SurnameMatch[];
  searchTerm: string;
  confidenceThreshold: number;
}

export interface ForenameVariation {
  full: string;
  abbreviations: string[];
}

export class SurnameIndexService {
  private surnameIndex: Map<string, SurnameMatch> = new Map();
  private forenameVariations: Map<string, ForenameVariation> = new Map();
  private initialized = false;
  private readonly FUZZY_THRESHOLD = 0.8;

  constructor() {
    this.initializeForenameVariations();
  }

  /**
   * Initialize the surname index from a list of contacts
   */
  public buildSurnameIndex(contacts: Contact[]): void {
    console.log(`Building surname index for ${contacts.length} contacts`);
    const startTime = Date.now();

    this.surnameIndex.clear();

    for (const contact of contacts) {
      const surnames = this.extractSurnamesFromContact(contact);
      
      for (const surname of surnames) {
        const normalized = this.normalizeSurname(surname);
        
        if (!this.surnameIndex.has(normalized)) {
          this.surnameIndex.set(normalized, {
            normalizedSurname: normalized,
            originalSurnames: [surname],
            contacts: [contact]
          });
        } else {
          const existing = this.surnameIndex.get(normalized)!;
          if (!existing.originalSurnames.includes(surname)) {
            existing.originalSurnames.push(surname);
          }
          if (!existing.contacts.some(c => c.id === contact.id)) {
            existing.contacts.push(contact);
          }
        }
      }
    }

    this.initialized = true;
    const buildTime = Date.now() - startTime;
    console.log(`Surname index built in ${buildTime}ms with ${this.surnameIndex.size} unique surnames`);
  }

  /**
   * Search for surnames in a payment description using fuzzy matching
   */
  public searchSurnamesInDescription(
    description: string, 
    confidenceThreshold: number = this.FUZZY_THRESHOLD
  ): SurnameSearchResult {
    if (!this.initialized) {
      throw new Error('Surname index not initialized. Call buildSurnameIndex() first.');
    }

    const matches: SurnameMatch[] = [];
    const cleanDescription = description.toUpperCase().trim();
    
    // Extract potential name words from description (2+ chars, alphabetic)
    const words = cleanDescription.match(/\b[A-Z]{2,}\b/g) || [];
    
    for (const word of words) {
      const normalizedWord = this.normalizeSurname(word);
      
      // First check for exact matches
      if (this.surnameIndex.has(normalizedWord)) {
        matches.push(this.surnameIndex.get(normalizedWord)!);
        continue;
      }
      
      // Then check for fuzzy matches
      for (const [indexedSurname, match] of this.surnameIndex) {
        const similarity = this.calculateLevenshteinSimilarity(normalizedWord, indexedSurname);
        if (similarity >= confidenceThreshold) {
          matches.push(match);
          break; // Take first fuzzy match to avoid duplicates
        }
      }
    }

    // Remove duplicates based on normalized surname
    const uniqueMatches = matches.filter((match, index, array) => 
      array.findIndex(m => m.normalizedSurname === match.normalizedSurname) === index
    );

    return {
      matches: uniqueMatches,
      searchTerm: description,
      confidenceThreshold
    };
  }

  /**
   * Enhance forename matching with abbreviation expansion
   */
  public enhanceForenameMatching(
    description: string, 
    surnameMatches: SurnameMatch[]
  ): Contact[] {
    const enhancedContacts: Contact[] = [];
    const cleanDescription = description.toUpperCase().trim();

    for (const surnameMatch of surnameMatches) {
      for (const contact of surnameMatch.contacts) {
        // Try to find forename matches near the surname
        const forenameScore = this.calculateForenameMatch(cleanDescription, contact);
        
        if (forenameScore > 0) {
          enhancedContacts.push(contact);
        }
      }
    }

    // If no forename enhancement, return all surname matches
    if (enhancedContacts.length === 0) {
      return surnameMatches.flatMap(match => match.contacts);
    }

    return enhancedContacts;
  }

  /**
   * Get surname index statistics
   */
  public getIndexStats(): {
    totalSurnames: number;
    totalContacts: number;
    averageContactsPerSurname: number;
    initialized: boolean;
  } {
    const totalContacts = Array.from(this.surnameIndex.values())
      .reduce((sum, match) => sum + match.contacts.length, 0);

    return {
      totalSurnames: this.surnameIndex.size,
      totalContacts,
      averageContactsPerSurname: this.surnameIndex.size > 0 ? totalContacts / this.surnameIndex.size : 0,
      initialized: this.initialized
    };
  }

  private extractSurnamesFromContact(contact: Contact): string[] {
    const surnames: string[] = [];

    // Extract from lastName field
    if (contact.lastName) {
      surnames.push(contact.lastName.trim());
    }

    // Extract from full name field
    if (contact.name) {
      const nameParts = contact.name.trim().split(/\s+/);
      if (nameParts.length > 1) {
        // Assume last part is surname
        surnames.push(nameParts[nameParts.length - 1]);
      }
    }

    return [...new Set(surnames)].filter(s => s.length > 1);
  }

  private normalizeSurname(surname: string): string {
    const normalized = surname.toUpperCase().trim();
    
    // Handle common surname variations
    const variations: Record<string, string> = {
      'MACDONALD': 'MCDONALD',
      'MCDONELL': 'MCDONNELL',
      'MCPHERSON': 'MACPHERSON',
      'OCONNOR': "O'CONNOR",
      'OBRIEN': "O'BRIEN",
      'OMALLEY': "O'MALLEY",
      'SMYTH': 'SMITH',
      'SMYTHE': 'SMITH',
      'CLARKE': 'CLARK',
      'GREY': 'GRAY'
    };

    return variations[normalized] || normalized;
  }

  private calculateForenameMatch(description: string, contact: Contact): number {
    if (!contact.firstName) return 0.5; // Partial score if no first name to compare

    const firstName = contact.firstName.toUpperCase().trim();
    const words = description.match(/\b[A-Z]+\b/g) || [];

    for (const word of words) {
      // Check for exact first name match
      if (word === firstName) {
        return 1.0;
      }

      // Check for abbreviation match
      if (word.length === 1 && word === firstName[0]) {
        return 0.8;
      }

      // Check for common abbreviation variations
      const forenameVariation = this.forenameVariations.get(firstName);
      if (forenameVariation && forenameVariation.abbreviations.includes(word)) {
        return 0.9;
      }

      // Fuzzy match for slight variations
      if (word.length > 2) {
        const similarity = this.calculateLevenshteinSimilarity(word, firstName);
        if (similarity >= 0.8) {
          return similarity * 0.7; // Slightly lower confidence for fuzzy matches
        }
      }
    }

    return 0;
  }

  private initializeForenameVariations(): void {
    const variations: [string, string[]][] = [
      ['ALEXANDER', ['ALEX', 'AL', 'SANDY']],
      ['ANTHONY', ['TONY', 'ANT']],
      ['BENJAMIN', ['BEN', 'BENNY']],
      ['CHRISTOPHER', ['CHRIS', 'KIT']],
      ['DANIEL', ['DAN', 'DANNY']],
      ['DAVID', ['DAVE', 'DAVY']],
      ['ELIZABETH', ['LIZ', 'BETH', 'BETTY', 'LIBBY']],
      ['FREDERICK', ['FRED', 'FREDDY']],
      ['GREGORY', ['GREG']],
      ['JAMES', ['JIM', 'JIMMY', 'JAMIE']],
      ['JENNIFER', ['JEN', 'JENNY']],
      ['JOHN', ['JACK', 'JOHNNY']],
      ['JONATHAN', ['JON', 'JONNY']],
      ['JOSEPH', ['JOE', 'JOEY']],
      ['KATHERINE', ['KATE', 'KATHY', 'KAT']],
      ['KENNETH', ['KEN', 'KENNY']],
      ['MARGARET', ['MEG', 'MAGGIE', 'PEGGY']],
      ['MATTHEW', ['MATT']],
      ['MICHAEL', ['MIKE', 'MICKY']],
      ['NICHOLAS', ['NICK', 'NICKY']],
      ['PATRICIA', ['PAT', 'PATTY']],
      ['RICHARD', ['RICK', 'DICK', 'RICKY']],
      ['ROBERT', ['BOB', 'BOBBY', 'ROB']],
      ['STEPHEN', ['STEVE', 'STEVIE']],
      ['THOMAS', ['TOM', 'TOMMY']],
      ['WILLIAM', ['BILL', 'BILLY', 'WILL', 'WILLY']]
    ];

    for (const [full, abbreviations] of variations) {
      this.forenameVariations.set(full, { full, abbreviations });
    }
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

  /**
   * Clear the surname index
   */
  public clearIndex(): void {
    this.surnameIndex.clear();
    this.initialized = false;
  }

  /**
   * Check if the index is initialized
   */
  public isInitialized(): boolean {
    return this.initialized;
  }
}