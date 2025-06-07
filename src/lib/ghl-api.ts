// src/lib/ghl-api.ts

import type { Contact } from '.prisma/client';

const GHL_API_BASE = 'https://rest.gohighlevel.com/v1';
const MEMBERSHIP_TYPE_ID = "gH97LlNC9Y4PlkKVlY8V"; // Custom field ID for Membership Type

// Map GHL field-id -> form key
export const FIELD_MAP: Record<string, string> = {
  gH97LlNC9Y4PlkKVlY8V: 'membership_type',
  hJQPtsVDFBxI1USEN83v: 'single_or_double_membership',
  w52V1FONYrhH0LUqDjBs: 'membership_start_date',
  cWMPNiNAfReHOumOhBB2: 'renewal_date',
  ojKOz9HxslwVJaBMqcAF: 'renewal_reminder',
  vJKGn7dzbGmmLUfzp0KY: 'standing_order',
  ABzFclt09Z30eBalbPKH: 'gift_aid',
  YvpMtidXnXFqJnii5sqH: 'marketing_email_consent',
  xNIBnbcu4NJ008JLUWGF: 'title',
  PEyv7RkguJ3IwYQdQlkR: 'address2',
  dTKWIDeFBg9MI1MQ65vi: 'address3',
};

interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
}

const defaultRetryConfig: RetryConfig = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
};

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function getApiKey() {
  return process.env.GHL_API_KEY || "";
}

export function getLocationId() {
  return process.env.GHL_LOCATION_ID || "";
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retryConfig: RetryConfig = defaultRetryConfig
): Promise<Response> {
  let lastError: Error | null = null;
  let delayMs = retryConfig.initialDelay;

  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${getApiKey()}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response;
    } catch (error) {
      lastError = error as Error;
      if (attempt === retryConfig.maxRetries) break;

      await delay(delayMs);
      delayMs = Math.min(delayMs * 2, retryConfig.maxDelay);
    }
  }

  throw lastError || new Error('Failed to fetch after retries');
}

export async function fetchContactFromGHL(contactId: string): Promise<any> {
  const response = await fetchWithRetry(
    `${GHL_API_BASE}/contacts/${contactId}`,
    { method: 'GET' }
  );
  return response.json();
}

export async function updateContactInGHL(contactId: string, data: Partial<Contact>): Promise<any> {
  const response = await fetchWithRetry(
    `${GHL_API_BASE}/contacts/${contactId}`,
    {
      method: 'PUT',
      body: JSON.stringify(data),
    }
  );
  return response.json();
}

export async function fetchAllContactsFromGHL(page: number = 1, limit: number = 100): Promise<any> {
  const response = await fetchWithRetry(
    `${GHL_API_BASE}/contacts?page=${page}&limit=${limit}&include_custom_fields=true`,
    { method: 'GET' }
  );
  const raw = await response.text();
  // Log raw response here!
  if (page === 1) {
    console.log('RAW GHL API RESPONSE:', raw.slice(0, 1000)); // print first 1000 chars for privacy
  }
  const data = JSON.parse(raw);
  return data;
}

function normalizeMembershipType(mt: string | null | undefined): string {
  if (!mt) return '';
  const normal = mt.trim().toLowerCase().replace(/member$/i, '').trim();
  
  // Map to canonical values
  if (normal.startsWith('full')) return 'Full';
  if (normal.startsWith('associate')) return 'Associate';
  if (normal.startsWith('newsletter')) return 'Newsletter Only';
  if (normal.startsWith('ex')) return 'Ex Member';
  
  return mt.trim(); // Return original if no match
}

function extractMembershipType(ghlContact: any): string | null {
  const MEMBERSHIP_TYPE_ID = "gH97LlNC9Y4PlkKVlY8V";
  const possibleCF =
    ghlContact.customField ||
    ghlContact.customFields ||
    (ghlContact.contact && (ghlContact.contact.customField || ghlContact.contact.customFields));
  let membershipType = null;

  if (possibleCF) {
    if (typeof possibleCF === 'object' && !Array.isArray(possibleCF)) {
      membershipType = possibleCF[MEMBERSHIP_TYPE_ID];
    } else if (Array.isArray(possibleCF)) {
      const membershipField = possibleCF.find(
        (f: any) => f.id === MEMBERSHIP_TYPE_ID
      );
      if (membershipField) {
        membershipType = membershipField.value;
      }
    }
  }

  return normalizeMembershipType(membershipType);
}

export function mapGHLContactToPrisma(ghlContact: any): Partial<Contact> {
  // Support multiple possible sources for id
  const id =
    ghlContact.id ||
    ghlContact.contact_id ||
    (ghlContact.customData && ghlContact.customData.id) ||
    (ghlContact.contact && ghlContact.contact.id);

  // Use the whole object as the "contact"
  const contact = { ...ghlContact, id };

  return {
    id: contact.id,
    firstName: contact.firstName || contact.first_name || null,
    lastName: contact.lastName || contact.last_name || null,
    email: contact.email || null,
    phone: contact.phone || null,
    name: contact.name || contact.full_name || null,
    companyName: contact.companyName || null,
    address1: contact.address1 || null,
    address2: contact.address2 || null,
    city: contact.city || null,
    state: contact.state || null,
    postalCode: contact.postalCode || null,
    country: contact.country || null,
    website: contact.website || null,
    source: contact.source || null,
    tags: contact.tags || [],
    membershipType: extractMembershipType(ghlContact),
    customFields:
      contact.customField || contact.customFields || contact.customData || null,
    ghlUpdatedAt: contact.updatedAt
      ? new Date(contact.updatedAt)
      : null,
    lastSyncedAt: new Date(),
  };
}


export interface FieldChange {
  field: string;
  oldValue: string | null;
  newValue: string | null;
}

// Helper function for reliable server-side logging
function log(message: string) {
  process.stdout.write(message + '\n');
}

export function trackContactChanges(oldContact: any, newContact: any): FieldChange[] {
  // Define standard fields at the top
  const standardFields = [
    'firstName', 'lastName', 'email', 'phone', 'address1', 'address2', 'address3',
    'postalCode', 'city', 'state', 'country', 'companyName', 'website',
    'membershipType'  // Added membershipType to track changes
  ];

  log('\n🔍 ===== COMPARING CONTACTS =====');
  log(`Old contact: ${JSON.stringify({
    id: oldContact.id,
    customFields: oldContact.customFields,
    ...Object.fromEntries(standardFields.map(f => [f, oldContact[f]]))
  }, null, 2)}`);
  log(`New contact: ${JSON.stringify({
    id: newContact.id,
    customFields: newContact.customFields,
    ...Object.fromEntries(standardFields.map(f => [f, newContact[f]]))
  }, null, 2)}`);

  const changes: FieldChange[] = [];

  // Track standard fields
  standardFields.forEach(field => {
    const oldValue = oldContact[field] || null;
    const newValue = newContact[field] || null;
    if (oldValue !== newValue) {
      log(`📝 Standard field change: ${field} - Old: "${oldValue}", New: "${newValue}"`);
      changes.push({ field, oldValue, newValue });
    }
  });

  // Track custom fields
  const oldCustomFields = oldContact.customFields || {};
  const newCustomFields = newContact.customFields || {};

  log('\n📋 Custom fields comparison:');
  log(`Old custom fields: ${JSON.stringify(oldCustomFields, null, 2)}`);
  log(`New custom fields: ${JSON.stringify(newCustomFields, null, 2)}`);

  // Handle both array and object formats of custom fields
  const oldFields = Array.isArray(oldCustomFields) 
    ? oldCustomFields.reduce((acc: any, cf: any) => ({ ...acc, [cf.id]: cf.value }), {})
    : oldCustomFields;

  const newFields = Array.isArray(newCustomFields)
    ? newCustomFields.reduce((acc: any, cf: any) => ({ ...acc, [cf.id]: cf.value }), {})
    : newCustomFields;

  log('\n🔄 Processed custom fields:');
  log(`Old fields: ${JSON.stringify(oldFields, null, 2)}`);
  log(`New fields: ${JSON.stringify(newFields, null, 2)}`);

  // Compare all custom fields
  const allFieldIds = new Set([...Object.keys(oldFields), ...Object.keys(newFields)]);
  allFieldIds.forEach(fieldId => {
    const oldValue = oldFields[fieldId] || null;
    const newValue = newFields[fieldId] || null;
    if (oldValue !== newValue) {
      log(`📝 Custom field change: ${fieldId} - Old: "${oldValue}", New: "${newValue}"`);
      // Use the field ID as the field name since we don't have a mapping
      changes.push({ field: fieldId, oldValue, newValue });
    }
  });

  log('\n📊 Summary:');
  log(`Total changes detected: ${changes.length}`);
  log(`Changes: ${JSON.stringify(changes, null, 2)}`);
  log('🔍 ===== COMPARISON COMPLETE =====\n');

  return changes;
}