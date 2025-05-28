const { Contact } = require('@prisma/client');

const GHL_API_KEY = process.env.GHL_API_KEY;
const GHL_API_BASE = 'https://rest.gohighlevel.com/v1';

if (!GHL_API_KEY) {
  throw new Error('Missing GHL_API_KEY environment variable');
}

const defaultRetryConfig = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
};

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(
  url,
  options,
  retryConfig = defaultRetryConfig
) {
  let lastError = null;
  let delayMs = retryConfig.initialDelay;

  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${GHL_API_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response;
    } catch (error) {
      lastError = error;
      if (attempt === retryConfig.maxRetries) break;

      await delay(delayMs);
      delayMs = Math.min(delayMs * 2, retryConfig.maxDelay);
    }
  }

  throw lastError || new Error('Failed to fetch after retries');
}

async function fetchContactFromGHL(contactId) {
  const response = await fetchWithRetry(
    `${GHL_API_BASE}/contacts/${contactId}`,
    { method: 'GET' }
  );
  return response.json();
}

async function updateContactInGHL(contactId, data) {
  const response = await fetchWithRetry(
    `${GHL_API_BASE}/contacts/${contactId}`,
    {
      method: 'PUT',
      body: JSON.stringify(data),
    }
  );
  return response.json();
}

async function fetchAllContactsFromGHL(page = 1, limit = 100) {
  const response = await fetchWithRetry(
    `${GHL_API_BASE}/contacts?page=${page}&limit=${limit}&include_custom_fields=true`,
    { method: 'GET' }
  );
  return response.json();
}

function mapGHLContactToPrisma(ghlContact) {
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
    customFields: ghlContact.customField || null,
    ghlUpdatedAt: ghlContact.updatedAt ? new Date(ghlContact.updatedAt) : null,
    lastSyncedAt: new Date(),
  };
}

module.exports = {
  fetchContactFromGHL,
  updateContactInGHL,
  fetchAllContactsFromGHL,
  mapGHLContactToPrisma,
}; 