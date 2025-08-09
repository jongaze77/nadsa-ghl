import { SurnameIndexService } from '../../lib/SurnameIndexService';
import type { Contact } from '@prisma/client';

// Mock contact data for testing
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
    name: 'Michael McDonald',
    firstName: 'Michael',
    lastName: 'McDonald',
    email: 'michael.mcdonald@example.com',
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
    name: 'J Williams',
    firstName: 'James',
    lastName: 'Williams',
    email: 'james.williams@example.com',
    phone: '+1234567893',
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
    id: '5',
    name: 'Elizabeth Clarke',
    firstName: 'Elizabeth',
    lastName: 'Clarke',
    email: 'liz.clarke@example.com',
    phone: '+1234567894',
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

describe('SurnameIndexService', () => {
  let service: SurnameIndexService;

  beforeEach(() => {
    service = new SurnameIndexService();
  });

  describe('buildSurnameIndex', () => {
    test('should build surname index from contacts', () => {
      service.buildSurnameIndex(mockContacts);
      
      const stats = service.getIndexStats();
      expect(stats.initialized).toBe(true);
      expect(stats.totalSurnames).toBeGreaterThan(0);
      expect(stats.totalContacts).toBeGreaterThan(0);
    });

    test('should normalize common surname variations', () => {
      service.buildSurnameIndex(mockContacts);
      
      // MacDonald should be normalized to McDonald
      const macdonaldResults = service.searchSurnamesInDescription('Payment from MacDonald', 1.0);
      const mcdonaldResults = service.searchSurnamesInDescription('Payment from McDonald', 1.0);
      
      expect(macdonaldResults.matches.length).toBeGreaterThan(0);
      expect(mcdonaldResults.matches.length).toBeGreaterThan(0);
      
      // Both Jane MacDonald and Michael McDonald should be found
      const allContactIds = [
        ...macdonaldResults.matches.flatMap(m => m.contacts.map(c => c.id)),
        ...mcdonaldResults.matches.flatMap(m => m.contacts.map(c => c.id))
      ];
      expect(allContactIds).toContain('2'); // Jane MacDonald
      expect(allContactIds).toContain('3'); // Michael McDonald
    });

    test('should handle empty contacts array', () => {
      service.buildSurnameIndex([]);
      
      const stats = service.getIndexStats();
      expect(stats.initialized).toBe(true);
      expect(stats.totalSurnames).toBe(0);
      expect(stats.totalContacts).toBe(0);
    });
  });

  describe('searchSurnamesInDescription', () => {
    beforeEach(() => {
      service.buildSurnameIndex(mockContacts);
    });

    test('should find exact surname matches', () => {
      const result = service.searchSurnamesInDescription('Payment from Smith', 1.0);
      
      expect(result.matches.length).toBeGreaterThan(0);
      expect(result.matches[0].contacts.some(c => c.lastName === 'Smith')).toBe(true);
    });

    test('should find fuzzy surname matches', () => {
      const result = service.searchSurnamesInDescription('Payment from Smyth', 0.8);
      
      expect(result.matches.length).toBeGreaterThan(0);
      expect(result.matches[0].contacts.some(c => c.lastName === 'Smith')).toBe(true);
    });

    test('should handle common Lloyds payment descriptions', () => {
      const descriptions = [
        'LLOYDS BANK PAYMENT SMITH J',
        'BANK TRANSFER FROM WILLIAMS',
        'PAYMENT REF MCDONALD MEMBERSHIP',
        'FT CLARKE ELIZABETH'
      ];

      for (const description of descriptions) {
        const result = service.searchSurnamesInDescription(description, 0.8);
        expect(result.matches.length).toBeGreaterThan(0);
      }
    });

    test('should return empty results for no matches', () => {
      const result = service.searchSurnamesInDescription('PAYMENT FROM NONEXISTENT', 0.8);
      
      expect(result.matches.length).toBe(0);
    });

    test('should throw error if not initialized', () => {
      const uninitializedService = new SurnameIndexService();
      
      expect(() => {
        uninitializedService.searchSurnamesInDescription('Payment from Smith', 0.8);
      }).toThrow('Surname index not initialized');
    });
  });

  describe('enhanceForenameMatching', () => {
    beforeEach(() => {
      service.buildSurnameIndex(mockContacts);
    });

    test('should enhance matches with forename detection', () => {
      // First get surname matches for Williams
      const surnameResults = service.searchSurnamesInDescription('Payment from Williams', 0.8);
      expect(surnameResults.matches.length).toBeGreaterThan(0);

      // Now enhance with forename
      const enhanced = service.enhanceForenameMatching('JAMES WILLIAMS PAYMENT', surnameResults.matches);
      
      expect(enhanced.length).toBeGreaterThan(0);
      expect(enhanced.some(c => c.firstName === 'James' && c.lastName === 'Williams')).toBe(true);
    });

    test('should handle abbreviations in forename matching', () => {
      const surnameResults = service.searchSurnamesInDescription('Payment from Williams', 0.8);
      
      // Test with abbreviated forename
      const enhanced = service.enhanceForenameMatching('J WILLIAMS PAYMENT', surnameResults.matches);
      
      expect(enhanced.length).toBeGreaterThan(0);
      expect(enhanced.some(c => c.firstName === 'James' && c.lastName === 'Williams')).toBe(true);
    });

    test('should handle common name abbreviations', () => {
      const surnameResults = service.searchSurnamesInDescription('Payment from Clarke', 0.8);
      
      // Test with Liz -> Elizabeth
      const enhanced = service.enhanceForenameMatching('LIZ CLARKE PAYMENT', surnameResults.matches);
      
      expect(enhanced.length).toBeGreaterThan(0);
      expect(enhanced.some(c => c.firstName === 'Elizabeth' && c.lastName === 'Clarke')).toBe(true);
    });

    test('should return all contacts if no forename enhancement possible', () => {
      const surnameResults = service.searchSurnamesInDescription('Payment from Smith', 0.8);
      const originalCount = surnameResults.matches.flatMap(m => m.contacts).length;
      
      const enhanced = service.enhanceForenameMatching('PAYMENT FROM SMITH', surnameResults.matches);
      
      expect(enhanced.length).toBe(originalCount);
    });
  });

  describe('getIndexStats', () => {
    test('should return correct stats for uninitialized service', () => {
      const stats = service.getIndexStats();
      
      expect(stats.initialized).toBe(false);
      expect(stats.totalSurnames).toBe(0);
      expect(stats.totalContacts).toBe(0);
      expect(stats.averageContactsPerSurname).toBe(0);
    });

    test('should return correct stats for initialized service', () => {
      service.buildSurnameIndex(mockContacts);
      const stats = service.getIndexStats();
      
      expect(stats.initialized).toBe(true);
      expect(stats.totalSurnames).toBeGreaterThan(0);
      expect(stats.totalContacts).toBeGreaterThan(0);
      expect(stats.averageContactsPerSurname).toBeGreaterThan(0);
    });
  });

  describe('clearIndex', () => {
    test('should clear the surname index', () => {
      service.buildSurnameIndex(mockContacts);
      expect(service.isInitialized()).toBe(true);
      
      service.clearIndex();
      expect(service.isInitialized()).toBe(false);
      
      const stats = service.getIndexStats();
      expect(stats.totalSurnames).toBe(0);
    });
  });

  describe('performance tests', () => {
    test('should build index efficiently for large contact sets', () => {
      // Create larger dataset for performance testing
      const largeContactSet: Contact[] = [];
      for (let i = 0; i < 500; i++) {
        largeContactSet.push({
          id: `test-${i}`,
          name: `Test User ${i}`,
          firstName: `Test${i}`,
          lastName: `User${i}`,
          email: `test${i}@example.com`,
          phone: `+123456789${i}`,
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
        });
      }

      const startTime = Date.now();
      service.buildSurnameIndex(largeContactSet);
      const buildTime = Date.now() - startTime;
      
      expect(buildTime).toBeLessThan(1000); // Should build in under 1 second
      
      const stats = service.getIndexStats();
      expect(stats.totalSurnames).toBeGreaterThan(500); // Each contact contributes 2 surnames (lastName + parsed from name)
      expect(stats.initialized).toBe(true);
    });

    test('should search efficiently in large index', () => {
      // Build index with mock contacts
      service.buildSurnameIndex(mockContacts);
      
      const startTime = Date.now();
      for (let i = 0; i < 100; i++) {
        service.searchSurnamesInDescription('Payment from Smith', 0.8);
      }
      const searchTime = Date.now() - startTime;
      
      expect(searchTime).toBeLessThan(100); // 100 searches should complete in under 100ms
    });
  });
});