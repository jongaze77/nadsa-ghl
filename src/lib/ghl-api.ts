import { Contact } from '@prisma/client';

const GHL_API_BASE = 'https://rest.gohighlevel.com/v1';
const MEMBERSHIP_TYPE_ID = "gH97LlNC9Y4PlkKVlY8V"; // Custom field ID for Membership Type

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

function getApiKey(): string {
  const key = process.env.GHL_API_KEY;
  if (!key) {
    throw new Error('Missing GHL_API_KEY environment variable');
  }
  return key;
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
  return response.json();
}

export function mapGHLContactToPrisma(ghlContact: any): Partial<Contact> {
  // Extract membership type from custom fields
  let membershipType = null;
  if (ghlContact.customField) {
    if (typeof ghlContact.customField === 'object' && !Array.isArray(ghlContact.customField)) {
      membershipType = ghlContact.customField[MEMBERSHIP_TYPE_ID];
    } else if (Array.isArray(ghlContact.customField)) {
      const membershipField = ghlContact.customField.find((cf: any) => cf.id === MEMBERSHIP_TYPE_ID);
      if (membershipField) {
        membershipType = membershipField.value;
      }
    }
  }

  return {
    id: ghlContact.id,
    firstName: ghlContact.firstName || null,
    lastName: ghlContact.lastName || null,
    email: ghlContact.email || null,
    phone: ghlContact.phone || null,
    name: ghlContact.name || null,
    companyName: ghlContact.companyName || null,
    address1: ghlContact.address1 || null,
    address2: ghlContact.address2 || null,
    city: ghlContact.city || null,
    state: ghlContact.state || null,
    postalCode: ghlContact.postalCode || null,
    country: ghlContact.country || null,
    website: ghlContact.website || null,
    source: ghlContact.source || null,
    tags: ghlContact.tags || [],
    membershipType: membershipType,
    customFields: ghlContact.customField || null,
    ghlUpdatedAt: ghlContact.updatedAt ? new Date(ghlContact.updatedAt) : null,
    lastSyncedAt: new Date(),
  };
} 