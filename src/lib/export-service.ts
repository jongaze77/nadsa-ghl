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

export interface MailmergeContact {
  title: string;
  initial: string;
  first_name: string;
  last_name: string;
  address_line_1: string;
  address_line_2: string;
  address_line_3: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  membership_type: string;
  single_or_double: string;
  renewal_date: string;
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
    return 'subscriber,single_member';
  } else if (normalizedValue === 'double') {
    return 'subscriber,double_member';
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

/**
 * Filters contacts for mailmerge export based on membership type
 * - membershipType IN ("Full", "Associate")
 * - Includes contacts with required fields for mailing
 */
export async function getFilteredMailmergeContacts(): Promise<any[]> {
  try {
    // Get contacts with membershipType "Full" or "Associate"
    const contacts = await prisma.contact.findMany({
      where: {
        membershipType: {
          in: ["Full", "Associate"]
        },
        // Filter for contacts with required name fields
        firstName: { not: null },
        lastName: { not: null }
      }
    });

    return contacts;
  } catch (error) {
    console.error('Error filtering mailmerge contacts:', error);
    throw new Error('Failed to filter contacts for mailmerge export');
  }
}

/**
 * Get mailmerge export preview with count of matching contacts
 */
export async function getMailmergeExportPreview(): Promise<ExportPreview> {
  try {
    const filteredContacts = await getFilteredMailmergeContacts();
    
    return {
      count: filteredContacts.length,
      criteria: 'Membership Type = "Full" OR "Associate"'
    };
  } catch (error) {
    console.error('Error getting mailmerge export preview:', error);
    throw error;
  }
}

/**
 * Convert contact to mailmerge format with address and membership details
 */
export function contactToMailmergeData(contact: any): MailmergeContact {
  const firstName = contact.firstName || '';
  const lastName = contact.lastName || '';
  
  // Calculate initial from first letter of first name, uppercase
  const initial = firstName.length > 0 ? firstName.charAt(0).toUpperCase() : '';
  
  // Address field mapping with null handling
  const addressLine1 = contact.address1 || '';
  // Address Line 2 and 3 come from custom fields, not the standard contact fields
  const addressLine2 = getCustomFieldValue(contact.customFields, 'PEyv7RkguJ3IwYQdQlkR') || '';
  const addressLine3 = getCustomFieldValue(contact.customFields, 'dTKWIDeFBg9MI1MQ65vi') || '';
  const city = contact.city || '';
  const state = contact.state || '';
  const postalCode = contact.postalCode || '';
  const country = contact.country || '';
  
  // Get title from customFields array structure
  const titleValue = getCustomFieldValue(contact.customFields, 'xNIBnbcu4NJ008JLUWGF') || '';
  
  // Get single/double membership from customFields array structure
  const singleOrDoubleValue = getCustomFieldValue(contact.customFields, 'hJQPtsVDFBxI1USEN83v') || '';
  
  // Get renewal date - try extracted field first, then customFields fallback
  let renewalDate = '';
  if (contact.renewal_date) {
    renewalDate = contact.renewal_date;
  } else if (contact.customFields) {
    renewalDate = getCustomFieldValue(contact.customFields, 'cWMPNiNAfReHOumOhBB2') || '';
  }
  
  return {
    title: titleValue,
    initial: initial,
    first_name: firstName,
    last_name: lastName,
    address_line_1: addressLine1,
    address_line_2: addressLine2,
    address_line_3: addressLine3,
    city: city,
    state: state,
    postal_code: postalCode,
    country: country,
    membership_type: contact.membershipType || '',
    single_or_double: singleOrDoubleValue,
    renewal_date: renewalDate
  };
}

/**
 * Generate mailmerge contacts export data
 */
export async function generateMailmergeExport(): Promise<MailmergeContact[]> {
  try {
    const filteredContacts = await getFilteredMailmergeContacts();
    
    const mailmergeContacts = filteredContacts.map(contact => contactToMailmergeData(contact));
    
    // Sort by last_name (primary) then first_name (secondary)
    mailmergeContacts.sort((a, b) => {
      const lastNameCompare = a.last_name.localeCompare(b.last_name);
      if (lastNameCompare !== 0) {
        return lastNameCompare;
      }
      return a.first_name.localeCompare(b.first_name);
    });
    
    return mailmergeContacts;
  } catch (error) {
    console.error('Error generating mailmerge export:', error);
    throw error;
  }
}

/**
 * Convert mailmerge contacts to CSV format
 */
export function convertMailmergeToCSV(contacts: MailmergeContact[]): string {
  if (contacts.length === 0) {
    return 'title,initial,first_name,last_name,address_line_1,address_line_2,address_line_3,city,state,postal_code,country,membership_type,single_or_double,renewal_date\n';
  }

  // CSV Header
  const headers = [
    'title', 'initial', 'first_name', 'last_name', 'address_line_1', 'address_line_2', 'address_line_3',
    'city', 'state', 'postal_code', 'country', 
    'membership_type', 'single_or_double', 'renewal_date'
  ];
  const headerRow = headers.join(',');
  
  // CSV Data rows
  const dataRows = contacts.map(contact => {
    return [
      escapeCsvField(contact.title),
      escapeCsvField(contact.initial),
      escapeCsvField(contact.first_name),
      escapeCsvField(contact.last_name),
      escapeCsvField(contact.address_line_1),
      escapeCsvField(contact.address_line_2),
      escapeCsvField(contact.address_line_3),
      escapeCsvField(contact.city),
      escapeCsvField(contact.state),
      escapeCsvField(contact.postal_code),
      escapeCsvField(contact.country),
      escapeCsvField(contact.membership_type),
      escapeCsvField(contact.single_or_double),
      escapeCsvField(contact.renewal_date)
    ].join(',');
  });
  
  return [headerRow, ...dataRows].join('\n');
}

/**
 * Generate complete CSV export for mailmerge contacts
 */
export async function generateMailmergeCSV(): Promise<string> {
  try {
    const contacts = await generateMailmergeExport();
    return convertMailmergeToCSV(contacts);
  } catch (error) {
    console.error('Error generating mailmerge CSV:', error);
    throw error;
  }
}