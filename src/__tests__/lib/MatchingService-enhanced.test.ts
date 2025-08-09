import { MatchingService } from '../../lib/MatchingService';
import type { Contact } from '@prisma/client';
import type { ParsedPaymentData } from '../../lib/CsvParsingService';

// Mock prisma
jest.mock('../../lib/prisma', () => ({
  prisma: {
    contact: {
      findMany: jest.fn(),
    },
    reconciliationLog: {
      findMany: jest.fn(() => Promise.resolve([])),
    },
  },
}));

// Mock GHL API
jest.mock('../../lib/ghl-api', () => ({
  fetchAllContactsFromGHL: jest.fn(() => Promise.resolve({ contacts: [] })),
  mapGHLContactToPrisma: jest.fn(contact => contact),
}));

const mockContacts: Contact[] = [
  {
    id: '1',
    name: 'John Smith',
    firstName: 'John',
    lastName: 'Smith',
    email: 'john.smith@example.com',
    phone: '+1234567890',
    membershipType: 'Single',
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
    customFields: {},
    ghlUpdatedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSyncedAt: new Date()
  },
  {
    id: '2',
    name: 'Jane MacDonald',
    firstName: 'Jane',
    lastName: 'MacDonald',
    email: 'jane.macdonald@example.com',
    phone: '+1234567891',
    membershipType: 'Double',
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
    customFields: {},
    ghlUpdatedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSyncedAt: new Date()
  },
  {
    id: '3',
    name: 'James Williams',
    firstName: 'James',
    lastName: 'Williams',
    email: 'james.williams@example.com',
    phone: '+1234567892',
    membershipType: 'Full',
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
    customFields: {},
    ghlUpdatedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSyncedAt: new Date()
  },
  {
    id: '4',
    name: 'Michael McDonald',
    firstName: 'Michael',
    lastName: 'McDonald',
    email: 'michael.mcdonald@example.com',
    phone: '+1234567893',
    membershipType: 'Associate',
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
    customFields: {},
    ghlUpdatedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSyncedAt: new Date()
  }
];

describe('Enhanced MatchingService with Surname Indexing', () => {
  let matchingService: MatchingService;
  const { prisma } = require('../../lib/prisma');

  beforeEach(() => {
    matchingService = new MatchingService();
    // Reset mocks
    jest.clearAllMocks();
    prisma.contact.findMany.mockResolvedValue(mockContacts);
  });

  describe('Surname-based matching for Lloyds data', () => {
    test('should match Lloyds payment with surname match', async () => {
      const paymentData: ParsedPaymentData = {
        transactionFingerprint: 'test-1',
        paymentDate: new Date(),
        amount: 25,
        description: 'FASTER PAYMENT RECEIVED REF SMITH J MEMBERSHIP',
        source: 'BANK_CSV',
        transactionRef: 'FP12345',
        customer_name: undefined,
        customer_email: undefined,
        card_address_line1: undefined,
        card_address_postal_code: undefined
      };

      const result = await matchingService.findMatches(paymentData);

      expect(result.suggestions.length).toBeGreaterThan(0);
      
      // Should find John Smith
      const johnSmithMatch = result.suggestions.find(s => s.contact.firstName === 'John' && s.contact.lastName === 'Smith');
      expect(johnSmithMatch).toBeDefined();
      expect(johnSmithMatch?.reasoning.nameMatch?.matchType).toMatch(/surname_fuzzy|forename_enhanced/);
      expect(johnSmithMatch?.confidence).toBeGreaterThan(0.5);
    });

    test('should enhance surname match with forename detection', async () => {
      const paymentData: ParsedPaymentData = {
        transactionFingerprint: 'test-2',
        paymentDate: new Date(),
        amount: 25,
        description: 'BANK TRANSFER FROM JAMES WILLIAMS MEMBERSHIP',
        source: 'BANK_CSV',
        transactionRef: 'BT67890',
        customer_name: undefined,
        customer_email: undefined,
        card_address_line1: undefined,
        card_address_postal_code: undefined
      };

      const result = await matchingService.findMatches(paymentData);

      expect(result.suggestions.length).toBeGreaterThan(0);
      
      // Should find James Williams with forename enhancement
      const jamesMatch = result.suggestions.find(s => s.contact.firstName === 'James' && s.contact.lastName === 'Williams');
      expect(jamesMatch).toBeDefined();
      expect(jamesMatch?.reasoning.nameMatch?.matchType).toBe('forename_enhanced');
      expect(jamesMatch?.confidence).toBeGreaterThan(0.3); // Adjusted for weighted scoring
    });

    test('should handle common surname variations (MacDonald/McDonald)', async () => {
      const paymentData: ParsedPaymentData = {
        transactionFingerprint: 'test-3',
        paymentDate: new Date(),
        amount: 35,
        description: 'PAYMENT FROM MCDONALD JANE',
        source: 'BANK_CSV',
        transactionRef: 'PAY123',
        customer_name: undefined,
        customer_email: undefined,
        card_address_line1: undefined,
        card_address_postal_code: undefined
      };

      const result = await matchingService.findMatches(paymentData);

      expect(result.suggestions.length).toBeGreaterThan(0);
      
      // Should find Jane MacDonald despite spelling as McDonald
      const janeMatch = result.suggestions.find(s => s.contact.firstName === 'Jane' && s.contact.lastName === 'MacDonald');
      expect(janeMatch).toBeDefined();
      expect(janeMatch?.reasoning.nameMatch?.matchType).toMatch(/surname_fuzzy|forename_enhanced/);
    });

    test('should handle abbreviations in forename matching', async () => {
      const paymentData: ParsedPaymentData = {
        transactionFingerprint: 'test-4',
        paymentDate: new Date(),
        amount: 25,
        description: 'FT PAYMENT J SMITH ANNUAL FEE',
        source: 'BANK_CSV',
        transactionRef: 'FT456',
        customer_name: undefined,
        customer_email: undefined,
        card_address_line1: undefined,
        card_address_postal_code: undefined
      };

      const result = await matchingService.findMatches(paymentData);

      expect(result.suggestions.length).toBeGreaterThan(0);
      
      // Should find John Smith with abbreviation J -> John
      const johnMatch = result.suggestions.find(s => s.contact.firstName === 'John' && s.contact.lastName === 'Smith');
      expect(johnMatch).toBeDefined();
      expect(johnMatch?.reasoning.nameMatch?.matchType).toBe('forename_enhanced');
    });

    test('should fall back to legacy matching when no surname matches', async () => {
      const paymentData: ParsedPaymentData = {
        transactionFingerprint: 'test-5',
        paymentDate: new Date(),
        amount: 25,
        description: 'PAYMENT FROM UNKNOWN PERSON',
        source: 'BANK_CSV',
        transactionRef: 'UNK123',
        customer_name: undefined,
        customer_email: undefined,
        card_address_line1: undefined,
        card_address_postal_code: undefined
      };

      const result = await matchingService.findMatches(paymentData);

      // Should return empty results or very low confidence matches
      expect(result.suggestions.length).toBe(0);
    });

    test('should maintain performance with surname indexing', async () => {
      const paymentData: ParsedPaymentData = {
        transactionFingerprint: 'perf-test',
        paymentDate: new Date(),
        amount: 25,
        description: 'PAYMENT FROM SMITH JOHN',
        source: 'BANK_CSV',
        transactionRef: 'PERF123',
        customer_name: undefined,
        customer_email: undefined,
        card_address_line1: undefined,
        card_address_postal_code: undefined
      };

      const startTime = Date.now();
      const result = await matchingService.findMatches(paymentData);
      const endTime = Date.now();

      // Should complete in reasonable time (less than 100ms for small dataset)
      expect(endTime - startTime).toBeLessThan(100);
      expect(result.processingTimeMs).toBeLessThan(100);
    });
  });

  describe('Surname index integration', () => {
    test('should build surname index on contact load', async () => {
      const paymentData: ParsedPaymentData = {
        transactionFingerprint: 'index-test',
        paymentDate: new Date(),
        amount: 25,
        description: 'TEST PAYMENT',
        source: 'BANK_CSV',
        transactionRef: 'IDX123',
        customer_name: undefined,
        customer_email: undefined,
        card_address_line1: undefined,
        card_address_postal_code: undefined
      };

      await matchingService.findMatches(paymentData);

      // Check that surname index service is initialized
      const surnameIndexService = matchingService.getSurnameIndexService();
      expect(surnameIndexService.isInitialized()).toBe(true);
      
      const stats = surnameIndexService.getIndexStats();
      expect(stats.totalSurnames).toBeGreaterThan(0);
      expect(stats.totalContacts).toBeGreaterThan(0);
    });

    test('should provide surname index statistics', async () => {
      const paymentData: ParsedPaymentData = {
        transactionFingerprint: 'stats-test',
        paymentDate: new Date(),
        amount: 25,
        description: 'STATS TEST PAYMENT',
        source: 'BANK_CSV',
        transactionRef: 'STS123',
        customer_name: undefined,
        customer_email: undefined,
        card_address_line1: undefined,
        card_address_postal_code: undefined
      };

      await matchingService.findMatches(paymentData);

      const cacheInfo = matchingService.getCacheInfo();
      expect(cacheInfo.surnameIndexStats).toBeDefined();
      expect(cacheInfo.surnameIndexStats?.initialized).toBe(true);
      expect(cacheInfo.surnameIndexStats?.totalSurnames).toBeGreaterThan(0);
    });

    test('should refresh surname index when contacts cache is refreshed', async () => {
      // First load
      await matchingService.findMatches({
        transactionFingerprint: 'refresh-1',
        paymentDate: new Date(),
        amount: 25,
        description: 'FIRST LOAD',
        source: 'BANK_CSV',
        transactionRef: 'RF1',
        customer_name: undefined,
        customer_email: undefined,
        card_address_line1: undefined,
        card_address_postal_code: undefined
      });

      const firstStats = matchingService.getSurnameIndexService().getIndexStats();

      // Refresh cache
      await matchingService.refreshContactsCache();

      const secondStats = matchingService.getSurnameIndexService().getIndexStats();
      
      // Stats should be consistent after refresh
      expect(secondStats.initialized).toBe(true);
      expect(secondStats.totalSurnames).toBe(firstStats.totalSurnames);
    });
  });

  describe('Stripe data compatibility', () => {
    test('should prioritize customer_name over surname matching for Stripe data', async () => {
      const paymentData: ParsedPaymentData = {
        transactionFingerprint: 'stripe-test',
        paymentDate: new Date(),
        amount: 25,
        description: 'PAYMENT FROM INCORRECT SURNAME',
        source: 'STRIPE_REPORT',
        transactionRef: 'STR123',
        customer_name: 'John Smith',
        customer_email: 'john.smith@example.com',
        card_address_line1: undefined,
        card_address_postal_code: undefined
      };

      const result = await matchingService.findMatches(paymentData);

      expect(result.suggestions.length).toBeGreaterThan(0);
      
      // Should find John Smith based on customer_name
      const johnMatch = result.suggestions.find(s => s.contact.firstName === 'John' && s.contact.lastName === 'Smith');
      expect(johnMatch).toBeDefined();
      expect(johnMatch?.confidence).toBeGreaterThan(0.8);
    });
  });

  describe('Edge cases and error handling', () => {
    test('should handle empty descriptions gracefully', async () => {
      const paymentData: ParsedPaymentData = {
        transactionFingerprint: 'empty-desc',
        paymentDate: new Date(),
        amount: 25,
        description: '',
        source: 'BANK_CSV',
        transactionRef: 'EMPTY',
        customer_name: undefined,
        customer_email: undefined,
        card_address_line1: undefined,
        card_address_postal_code: undefined
      };

      const result = await matchingService.findMatches(paymentData);
      
      // Should not throw errors and return empty results
      expect(result.suggestions.length).toBe(0);
      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
    });

    test('should handle database connection errors gracefully', async () => {
      // Mock database error
      prisma.contact.findMany.mockRejectedValueOnce(new Error('Database connection failed'));

      const paymentData: ParsedPaymentData = {
        transactionFingerprint: 'db-error',
        paymentDate: new Date(),
        amount: 25,
        description: 'PAYMENT FROM SMITH JOHN',
        source: 'BANK_CSV',
        transactionRef: 'DBE123',
        customer_name: undefined,
        customer_email: undefined,
        card_address_line1: undefined,
        card_address_postal_code: undefined
      };

      const result = await matchingService.findMatches(paymentData);
      
      // Should handle error gracefully and return empty results
      expect(result.suggestions.length).toBe(0);
      expect(result.totalMatches).toBe(0);
    });
  });
});