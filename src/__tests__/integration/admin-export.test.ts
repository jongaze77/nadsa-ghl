// src/__tests__/integration/admin-export.test.ts

import {
  mapContactRole,
  contactToWordPressUser,
  convertToCSV,
  WordPressUser
} from '../../lib/export-service';

describe('Admin Export Integration', () => {
  describe('Full Export Workflow', () => {
    it('should convert contact data to WordPress CSV format end-to-end', () => {
      // Mock contact data as it would come from database
      const mockContacts = [
        {
          id: 'contact-1',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
          membershipType: 'Full',
          customFields: [
            { id: 'hJQPtsVDFBxI1USEN83v', value: 'Single' },
            { id: 'cWMPNiNAfReHOumOhBB2', value: '2025-12-31' }
          ]
        },
        {
          id: 'contact-2',
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane.smith@example.com',
          membershipType: 'Full',
          customFields: [
            { id: 'hJQPtsVDFBxI1USEN83v', value: 'Double' },
            { id: 'cWMPNiNAfReHOumOhBB2', value: '2025-06-15' }
          ]
        },
        {
          id: 'contact-3',
          firstName: 'Bob',
          lastName: 'Wilson',
          email: 'bob.wilson@example.com',
          membershipType: 'Full',
          customFields: [
            { id: 'hJQPtsVDFBxI1USEN83v', value: 'Single' },
            { id: 'cWMPNiNAfReHOumOhBB2', value: '2025-03-20' }
          ]
        }
      ];

      // Convert to WordPress users
      const wordPressUsers: WordPressUser[] = mockContacts.map(contact => 
        contactToWordPressUser(contact)
      );

      // Verify each conversion
      expect(wordPressUsers[0]).toEqual({
        user_login: 'JohnDoe',
        user_email: 'john.doe@example.com',
        role: 'subscriber,Single Member',
        first_name: 'John',
        last_name: 'Doe'
      });

      expect(wordPressUsers[1]).toEqual({
        user_login: 'JaneSmith',
        user_email: 'jane.smith@example.com',
        role: 'subscriber,Double Member',
        first_name: 'Jane',
        last_name: 'Smith'
      });

      expect(wordPressUsers[2]).toEqual({
        user_login: 'BobWilson',
        user_email: 'bob.wilson@example.com',
        role: 'subscriber,Single Member',
        first_name: 'Bob',
        last_name: 'Wilson'
      });

      // Convert to CSV
      const csvOutput = convertToCSV(wordPressUsers);
      
      // Verify CSV structure
      const lines = csvOutput.split('\n');
      expect(lines[0]).toBe('user_login,user_email,role,first_name,last_name');
      
      // Verify data lines
      expect(lines[1]).toBe('JohnDoe,john.doe@example.com,"subscriber,Single Member",John,Doe');
      expect(lines[2]).toBe('JaneSmith,jane.smith@example.com,"subscriber,Double Member",Jane,Smith');
      expect(lines[3]).toBe('BobWilson,bob.wilson@example.com,"subscriber,Single Member",Bob,Wilson');
    });

    it('should handle edge cases in full workflow', () => {
      const mockContactsWithEdgeCases = [
        {
          id: 'edge-1',
          firstName: 'Mary Jane',
          lastName: 'Van Der Berg',
          email: 'mary.jane@example.com',
          membershipType: 'Full',
          customFields: [
            { id: 'hJQPtsVDFBxI1USEN83v', value: 'single' },
            { id: 'cWMPNiNAfReHOumOhBB2', value: '2025-12-31' }
          ]
        },
        {
          id: 'edge-2',
          firstName: 'José',
          lastName: 'Martínez-García',
          email: 'jose.martinez@example.com',
          membershipType: 'Full',
          customFields: [
            { id: 'hJQPtsVDFBxI1USEN83v', value: 'Double' },
            { id: 'cWMPNiNAfReHOumOhBB2', value: '2025-12-31' }
          ]
        },
        {
          id: 'edge-3',
          firstName: 'Test, User',
          lastName: 'O\'Connor "Bob"',
          email: 'test.user@example.com',
          membershipType: 'Full',
          customFields: [
            { id: 'hJQPtsVDFBxI1USEN83v', value: 'Unknown' },
            { id: 'cWMPNiNAfReHOumOhBB2', value: '2025-12-31' }
          ]
        }
      ];

      const wordPressUsers = mockContactsWithEdgeCases.map(contact => 
        contactToWordPressUser(contact)
      );
      
      const csvOutput = convertToCSV(wordPressUsers);
      const lines = csvOutput.split('\n');

      // Verify special character handling
      expect(lines[1]).toBe('MaryJaneVanDerBerg,mary.jane@example.com,"subscriber,Single Member",Mary Jane,Van Der Berg');
      expect(lines[2]).toBe('JoséMartínez-García,jose.martinez@example.com,"subscriber,Double Member",José,Martínez-García');
      expect(lines[3]).toBe('"Test,UserO\'Connor""Bob""",test.user@example.com,subscriber,"Test, User","O\'Connor ""Bob"""');
    });

    it('should filter out invalid entries', () => {
      const mockContactsWithInvalid = [
        {
          id: 'valid-1',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
          membershipType: 'Full',
          customFields: [
            { id: 'hJQPtsVDFBxI1USEN83v', value: 'Single' },
            { id: 'cWMPNiNAfReHOumOhBB2', value: '2025-12-31' }
          ]
        },
        {
          id: 'invalid-1',
          firstName: '',
          lastName: '',
          email: '',
          membershipType: 'Full',
          customFields: [
            { id: 'hJQPtsVDFBxI1USEN83v', value: 'Single' },
            { id: 'cWMPNiNAfReHOumOhBB2', value: '2025-12-31' }
          ]
        },
        {
          id: 'invalid-2',
          firstName: 'Jane',
          lastName: 'Smith',
          email: null,
          membershipType: 'Full',
          customFields: [
            { id: 'hJQPtsVDFBxI1USEN83v', value: 'Double' },
            { id: 'cWMPNiNAfReHOumOhBB2', value: '2025-12-31' }
          ]
        }
      ];

      const wordPressUsers = mockContactsWithInvalid
        .map(contact => contactToWordPressUser(contact))
        .filter(user => user.user_login && user.user_email);

      expect(wordPressUsers).toHaveLength(1);
      expect(wordPressUsers[0].user_login).toBe('JohnDoe');
      expect(wordPressUsers[0].user_email).toBe('john.doe@example.com');
    });
  });

  describe('WordPress Import Compatibility', () => {
    it('should produce CSV format compatible with WordPress user import plugins', () => {
      const mockContact = {
        id: 'wordpress-test',
        firstName: 'WordPress',
        lastName: 'User',
        email: 'wordpress@example.com',
        membershipType: 'Full',
        customFields: [
          { id: 'hJQPtsVDFBxI1USEN83v', value: 'Single' },
          { id: 'cWMPNiNAfReHOumOhBB2', value: '2025-12-31' }
        ]
      };

      const wpUser = contactToWordPressUser(mockContact);
      const csvOutput = convertToCSV([wpUser]);

      // Verify WordPress-specific requirements
      expect(wpUser.user_login).toBe('WordPressUser'); // No spaces
      expect(wpUser.role).toBe('subscriber,Single Member'); // Correct role format
      expect(csvOutput).toContain('user_login,user_email,role,first_name,last_name'); // Correct headers
      
      // Verify CSV format follows WordPress import expectations
      const lines = csvOutput.split('\n');
      expect(lines[1]).toBe('WordPressUser,wordpress@example.com,"subscriber,Single Member",WordPress,User');
      
      // Verify essential fields are correct
      expect(wpUser.user_login).toBe('WordPressUser'); // user_login
      expect(wpUser.user_email).toBe('wordpress@example.com'); // user_email  
      expect(wpUser.role).toBe('subscriber,Single Member'); // role
      expect(wpUser.first_name).toBe('WordPress'); // first_name
      expect(wpUser.last_name).toBe('User'); // last_name
    });

    it('should handle all possible membership type mappings for WordPress', () => {
      const testCases = [
        { input: 'Single', expected: 'subscriber,Single Member' },
        { input: 'single', expected: 'subscriber,Single Member' },
        { input: 'SINGLE', expected: 'subscriber,Single Member' },
        { input: 'Double', expected: 'subscriber,Double Member' },
        { input: 'double', expected: 'subscriber,Double Member' },
        { input: 'DOUBLE', expected: 'subscriber,Double Member' },
        { input: 'Family', expected: 'subscriber' },
        { input: '', expected: 'subscriber' },
        { input: null as any, expected: 'subscriber' },
        { input: undefined as any, expected: 'subscriber' }
      ];

      testCases.forEach(testCase => {
        const result = mapContactRole(testCase.input);
        expect(result).toBe(testCase.expected);
      });
    });
  });

  describe('Performance and Data Validation', () => {
    it('should handle large datasets efficiently', () => {
      // Generate a larger dataset
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        id: `contact-${i}`,
        firstName: `FirstName${i}`,
        lastName: `LastName${i}`,
        email: `user${i}@example.com`,
        membershipType: 'Full',
        customFields: [
          { id: 'hJQPtsVDFBxI1USEN83v', value: i % 2 === 0 ? 'Single' : 'Double' },
          { id: 'cWMPNiNAfReHOumOhBB2', value: '2025-12-31' }
        ]
      }));

      const startTime = Date.now();
      
      const wordPressUsers = largeDataset.map(contact => 
        contactToWordPressUser(contact)
      );
      
      const csvOutput = convertToCSV(wordPressUsers);
      
      const endTime = Date.now();
      const processingTime = endTime - startTime;

      // Should process 1000 records quickly (under 1 second)
      expect(processingTime).toBeLessThan(1000);
      
      // Verify output correctness
      expect(wordPressUsers).toHaveLength(1000);
      const lines = csvOutput.split('\n');
      expect(lines).toHaveLength(1001); // 1000 data lines + 1 header line
      
      // Spot check a few entries
      expect(lines[1]).toContain('FirstName0LastName0');
      expect(lines[501]).toContain('FirstName500LastName500');
      expect(lines[1000]).toContain('FirstName999LastName999');
    });

    it('should maintain data integrity throughout the conversion process', () => {
      const testContact = {
        id: 'integrity-test',
        firstName: 'Integrity',
        lastName: 'Test',
        email: 'integrity.test@example.com',
        membershipType: 'Full',
        customFields: [
          { id: 'hJQPtsVDFBxI1USEN83v', value: 'Single' },
          { id: 'cWMPNiNAfReHOumOhBB2', value: '2025-12-31' }
        ]
      };

      const wpUser = contactToWordPressUser(testContact);
      
      // Verify no data loss during conversion
      expect(wpUser.first_name).toBe(testContact.firstName);
      expect(wpUser.last_name).toBe(testContact.lastName);
      expect(wpUser.user_email).toBe(testContact.email);
      
      // Verify derived fields are correct
      expect(wpUser.user_login).toBe(`${testContact.firstName}${testContact.lastName}`);
      expect(wpUser.role).toBe('subscriber,Single Member');
      
      // Convert to CSV and verify format
      const csvOutput = convertToCSV([wpUser]);
      const lines = csvOutput.split('\n');
      
      // Verify the full CSV line format
      expect(lines[1]).toBe('IntegrityTest,integrity.test@example.com,"subscriber,Single Member",Integrity,Test');
      
      // Verify the conversion preserved all data
      expect(csvOutput).toContain(wpUser.user_login);
      expect(csvOutput).toContain(wpUser.user_email);
      expect(csvOutput).toContain(wpUser.role);
      expect(csvOutput).toContain(wpUser.first_name);
      expect(csvOutput).toContain(wpUser.last_name);
    });
  });
});