// src/__tests__/lib/export-service.test.ts

import {
  mapContactRole,
  contactToWordPressUser,
  convertToCSV,
  WordPressUser,
  contactToMailmergeData,
  convertMailmergeToCSV,
  MailmergeContact
} from '../../lib/export-service';

describe('Export Service', () => {
  describe('mapContactRole', () => {
    it('should map "Single" to subscriber,Single Member', () => {
      expect(mapContactRole('Single')).toBe('subscriber,Single Member');
      expect(mapContactRole('single')).toBe('subscriber,Single Member');
      expect(mapContactRole(' SINGLE ')).toBe('subscriber,Single Member');
    });

    it('should map "Double" to subscriber,Double Member', () => {
      expect(mapContactRole('Double')).toBe('subscriber,Double Member');
      expect(mapContactRole('double')).toBe('subscriber,Double Member');
      expect(mapContactRole(' DOUBLE ')).toBe('subscriber,Double Member');
    });

    it('should default to "subscriber" for unknown values', () => {
      expect(mapContactRole('Unknown')).toBe('subscriber');
      expect(mapContactRole('')).toBe('subscriber');
      expect(mapContactRole('Family')).toBe('subscriber');
    });

    it('should handle undefined/null values', () => {
      expect(mapContactRole('')).toBe('subscriber');
    });
  });

  describe('contactToWordPressUser', () => {
    it('should convert contact with Single membership correctly', () => {
      const mockContact = {
        id: 'test-id',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        customFields: [
          { id: 'hJQPtsVDFBxI1USEN83v', value: 'Single' }
        ]
      };

      const result = contactToWordPressUser(mockContact);
      
      expect(result).toEqual({
        user_login: 'JohnDoe',
        user_email: 'john.doe@example.com',
        role: 'subscriber,Single Member',
        first_name: 'John',
        last_name: 'Doe'
      });
    });

    it('should convert contact with Double membership correctly', () => {
      const mockContact = {
        id: 'test-id-2',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@example.com',
        customFields: [
          { id: 'hJQPtsVDFBxI1USEN83v', value: 'Double' }
        ]
      };

      const result = contactToWordPressUser(mockContact);
      
      expect(result).toEqual({
        user_login: 'JaneSmith',
        user_email: 'jane.smith@example.com',
        role: 'subscriber,Double Member',
        first_name: 'Jane',
        last_name: 'Smith'
      });
    });

    it('should handle missing customFields gracefully', () => {
      const mockContact = {
        id: 'test-id-3',
        firstName: 'Bob',
        lastName: 'Wilson',
        email: 'bob.wilson@example.com',
        customFields: null
      };

      const result = contactToWordPressUser(mockContact);
      
      expect(result).toEqual({
        user_login: 'BobWilson',
        user_email: 'bob.wilson@example.com',
        role: 'subscriber',
        first_name: 'Bob',
        last_name: 'Wilson'
      });
    });

    it('should handle missing membership field in customFields', () => {
      const mockContact = {
        id: 'test-id-4',
        firstName: 'Alice',
        lastName: 'Johnson',
        email: 'alice.johnson@example.com',
        customFields: [
          { id: 'someOtherField', value: 'value' }
        ]
      };

      const result = contactToWordPressUser(mockContact);
      
      expect(result).toEqual({
        user_login: 'AliceJohnson',
        user_email: 'alice.johnson@example.com',
        role: 'subscriber',
        first_name: 'Alice',
        last_name: 'Johnson'
      });
    });

    it('should remove spaces from user_login', () => {
      const mockContact = {
        id: 'test-id-5',
        firstName: 'Mary Jane',
        lastName: 'Van Der Berg',
        email: 'mary.jane@example.com',
        customFields: [
          { id: 'hJQPtsVDFBxI1USEN83v', value: 'Single' }
        ]
      };

      const result = contactToWordPressUser(mockContact);
      
      expect(result.user_login).toBe('MaryJaneVanDerBerg');
    });

    it('should handle empty/null names gracefully', () => {
      const mockContact = {
        id: 'test-id-6',
        firstName: null,
        lastName: '',
        email: 'test@example.com',
        customFields: [
          { id: 'hJQPtsVDFBxI1USEN83v', value: 'Single' }
        ]
      };

      const result = contactToWordPressUser(mockContact);
      
      expect(result).toEqual({
        user_login: '',
        user_email: 'test@example.com',
        role: 'subscriber,Single Member',
        first_name: '',
        last_name: ''
      });
    });
  });

  describe('convertToCSV', () => {
    it('should convert empty array to header-only CSV', () => {
      const result = convertToCSV([]);
      expect(result).toBe('user_login,user_email,role,first_name,last_name\n');
    });

    it('should convert single user to CSV correctly', () => {
      const users: WordPressUser[] = [{
        user_login: 'JohnDoe',
        user_email: 'john.doe@example.com',
        role: 'subscriber,Single Member',
        first_name: 'John',
        last_name: 'Doe'
      }];

      const result = convertToCSV(users);
      const expected = 'user_login,user_email,role,first_name,last_name\n' +
                     'JohnDoe,john.doe@example.com,"subscriber,Single Member",John,Doe';
      
      expect(result).toBe(expected);
    });

    it('should convert multiple users to CSV correctly', () => {
      const users: WordPressUser[] = [
        {
          user_login: 'JohnDoe',
          user_email: 'john.doe@example.com',
          role: 'subscriber,Single Member',
          first_name: 'John',
          last_name: 'Doe'
        },
        {
          user_login: 'JaneSmith',
          user_email: 'jane.smith@example.com',
          role: 'subscriber,Double Member',
          first_name: 'Jane',
          last_name: 'Smith'
        }
      ];

      const result = convertToCSV(users);
      const lines = result.split('\n');
      
      expect(lines[0]).toBe('user_login,user_email,role,first_name,last_name');
      expect(lines[1]).toBe('JohnDoe,john.doe@example.com,"subscriber,Single Member",John,Doe');
      expect(lines[2]).toBe('JaneSmith,jane.smith@example.com,"subscriber,Double Member",Jane,Smith');
    });

    it('should escape CSV fields with commas and quotes', () => {
      const users: WordPressUser[] = [{
        user_login: 'TestUser',
        user_email: 'test@example.com',
        role: 'subscriber',
        first_name: 'John, Jr.',
        last_name: 'O\'Connor "Bob"'
      }];

      const result = convertToCSV(users);
      const lines = result.split('\n');
      
      expect(lines[1]).toBe('TestUser,test@example.com,subscriber,"John, Jr.","O\'Connor ""Bob"""');
    });

    it('should handle empty field values', () => {
      const users: WordPressUser[] = [{
        user_login: '',
        user_email: 'test@example.com',
        role: 'subscriber',
        first_name: '',
        last_name: ''
      }];

      const result = convertToCSV(users);
      const lines = result.split('\n');
      
      expect(lines[1]).toBe(',test@example.com,subscriber,,');
    });

    it('should handle special characters in names', () => {
      const users: WordPressUser[] = [{
        user_login: 'JoseMartinez',
        user_email: 'jose@example.com',
        role: 'subscriber,Single Member',
        first_name: 'José',
        last_name: 'Martínez'
      }];

      const result = convertToCSV(users);
      const lines = result.split('\n');
      
      expect(lines[1]).toBe('JoseMartinez,jose@example.com,"subscriber,Single Member",José,Martínez');
    });
  });

  describe('CSV Integration', () => {
    it('should produce WordPress-compatible CSV format', () => {
      const mockContact = {
        id: 'integration-test',
        firstName: 'Integration',
        lastName: 'Test',
        email: 'integration@example.com',
        customFields: [
          { id: 'hJQPtsVDFBxI1USEN83v', value: 'Single' }
        ]
      };

      const wpUser = contactToWordPressUser(mockContact);
      const csv = convertToCSV([wpUser]);
      const lines = csv.split('\n');

      // Verify header format
      expect(lines[0]).toBe('user_login,user_email,role,first_name,last_name');
      
      // Verify data format
      expect(lines[1]).toBe('IntegrationTest,integration@example.com,"subscriber,Single Member",Integration,Test');
    });
  });

  describe('Mailmerge Export Functions', () => {
    describe('contactToMailmergeData', () => {
      it('should convert contact with complete address data correctly', () => {
        const mockContact = {
          id: 'mailmerge-test-1',
          firstName: 'John',
          lastName: 'Doe',
          address1: '123 Main St',
          address2: 'Suite 100', // This field won't be used anymore
          city: 'Anytown',
          state: 'CA',
          postalCode: '12345',
          country: 'USA',
          membershipType: 'Full',
          renewal_date: '2024-12-31',
          customFields: [
            { id: 'xNIBnbcu4NJ008JLUWGF', value: 'Mr' },
            { id: 'PEyv7RkguJ3IwYQdQlkR', value: 'Suite 100' }, // Address Line 2
            { id: 'dTKWIDeFBg9MI1MQ65vi', value: 'Building A' }, // Address Line 3
            { id: 'hJQPtsVDFBxI1USEN83v', value: 'Single' }
          ]
        };

        const result = contactToMailmergeData(mockContact);
        
        expect(result).toEqual({
          title: 'Mr',
          initial: 'J',
          first_name: 'John',
          last_name: 'Doe',
          address_line_1: '123 Main St',
          address_line_2: 'Suite 100',
          address_line_3: 'Building A',
          city: 'Anytown',
          state: 'CA',
          postal_code: '12345',
          country: 'USA',
          membership_type: 'Full',
          single_or_double: 'Single',
          renewal_date: '2024-12-31'
        });
      });

      it('should handle missing address fields with empty strings', () => {
        const mockContact = {
          id: 'mailmerge-test-2',
          firstName: 'Jane',
          lastName: 'Smith',
          address1: null,
          address2: null,
          city: '',
          state: null,
          postalCode: undefined,
          country: null,
          membershipType: 'Associate',
          customFields: [
            { id: 'hJQPtsVDFBxI1USEN83v', value: 'Double' }
          ]
        };

        const result = contactToMailmergeData(mockContact);
        
        expect(result).toEqual({
          title: '',
          initial: 'J',
          first_name: 'Jane',
          last_name: 'Smith',
          address_line_1: '',
          address_line_2: '',
          address_line_3: '',
          city: '',
          state: '',
          postal_code: '',
          country: '',
          membership_type: 'Associate',
          single_or_double: 'Double',
          renewal_date: ''
        });
      });

      it('should prefer extracted renewal_date over customFields', () => {
        const mockContact = {
          id: 'mailmerge-test-3',
          firstName: 'Bob',
          lastName: 'Wilson',
          membershipType: 'Full',
          renewal_date: '2024-06-15', // This should be used
          customFields: [
            { id: 'cWMPNiNAfReHOumOhBB2', value: '2024-01-01' }, // This should be ignored
            { id: 'hJQPtsVDFBxI1USEN83v', value: 'Single' }
          ]
        };

        const result = contactToMailmergeData(mockContact);
        
        expect(result.renewal_date).toBe('2024-06-15');
      });

      it('should fallback to customFields for renewal_date when extracted field is missing', () => {
        const mockContact = {
          id: 'mailmerge-test-4',
          firstName: 'Alice',
          lastName: 'Johnson',
          membershipType: 'Associate',
          renewal_date: null,
          customFields: [
            { id: 'cWMPNiNAfReHOumOhBB2', value: '2024-03-20' },
            { id: 'hJQPtsVDFBxI1USEN83v', value: 'Double' }
          ]
        };

        const result = contactToMailmergeData(mockContact);
        
        expect(result.renewal_date).toBe('2024-03-20');
      });

      it('should handle missing customFields gracefully', () => {
        const mockContact = {
          id: 'mailmerge-test-5',
          firstName: 'Charlie',
          lastName: 'Brown',
          membershipType: 'Full',
          customFields: null
        };

        const result = contactToMailmergeData(mockContact);
        
        expect(result.title).toBe('');
        expect(result.single_or_double).toBe('');
        expect(result.renewal_date).toBe('');
      });

      it('should handle empty customFields array', () => {
        const mockContact = {
          id: 'mailmerge-test-6',
          firstName: 'Diana',
          lastName: 'Prince',
          membershipType: 'Associate',
          customFields: []
        };

        const result = contactToMailmergeData(mockContact);
        
        expect(result.title).toBe('');
        expect(result.single_or_double).toBe('');
        expect(result.renewal_date).toBe('');
      });

      it('should calculate initial field correctly', () => {
        const mockContact = {
          id: 'initial-test-1',
          firstName: 'Alice',
          lastName: 'Johnson',
          membershipType: 'Full',
          customFields: []
        };

        const result = contactToMailmergeData(mockContact);
        
        expect(result.initial).toBe('A');
      });

      it('should handle empty first name for initial field', () => {
        const mockContact = {
          id: 'initial-test-2',
          firstName: '',
          lastName: 'Smith',
          membershipType: 'Associate',
          customFields: []
        };

        const result = contactToMailmergeData(mockContact);
        
        expect(result.initial).toBe('');
      });

      it('should handle null first name for initial field', () => {
        const mockContact = {
          id: 'initial-test-3',
          firstName: null,
          lastName: 'Brown',
          membershipType: 'Full',
          customFields: []
        };

        const result = contactToMailmergeData(mockContact);
        
        expect(result.initial).toBe('');
      });
    });

    describe('convertMailmergeToCSV', () => {
      it('should convert empty array to header-only CSV', () => {
        const result = convertMailmergeToCSV([]);
        expect(result).toBe('title,initial,first_name,last_name,address_line_1,address_line_2,address_line_3,city,state,postal_code,country,membership_type,single_or_double,renewal_date\n');
      });

      it('should convert single contact to CSV correctly', () => {
        const contacts: MailmergeContact[] = [{
          title: 'Mr',
          initial: 'J',
          first_name: 'John',
          last_name: 'Doe',
          address_line_1: '123 Main St',
          address_line_2: 'Suite 100',
          address_line_3: 'Building A',
          city: 'Anytown',
          state: 'CA',
          postal_code: '12345',
          country: 'USA',
          membership_type: 'Full',
          single_or_double: 'Single',
          renewal_date: '2024-12-31'
        }];

        const result = convertMailmergeToCSV(contacts);
        const lines = result.split('\n');
        
        expect(lines[0]).toBe('title,initial,first_name,last_name,address_line_1,address_line_2,address_line_3,city,state,postal_code,country,membership_type,single_or_double,renewal_date');
        expect(lines[1]).toBe('Mr,J,John,Doe,123 Main St,Suite 100,Building A,Anytown,CA,12345,USA,Full,Single,2024-12-31');
      });

      it('should convert multiple contacts to CSV correctly', () => {
        const contacts: MailmergeContact[] = [
          {
            title: 'Mr',
            initial: 'J',
            first_name: 'John',
            last_name: 'Doe',
            address_line_1: '123 Main St',
            address_line_2: '',
            address_line_3: '',
            city: 'Anytown',
            state: 'CA',
            postal_code: '12345',
            country: 'USA',
            membership_type: 'Full',
            single_or_double: 'Single',
            renewal_date: '2024-12-31'
          },
          {
            title: 'Ms',
            initial: 'J',
            first_name: 'Jane',
            last_name: 'Smith',
            address_line_1: '456 Oak Ave',
            address_line_2: 'Apt 2B',
            address_line_3: 'Floor 3',
            city: 'Springfield',
            state: 'IL',
            postal_code: '67890',
            country: 'USA',
            membership_type: 'Associate',
            single_or_double: 'Double',
            renewal_date: '2024-11-15'
          }
        ];

        const result = convertMailmergeToCSV(contacts);
        const lines = result.split('\n');
        
        expect(lines.length).toBe(3); // header + 2 data rows
        expect(lines[0]).toBe('title,initial,first_name,last_name,address_line_1,address_line_2,address_line_3,city,state,postal_code,country,membership_type,single_or_double,renewal_date');
        expect(lines[1]).toBe('Mr,J,John,Doe,123 Main St,,,Anytown,CA,12345,USA,Full,Single,2024-12-31');
        expect(lines[2]).toBe('Ms,J,Jane,Smith,456 Oak Ave,Apt 2B,Floor 3,Springfield,IL,67890,USA,Associate,Double,2024-11-15');
      });

      it('should escape CSV fields with commas and quotes', () => {
        const contacts: MailmergeContact[] = [{
          title: 'Dr.',
          initial: 'M',
          first_name: 'Mary, Jane',
          last_name: 'O\'Connor "Bob"',
          address_line_1: '123 Main St, Apt 4',
          address_line_2: 'Building "A"',
          address_line_3: 'Floor 2, Room "B"',
          city: 'San Francisco',
          state: 'CA',
          postal_code: '94102',
          country: 'USA',
          membership_type: 'Full',
          single_or_double: 'Double',
          renewal_date: '2024-12-31'
        }];

        const result = convertMailmergeToCSV(contacts);
        const lines = result.split('\n');
        
        expect(lines[1]).toBe('Dr.,M,"Mary, Jane","O\'Connor ""Bob""","123 Main St, Apt 4","Building ""A""","Floor 2, Room ""B""",San Francisco,CA,94102,USA,Full,Double,2024-12-31');
      });

      it('should handle empty field values', () => {
        const contacts: MailmergeContact[] = [{
          title: '',
          initial: '',
          first_name: '',
          last_name: 'Smith',
          address_line_1: '',
          address_line_2: '',
          address_line_3: '',
          city: '',
          state: '',
          postal_code: '',
          country: '',
          membership_type: 'Associate',
          single_or_double: '',
          renewal_date: ''
        }];

        const result = convertMailmergeToCSV(contacts);
        const lines = result.split('\n');
        
        expect(lines[1]).toBe(',,,Smith,,,,,,,,Associate,,');
      });
    });

    describe('Mailmerge Integration', () => {
      it('should produce complete mailmerge-compatible CSV format', () => {
        const mockContact = {
          id: 'integration-mailmerge',
          firstName: 'Integration',
          lastName: 'Test',
          address1: '789 Test Ave',
          address2: 'Floor 5', // This won't be used
          city: 'Test City',
          state: 'TX',
          postalCode: '75001',
          country: 'USA',
          membershipType: 'Full',
          renewal_date: '2025-01-01',
          customFields: [
            { id: 'xNIBnbcu4NJ008JLUWGF', value: 'Dr' },
            { id: 'PEyv7RkguJ3IwYQdQlkR', value: 'Floor 5' },
            { id: 'dTKWIDeFBg9MI1MQ65vi', value: 'Room 101' },
            { id: 'hJQPtsVDFBxI1USEN83v', value: 'Single' }
          ]
        };

        const mailmergeContact = contactToMailmergeData(mockContact);
        const csv = convertMailmergeToCSV([mailmergeContact]);
        const lines = csv.split('\n');

        // Verify header format
        expect(lines[0]).toBe('title,initial,first_name,last_name,address_line_1,address_line_2,address_line_3,city,state,postal_code,country,membership_type,single_or_double,renewal_date');
        
        // Verify data format
        expect(lines[1]).toBe('Dr,I,Integration,Test,789 Test Ave,Floor 5,Room 101,Test City,TX,75001,USA,Full,Single,2025-01-01');
      });

      it('should handle international addresses', () => {
        const mockContact = {
          id: 'international-test',
          firstName: 'Pierre',
          lastName: 'Dubois',
          address1: '15 Rue de la Paix',
          address2: '', // This won't be used
          city: 'Paris',
          state: 'Île-de-France',
          postalCode: '75001',
          country: 'France',
          membershipType: 'Associate',
          customFields: [
            { id: 'xNIBnbcu4NJ008JLUWGF', value: 'M.' },
            { id: 'PEyv7RkguJ3IwYQdQlkR', value: '' }, // Empty address line 2
            { id: 'dTKWIDeFBg9MI1MQ65vi', value: '' }, // Empty address line 3
            { id: 'hJQPtsVDFBxI1USEN83v', value: 'Double' }
          ]
        };

        const mailmergeContact = contactToMailmergeData(mockContact);
        const csv = convertMailmergeToCSV([mailmergeContact]);
        const lines = csv.split('\n');
        
        expect(lines[1]).toBe('M.,P,Pierre,Dubois,15 Rue de la Paix,,,Paris,Île-de-France,75001,France,Associate,Double,');
      });

      it('should sort contacts by last_name then first_name', () => {
        // Create mock contacts in unsorted order
        const contacts: MailmergeContact[] = [
          {
            title: 'Ms',
            initial: 'J',
            first_name: 'Jane',
            last_name: 'Smith',
            address_line_1: '456 Oak Ave',
            address_line_2: '',
            address_line_3: '',
            city: 'Springfield',
            state: 'IL',
            postal_code: '67890',
            country: 'USA',
            membership_type: 'Associate',
            single_or_double: 'Double',
            renewal_date: '2024-11-15'
          },
          {
            title: 'Mr',
            initial: 'B',
            first_name: 'Bob',
            last_name: 'Johnson',
            address_line_1: '789 Pine St',
            address_line_2: '',
            address_line_3: '',
            city: 'Riverside',
            state: 'CA',
            postal_code: '92501',
            country: 'USA',
            membership_type: 'Full',
            single_or_double: 'Single',
            renewal_date: '2024-10-01'
          },
          {
            title: 'Ms',
            initial: 'A',
            first_name: 'Alice',
            last_name: 'Johnson',
            address_line_1: '321 Elm St',
            address_line_2: '',
            address_line_3: '',
            city: 'Riverside',
            state: 'CA',
            postal_code: '92502',
            country: 'USA',
            membership_type: 'Full',
            single_or_double: 'Single',
            renewal_date: '2024-09-15'
          }
        ];

        // Sort manually to verify expected order
        const sortedContacts = [...contacts].sort((a, b) => {
          const lastNameCompare = a.last_name.localeCompare(b.last_name);
          if (lastNameCompare !== 0) {
            return lastNameCompare;
          }
          return a.first_name.localeCompare(b.first_name);
        });

        const result = convertMailmergeToCSV(sortedContacts);
        const lines = result.split('\n');
        
        // Expected order: Alice Johnson, Bob Johnson, Jane Smith
        expect(lines[1]).toContain('Alice,Johnson');
        expect(lines[2]).toContain('Bob,Johnson');
        expect(lines[3]).toContain('Jane,Smith');
      });
    });
  });
});