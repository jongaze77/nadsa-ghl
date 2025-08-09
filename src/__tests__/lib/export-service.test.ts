// src/__tests__/lib/export-service.test.ts

import {
  mapContactRole,
  contactToWordPressUser,
  convertToCSV,
  WordPressUser
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
});