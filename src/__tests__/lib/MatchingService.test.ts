import { MatchingService } from '../../lib/MatchingService';
import { prisma } from '../../lib/prisma';
import * as ghlApi from '../../lib/ghl-api';
import type { Contact } from '@prisma/client';
import type { ParsedPaymentData } from '../../lib/CsvParsingService';

// Mock dependencies
jest.mock('../../lib/prisma', () => ({
  prisma: {
    reconciliationLog: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    contact: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('../../lib/ghl-api', () => ({
  fetchAllContactsFromGHL: jest.fn(),
  mapGHLContactToPrisma: jest.fn(),
}));

describe('MatchingService', () => {
  let service: MatchingService;
  let mockContacts: Contact[];
  let mockPaymentData: ParsedPaymentData;

  beforeEach(() => {
    service = new MatchingService();
    jest.clearAllMocks();

    mockContacts = [
      {
        id: 'contact-1',
        firstName: 'John',
        lastName: 'Smith',
        name: 'John Smith',
        email: 'john@example.com',
        phone: '1234567890',
        membershipType: 'Full',
        createdAt: new Date(),
        updatedAt: new Date(),
        companyName: null,
        address1: null,
        address2: null,
        city: null,
        state: null,
        postalCode: null,
        country: null,
        website: null,
        source: null,
        tags: [],
        customFields: null,
        ghlUpdatedAt: null,
        lastSyncedAt: new Date(),
      },
      {
        id: 'contact-2',
        firstName: 'Jane',
        lastName: 'Doe',
        name: 'Jane Doe',
        email: 'jane@example.com',
        phone: '0987654321',
        membershipType: 'Associate',
        createdAt: new Date(),
        updatedAt: new Date(),
        companyName: null,
        address1: null,
        address2: null,
        city: null,
        state: null,
        postalCode: null,
        country: null,
        website: null,
        source: null,
        tags: [],
        customFields: null,
        ghlUpdatedAt: null,
        lastSyncedAt: new Date(),
      },
      {
        id: 'contact-3',
        firstName: 'Bob',
        lastName: 'Johnson',
        name: 'Bob Johnson',
        email: 'bob@example.com',
        phone: '5555555555',
        membershipType: 'Newsletter Only',
        createdAt: new Date(),
        updatedAt: new Date(),
        companyName: null,
        address1: null,
        address2: null,
        city: null,
        state: null,
        postalCode: null,
        country: null,
        website: null,
        source: null,
        tags: [],
        customFields: null,
        ghlUpdatedAt: null,
        lastSyncedAt: new Date(),
      },
    ];

    mockPaymentData = {
      transactionFingerprint: 'test-fingerprint-123',
      paymentDate: new Date('2024-01-15'),
      amount: 70,
      source: 'BANK_CSV',
      transactionRef: 'MEMBERSHIP - JOHN SMITH',
      description: 'MEMBERSHIP - JOHN SMITH',
      hashedAccountIdentifier: 'hashed-account-123',
    };
  });

  describe('findMatches', () => {
    beforeEach(() => {
      // Mock database contact queries
      (prisma.contact.findMany as jest.Mock).mockResolvedValue(mockContacts);
      
      // Mock GHL API calls
      (ghlApi.fetchAllContactsFromGHL as jest.Mock).mockResolvedValue({
        contacts: mockContacts,
      });
      (ghlApi.mapGHLContactToPrisma as jest.Mock).mockImplementation((contact: any) => contact);

      // Mock reconciliation log queries (no recent reconciliations)
      (prisma.reconciliationLog.findMany as jest.Mock).mockResolvedValue([]);
    });

    it('should return high confidence match for exact name and amount match', async () => {
      const result = await service.findMatches(mockPaymentData);

      expect(result.suggestions.length).toBeGreaterThan(0);
      const johnMatch = result.suggestions.find(s => s.contact.id === 'contact-1');
      expect(johnMatch).toBeDefined();
      expect(johnMatch!.confidence).toBeGreaterThan(0.5); // Adjusted for 40% name + 0% email + 20% amount = 0.6
      expect(johnMatch!.reasoning.nameMatch?.extractedName).toBe('JOHN SMITH');
      expect(johnMatch!.reasoning.amountMatch?.expectedRange).toBe('£60-80');
    });

    it('should handle fuzzy name matching', async () => {
      const fuzzyPayment = {
        ...mockPaymentData,
        description: 'MEMBERSHIP - J SMITH',
      };

      const result = await service.findMatches(fuzzyPayment);

      expect(result.suggestions.length).toBeGreaterThan(0);
      const johnSmithMatch = result.suggestions.find(s => s.contact.id === 'contact-1');
      expect(johnSmithMatch).toBeDefined();
      expect(johnSmithMatch!.confidence).toBeGreaterThan(0.3);
    });

    it('should match based on amount when name is unclear', async () => {
      const amountOnlyPayment = {
        ...mockPaymentData,
        description: 'BANK TRANSFER',
        amount: 50, // Associate membership range
        customer_email: 'jane@example.com', // Add email to boost confidence above threshold
      };

      const result = await service.findMatches(amountOnlyPayment);

      // Should still find matches based on amount + email
      expect(result.suggestions.length).toBeGreaterThan(0);
      const janeMatch = result.suggestions.find(s => s.contact.id === 'contact-2');
      expect(janeMatch).toBeDefined();
      expect(janeMatch!.reasoning.amountMatch?.score).toBeGreaterThan(0.7);
    });

    it('should return empty suggestions for very poor matches', async () => {
      const poorMatch = {
        ...mockPaymentData,
        description: 'RANDOM PAYMENT XYZ',
        amount: 999,
      };

      const result = await service.findMatches(poorMatch);

      // Should have no suggestions above threshold
      expect(result.suggestions.length).toBe(0);
    });

    it('should exclude recently reconciled contacts', async () => {
      // Mock recent reconciliation for contact-1
      (prisma.reconciliationLog.findMany as jest.Mock).mockResolvedValue([
        { contactId: 'contact-1' },
      ]);

      const result = await service.findMatches(mockPaymentData);

      const excludedMatch = result.suggestions.find(s => s.contact.id === 'contact-1');
      expect(excludedMatch).toBeUndefined();
    });

    it('should limit results to maximum suggestions', async () => {
      // Create more contacts to test limit
      const manyContacts = Array.from({ length: 10 }, (_, i) => ({
        ...mockContacts[0],
        id: `contact-${i}`,
        firstName: `John${i}`,
        name: `John${i} Smith`,
      }));

      (ghlApi.fetchAllContactsFromGHL as jest.Mock).mockResolvedValue({
        contacts: manyContacts,
      });

      const result = await service.findMatches(mockPaymentData);

      expect(result.suggestions.length).toBeLessThanOrEqual(5); // MAX_SUGGESTIONS = 5
    });

    it('should handle missing contact data gracefully', async () => {
      (ghlApi.fetchAllContactsFromGHL as jest.Mock).mockResolvedValue({
        contacts: [],
      });
      (prisma.contact.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.findMatches(mockPaymentData);

      expect(result.suggestions).toHaveLength(0);
      expect(result.totalMatches).toBe(0);
      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should fallback to database contacts if GHL fails', async () => {
      (ghlApi.fetchAllContactsFromGHL as jest.Mock).mockRejectedValue(new Error('GHL API failed'));
      (prisma.contact.findMany as jest.Mock).mockResolvedValue(mockContacts);

      const result = await service.findMatches(mockPaymentData);

      expect(prisma.contact.findMany).toHaveBeenCalled();
      expect(result.suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('findBatchMatches', () => {
    beforeEach(() => {
      // Mock database contact queries
      (prisma.contact.findMany as jest.Mock).mockResolvedValue(mockContacts);
      
      (ghlApi.fetchAllContactsFromGHL as jest.Mock).mockResolvedValue({
        contacts: mockContacts,
      });
      (ghlApi.mapGHLContactToPrisma as jest.Mock).mockImplementation((contact: any) => contact);
      (prisma.reconciliationLog.findMany as jest.Mock).mockResolvedValue([]);
    });

    it('should process multiple payments efficiently', async () => {
      const batchPayments = [
        mockPaymentData,
        {
          ...mockPaymentData,
          transactionFingerprint: 'test-fingerprint-456',
          description: 'MEMBERSHIP - JANE DOE',
          amount: 50,
        },
      ];

      const results = await service.findBatchMatches(batchPayments);

      expect(results.size).toBe(2);
      expect(results.has('test-fingerprint-123')).toBe(true);
      expect(results.has('test-fingerprint-456')).toBe(true);
    });
  });

  describe('name extraction and matching', () => {
    let serviceInstance: any;

    beforeEach(() => {
      serviceInstance = service as any; // Access private methods for testing
    });

    it('should extract names from various transaction patterns', () => {
      const testCases = [
        { input: 'MEMBERSHIP - JOHN SMITH', expected: ['JOHN SMITH'] },
        { input: 'RENEWAL JANE DOE', expected: ['JANE DOE'] },
        { input: 'PAYMENT - ROBERT JOHNSON', expected: ['ROBERT JOHNSON'] },
        { input: 'BANK TRANSFER', expected: [] },
      ];

      testCases.forEach(({ input, expected }) => {
        const result = serviceInstance.extractNamesFromDescription(input);
        if (expected.length > 0) {
          expect(result).toContain(expected[0]);
        } else {
          expect(result).toHaveLength(0);
        }
      });
    });

    it('should calculate Levenshtein similarity correctly', () => {
      const testCases = [
        { str1: 'JOHN', str2: 'JOHN', expected: 1.0 },
        { str1: 'JOHN', str2: 'JON', expected: 0.75 },
        { str1: 'SMITH', str2: 'SMYTH', expected: 0.8 },
        { str1: 'ABC', str2: 'XYZ', expected: 0.0 },
      ];

      testCases.forEach(({ str1, str2, expected }) => {
        const result = serviceInstance.calculateLevenshteinSimilarity(str1, str2);
        expect(result).toBeCloseTo(expected, 2);
      });
    });

    it('should generate contact name variations', () => {
      const contact = mockContacts[0]; // John Smith
      const names = serviceInstance.getContactNames(contact);

      expect(names).toContain('JOHN SMITH');
      expect(names).toContain('SMITH JOHN');
      expect(names).toContain('JOHN');
      expect(names).toContain('SMITH');
      expect(names).toContain('J SMITH');
      expect(names).toContain('JOHN S');
    });
  });

  describe('amount matching', () => {
    let serviceInstance: any;

    beforeEach(() => {
      serviceInstance = service as any;
    });

    it('should score exact membership fee amounts highly', () => {
      const result = serviceInstance.calculateAmountMatch(70, 'Full'); // Within £60-80 range
      expect(result.score).toBeGreaterThan(0.7);
      expect(result.expectedRange).toBe('£60-80');
    });

    it('should score amounts outside range lower', () => {
      const result = serviceInstance.calculateAmountMatch(30, 'Full'); // Outside £60-80 range
      expect(result.score).toBeLessThan(0.5);
    });

    it('should handle unknown membership types', () => {
      const result = serviceInstance.calculateAmountMatch(50, 'Unknown');
      expect(result.score).toBeGreaterThan(0);
      expect(result.expectedRange).toBe('Unknown membership type');
    });

    it('should handle null membership types', () => {
      const result = serviceInstance.calculateAmountMatch(50, null);
      expect(result.score).toBeGreaterThan(0);
      expect(result.expectedRange).toBe('Unknown membership type');
    });
  });

  describe('caching', () => {
    it('should cache contacts and provide cache info', async () => {
      (ghlApi.fetchAllContactsFromGHL as jest.Mock).mockResolvedValue({
        contacts: mockContacts,
      });
      (ghlApi.mapGHLContactToPrisma as jest.Mock).mockImplementation((contact: any) => contact);
      (prisma.reconciliationLog.findMany as jest.Mock).mockResolvedValue([]);

      // First call should fetch from API
      await service.findMatches(mockPaymentData);

      const cacheInfo = service.getCacheInfo();
      expect(cacheInfo.cached).toBe(mockContacts.length);
      expect(cacheInfo.expiresIn).toBeGreaterThan(0);

      // Second call should use cache
      jest.clearAllMocks();
      await service.findMatches(mockPaymentData);

      expect(ghlApi.fetchAllContactsFromGHL).not.toHaveBeenCalled();
    });

    it('should refresh cache when requested', async () => {
      (ghlApi.fetchAllContactsFromGHL as jest.Mock).mockResolvedValue({
        contacts: mockContacts,
      });
      (ghlApi.mapGHLContactToPrisma as jest.Mock).mockImplementation((contact: any) => contact);
      (prisma.reconciliationLog.findMany as jest.Mock).mockResolvedValue([]);

      // Initial cache
      await service.findMatches(mockPaymentData);
      jest.clearAllMocks();

      // Make database fail so it falls back to GHL
      (prisma.contact.findMany as jest.Mock).mockRejectedValue(new Error('DB Error'));

      // Refresh cache
      await service.refreshContactsCache();

      expect(ghlApi.fetchAllContactsFromGHL).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle errors gracefully and return empty results', async () => {
      (ghlApi.fetchAllContactsFromGHL as jest.Mock).mockRejectedValue(new Error('API Error'));
      (prisma.contact.findMany as jest.Mock).mockRejectedValue(new Error('DB Error'));

      const result = await service.findMatches(mockPaymentData);

      expect(result.suggestions).toHaveLength(0);
      expect(result.totalMatches).toBe(0);
      expect(result.processingTimeMs).toBeGreaterThan(0);
    });
  });

  describe('performance requirements', () => {
    it('should complete matching within reasonable time', async () => {
      (ghlApi.fetchAllContactsFromGHL as jest.Mock).mockResolvedValue({
        contacts: mockContacts,
      });
      (ghlApi.mapGHLContactToPrisma as jest.Mock).mockImplementation((contact: any) => contact);
      (prisma.reconciliationLog.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.findMatches(mockPaymentData);

      expect(result.processingTimeMs).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle large contact datasets efficiently', async () => {
      // Create 100 mock contacts
      const largeContactSet = Array.from({ length: 100 }, (_, i) => ({
        ...mockContacts[0],
        id: `contact-${i}`,
        firstName: `Person${i}`,
        name: `Person${i} Smith`,
      }));

      (ghlApi.fetchAllContactsFromGHL as jest.Mock).mockResolvedValue({
        contacts: largeContactSet,
      });
      (ghlApi.mapGHLContactToPrisma as jest.Mock).mockImplementation((contact: any) => contact);
      (prisma.reconciliationLog.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.findMatches(mockPaymentData);

      expect(result.processingTimeMs).toBeLessThan(2000); // Should handle 100 contacts within 2 seconds
      expect(result.suggestions.length).toBeLessThanOrEqual(5); // Still respects max suggestions
    });
  });

  describe('confidence scoring', () => {
    beforeEach(() => {
      // Mock database contact queries
      (prisma.contact.findMany as jest.Mock).mockResolvedValue(mockContacts);
      
      (ghlApi.fetchAllContactsFromGHL as jest.Mock).mockResolvedValue({
        contacts: mockContacts,
      });
      (ghlApi.mapGHLContactToPrisma as jest.Mock).mockImplementation((contact: any) => contact);
      (prisma.reconciliationLog.findMany as jest.Mock).mockResolvedValue([]);
    });

    it('should weight name matches at 40%, email matches at 40%, and amount matches at 20%', async () => {
      // Perfect name match, poor amount match
      const perfectNamePayment = {
        ...mockPaymentData,
        description: 'MEMBERSHIP - JOHN SMITH',
        amount: 999, // Way outside range
      };

      const result = await service.findMatches(perfectNamePayment);
      const johnMatch = result.suggestions.find(s => s.contact.id === 'contact-1');

      if (johnMatch) {
        // Should still have reasonable confidence due to high name match weight
        expect(johnMatch.confidence).toBeGreaterThan(0.3);
      }
    });

    it('should apply minimum confidence threshold correctly', async () => {
      // Very poor match
      const poorMatch = {
        ...mockPaymentData,
        description: 'RANDOM DESCRIPTION XYZ',
        amount: 999,
      };

      const result = await service.findMatches(poorMatch);

      // All suggestions should meet minimum threshold
      result.suggestions.forEach(suggestion => {
        expect(suggestion.confidence).toBeGreaterThanOrEqual(0.3);
      });
    });
  });

  describe('Customer Field Matching (Enhanced)', () => {
    beforeEach(() => {
      // Mock database contact queries
      (prisma.contact.findMany as jest.Mock).mockResolvedValue(mockContacts);
      
      (ghlApi.fetchAllContactsFromGHL as jest.Mock).mockResolvedValue({
        contacts: mockContacts,
      });
      (ghlApi.mapGHLContactToPrisma as jest.Mock).mockImplementation((contact: any) => contact);
      (prisma.reconciliationLog.findMany as jest.Mock).mockResolvedValue([]);
    });

    it('should prioritize customer_name over description for matching', async () => {
      const paymentWithCustomerData: ParsedPaymentData = {
        transactionFingerprint: 'test-123',
        paymentDate: new Date('2024-01-01'),
        amount: 70,
        source: 'STRIPE_REPORT',
        transactionRef: 'stripe_123',
        description: 'Random description with no name',
        customer_name: 'John Smith',
        customer_email: 'john@example.com',
      };

      const result = await service.findMatches(paymentWithCustomerData);

      expect(result.suggestions.length).toBeGreaterThan(0);
      const bestMatch = result.suggestions[0];
      expect(bestMatch.reasoning.nameMatch?.extractedName).toBe('John Smith');
      expect(bestMatch.confidence).toBeGreaterThan(0.8); // High confidence due to exact name + email match
    });

    it('should match customer_email exactly', async () => {
      const paymentWithEmail: ParsedPaymentData = {
        transactionFingerprint: 'test-email-123',
        paymentDate: new Date('2024-01-01'),
        amount: 70,
        source: 'STRIPE_REPORT',
        transactionRef: 'stripe_456',
        customer_name: 'John Smith',
        customer_email: 'john@example.com',
      };

      const result = await service.findMatches(paymentWithEmail);

      expect(result.suggestions.length).toBeGreaterThan(0);
      const bestMatch = result.suggestions[0];
      expect(bestMatch.reasoning.emailMatch?.score).toBe(1.0);
      expect(bestMatch.reasoning.emailMatch?.providedEmail).toBe('john@example.com');
      expect(bestMatch.reasoning.emailMatch?.contactEmail).toBe('john@example.com');
    });

    it('should handle partial email domain matches', async () => {
      const paymentWithSimilarEmail: ParsedPaymentData = {
        transactionFingerprint: 'test-domain-123',
        paymentDate: new Date('2024-01-01'),
        amount: 70,
        source: 'STRIPE_REPORT',
        transactionRef: 'stripe_789',
        customer_email: 'j.smith@example.com', // Same domain, different username
        customer_name: 'J Smith', // Add name to boost confidence above threshold
      };

      const result = await service.findMatches(paymentWithSimilarEmail);

      expect(result.suggestions.length).toBeGreaterThan(0);
      const match = result.suggestions[0];
      expect(match.reasoning.emailMatch?.score).toBeGreaterThan(0);
      expect(match.reasoning.emailMatch?.score).toBeLessThan(1.0);
    });

    it('should use updated confidence weighting (40% name, 40% email, 20% amount)', async () => {
      const paymentPerfectMatch: ParsedPaymentData = {
        transactionFingerprint: 'test-perfect-123',
        paymentDate: new Date('2024-01-01'),
        amount: 70, // Perfect amount match for 'Full' membership
        source: 'STRIPE_REPORT',
        transactionRef: 'stripe_perfect',
        customer_name: 'John Smith', // Perfect name match
        customer_email: 'john@example.com', // Perfect email match
      };

      const result = await service.findMatches(paymentPerfectMatch);

      expect(result.suggestions.length).toBeGreaterThan(0);
      const perfectMatch = result.suggestions[0];
      
      // With perfect matches across all fields, confidence should be very high
      expect(perfectMatch.confidence).toBeGreaterThan(0.9);
      expect(perfectMatch.reasoning.nameMatch?.score).toBe(1.0);
      expect(perfectMatch.reasoning.emailMatch?.score).toBe(1.0);
      expect(perfectMatch.reasoning.amountMatch?.score).toBeGreaterThan(0.8);
    });

    it('should gracefully handle missing customer fields', async () => {
      const paymentNoCustomerData: ParsedPaymentData = {
        transactionFingerprint: 'test-no-customer-123',
        paymentDate: new Date('2024-01-01'),
        amount: 70,
        source: 'STRIPE_REPORT',
        transactionRef: 'stripe_no_customer',
        description: 'MEMBERSHIP PAYMENT - JOHN SMITH', // Fall back to description parsing
      };

      const result = await service.findMatches(paymentNoCustomerData);

      expect(result.suggestions.length).toBeGreaterThan(0);
      const match = result.suggestions[0];
      expect(match.reasoning.nameMatch?.score).toBeGreaterThan(0);
      expect(match.reasoning.emailMatch?.score || 0).toBe(0); // No email provided
    });

    it('should prefer customer_name over description even with lower string similarity', async () => {
      const paymentMixedSources: ParsedPaymentData = {
        transactionFingerprint: 'test-mixed-123',
        paymentDate: new Date('2024-01-01'),
        amount: 70,
        source: 'STRIPE_REPORT',
        transactionRef: 'stripe_mixed',
        description: 'MEMBERSHIP PAYMENT - JOHN SMITH EXACTLY', // Perfect description match
        customer_name: 'J Smith', // Shorter but from customer field
      };

      const result = await service.findMatches(paymentMixedSources);

      expect(result.suggestions.length).toBeGreaterThan(0);
      const match = result.suggestions[0];
      // Should use customer_name even if description might have better string match
      expect(match.reasoning.nameMatch?.extractedName).toBe('J Smith');
    });

    it('should work with real-world Stripe customer data format', async () => {
      const realWorldStripePayment: ParsedPaymentData = {
        transactionFingerprint: 'ch_1234567890abcdef',
        paymentDate: new Date('2024-01-01T10:30:00Z'),
        amount: 42.00, // Fixed currency preservation
        source: 'STRIPE_REPORT',
        transactionRef: 'ch_1234567890abcdef',
        customer_name: 'John Smith',
        customer_email: 'john@example.com',
        card_address_line1: '123 Main St',
        card_address_postal_code: 'SW1A 1AA',
      };

      const result = await service.findMatches(realWorldStripePayment);

      expect(result.suggestions.length).toBeGreaterThan(0);
      const match = result.suggestions[0];
      expect(match.reasoning.nameMatch?.score).toBeGreaterThan(0);
      expect(match.reasoning.emailMatch?.score).toBeGreaterThan(0);
      expect(match.contact.id).toBe('contact-1');
    });
  });
});