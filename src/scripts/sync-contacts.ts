require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const { fetchAllContactsFromGHL, mapGHLContactToPrisma } = require('../lib/ghl-api.js');

const prisma = new PrismaClient();

async function syncContacts() {
  try {
    console.log('Starting contact sync...');
    let page = 1;
    let hasMore = true;
    let totalSynced = 0;

    while (hasMore) {
      console.log(`Fetching page ${page}...`);
      const response = await fetchAllContactsFromGHL(page);
      const contacts = response.contacts || [];

      if (contacts.length === 0) {
        hasMore = false;
        continue;
      }

      console.log(`Processing ${contacts.length} contacts...`);

      for (const ghlContact of contacts) {
        const contactData = mapGHLContactToPrisma(ghlContact);
        
        await prisma.contact.upsert({
          where: { id: contactData.id },
          update: contactData,
          create: contactData,
        });
      }

      totalSynced += contacts.length;
      console.log(`Synced ${totalSynced} contacts so far...`);
      
      page++;
    }

    console.log('Contact sync completed successfully!');
    console.log(`Total contacts synced: ${totalSynced}`);
  } catch (error) {
    console.error('Error syncing contacts:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

syncContacts(); 