import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();
const GHL_API_KEY = process.env.GHL_API_KEY;

if (!GHL_API_KEY) {
  throw new Error('Missing GHL_API_KEY environment variable');
}

async function fetchAllContactsFromGHL() {
  let allContacts: any[] = [];
  let page = 1;
  let hasMore = true;
  const limit = 100;

  while (hasMore && page <= 20) { // Safety limit of 20 pages
    const res = await fetch(
      `https://rest.gohighlevel.com/v1/contacts?` +
      `page=${page}&limit=${limit}` +
      `&include_custom_fields=true`,
      {
        headers: {
          Authorization: `Bearer ${GHL_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!res.ok) {
      throw new Error(`Failed to fetch contacts: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    const contacts = data.contacts || [];
    
    allContacts = allContacts.concat(contacts);
    hasMore = contacts.length === limit;
    page++;
    
    console.log(`Fetched page ${page - 1}, got ${contacts.length} contacts`);
  }

  return allContacts;
}

async function syncContacts() {
  try {
    console.log('Starting contact sync...');
    
    // Fetch all contacts from GHL
    const contacts = await fetchAllContactsFromGHL();
    console.log(`Fetched ${contacts.length} contacts from GHL`);

    // Process contacts in batches to avoid overwhelming the database
    const batchSize = 50;
    for (let i = 0; i < contacts.length; i += batchSize) {
      const batch = contacts.slice(i, i + batchSize);
      
      // Upsert each contact in the batch
      await Promise.all(
        batch.map(async (contact) => {
          const customFields = contact.customField || {};
          
          await prisma.contact.upsert({
            where: { id: contact.id },
            update: {
              firstName: contact.firstName || null,
              lastName: contact.lastName || null,
              email: contact.email || null,
              phone: contact.phone || null,
              membershipType: customFields.gH97LlNC9Y4PlkKVlY8V || null, // Membership Type field ID
              updatedAt: new Date(),
            },
            create: {
              id: contact.id,
              firstName: contact.firstName || null,
              lastName: contact.lastName || null,
              email: contact.email || null,
              phone: contact.phone || null,
              membershipType: customFields.gH97LlNC9Y4PlkKVlY8V || null, // Membership Type field ID
            },
          });
        })
      );
      
      console.log(`Processed batch ${i / batchSize + 1} of ${Math.ceil(contacts.length / batchSize)}`);
    }

    console.log('Contact sync completed successfully');
  } catch (error) {
    console.error('Error syncing contacts:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the sync
syncContacts().catch(console.error); 