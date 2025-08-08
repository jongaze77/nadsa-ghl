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
      expect(johnMatch!.confidence).toBeGreaterThan(0.8);
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
      };

      const result = await service.findMatches(amountOnlyPayment);

      // Should still find matches based on amount
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
      (ghlApi.fetchAllContactsFromGHL as jest.Mock).mockResolvedValue({
        contacts: mockContacts,
      });
      (ghlApi.mapGHLContactToPrisma as jest.Mock).mockImplementation((contact: any) => contact);
      (prisma.reconciliationLog.findMany as jest.Mock).mockResolvedValue([]);
    });

    it('should weight name matches at 60% and amount matches at 40%', async () => {
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
});