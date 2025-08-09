// src/lib/export-service.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface WordPressUser {
  user_login: string;
  user_email: string;
  role: string;
  first_name: string;
  last_name: string;
}

export interface ExportPreview {
  count: number;
  criteria: string;
}

export interface ContactFilter {
  membershipType: string;
  renewalDateFrom: Date;
}

/**
 * Helper function to find custom field value by ID in the array structure
 */
function getCustomFieldValue(customFields: any, fieldId: string): string | undefined {
  if (!Array.isArray(customFields)) {
    return undefined;
  }
  
  const field = customFields.find((item: any) => item.id === fieldId);
  return field?.value;
}

/**
 * Filters contacts based on WordPress export criteria
 * - membershipType = "Full"
 * - renewal_date >= today's date (using extracted field or customFields)
 */
export async function getFilteredContacts(): Promise<any[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Start of today for comparison

  try {
    // Get contacts with membershipType = "Full" and required fields
    const contacts = await prisma.contact.findMany({
      where: {
        membershipType: "Full",
        // Also filter out contacts without required fields
        firstName: { not: null },
        lastName: { not: null },
        email: { not: null },
      }
    });

    // Filter by renewal date - try extracted field first, then customFields
    const filteredContacts = contacts.filter(contact => {
      let renewalDateValue: string | undefined;
      
      // First try the extracted renewal_date field
      if (contact.renewal_date) {
        renewalDateValue = contact.renewal_date;
      } else if (contact.customFields) {
        // Fallback to customFields array structure
        renewalDateValue = getCustomFieldValue(contact.customFields, 'cWMPNiNAfReHOumOhBB2');
      }

      if (!renewalDateValue) {
        return false;
      }

      // Parse the renewal date
      let renewalDate: Date;
      try {
        renewalDate = new Date(renewalDateValue);
        
        // Validate the date
        if (isNaN(renewalDate.getTime())) {
          console.warn(`Invalid renewal date for contact ${contact.id}:`, renewalDateValue);
          return false;
        }
      } catch (error) {
        console.warn(`Error parsing renewal date for contact ${contact.id}:`, renewalDateValue, error);
        return false;
      }

      // Check if renewal date is >= today
      return renewalDate >= today;
    });

    return filteredContacts;
  } catch (error) {
    console.error('Error filtering contacts:', error);
    throw new Error('Failed to filter contacts for export');
  }
}

/**
 * Get export preview with count of matching contacts
 */
export async function getExportPreview(): Promise<ExportPreview> {
  try {
    const filteredContacts = await getFilteredContacts();
    
    return {
      count: filteredContacts.length,
      criteria: 'Membership Type = "Full" AND Renewal Date >= Today'
    };
  } catch (error) {
    console.error('Error getting export preview:', error);
    throw error;
  }
}

/**
 * Maps contact role field to WordPress role format
 */
export function mapContactRole(singleOrDoubleValue: string): string {
  if (!singleOrDoubleValue) {
    return 'subscriber'; // Default fallback
  }

  const normalizedValue = singleOrDoubleValue.toLowerCase().trim();
  
  if (normalizedValue === 'single') {
    return 'subscriber,Single Member';
  } else if (normalizedValue === 'double') {
    return 'subscriber,Double Member';
  }
  
  // Fallback for unknown values
  return 'subscriber';
}

/**
 * Convert contact to WordPress user format
 */
export function contactToWordPressUser(contact: any): WordPressUser {
  const firstName = contact.firstName || '';
  const lastName = contact.lastName || '';
  const email = contact.email || '';
  
  // Get single/double membership from customFields array structure
  const singleOrDoubleValue = getCustomFieldValue(contact.customFields, 'hJQPtsVDFBxI1USEN83v') || '';
  
  return {
    user_login: `${firstName}${lastName}`.replace(/\s+/g, ''), // Remove any spaces
    user_email: email,
    role: mapContactRole(singleOrDoubleValue),
    first_name: firstName,
    last_name: lastName
  };
}

/**
 * Generate WordPress users export data
 */
export async function generateWordPressUsersExport(): Promise<WordPressUser[]> {
  try {
    const filteredContacts = await getFilteredContacts();
    
    return filteredContacts
      .map(contact => contactToWordPressUser(contact))
      .filter(user => user.user_login && user.user_email); // Filter out invalid entries
  } catch (error) {
    console.error('Error generating WordPress users export:', error);
    throw error;
  }
}

/**
 * Convert WordPress users to CSV format
 */
export function convertToCSV(users: WordPressUser[]): string {
  if (users.length === 0) {
    return 'user_login,user_email,role,first_name,last_name\n';
  }

  // CSV Header
  const headers = ['user_login', 'user_email', 'role', 'first_name', 'last_name'];
  const headerRow = headers.join(',');
  
  // CSV Data rows
  const dataRows = users.map(user => {
    return [
      escapeCsvField(user.user_login),
      escapeCsvField(user.user_email),
      escapeCsvField(user.role),
      escapeCsvField(user.first_name),
      escapeCsvField(user.last_name)
    ].join(',');
  });
  
  return [headerRow, ...dataRows].join('\n');
}

/**
 * Escape CSV field value
 */
function escapeCsvField(value: string): string {
  if (!value) return '';
  
  // If value contains comma, quote, or newline, wrap in quotes and escape internal quotes
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  
  return value;
}

/**
 * Generate complete CSV export for WordPress users
 */
export async function generateWordPressUsersCSV(): Promise<string> {
  try {
    const users = await generateWordPressUsersExport();
    return convertToCSV(users);
  } catch (error) {
    console.error('Error generating WordPress users CSV:', error);
    throw error;
  }
}