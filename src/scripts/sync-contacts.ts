require('dotenv').config({ path: '.env.local' });
import { fetchAllContactsFromGHL, mapGHLContactToPrisma } from '../lib/ghl-api';
import { prisma } from '../lib/prisma';
import type { Prisma } from '@prisma/client';

async function main() {
  try {
    console.log('Starting contact sync...');
    let page = 1;
    let hasMore = true;
    const limit = 100;
    let totalContacts = 0;
    let totalUpdated = 0;
    let totalCreated = 0;

    while (hasMore) {
      console.log(`\nFetching page ${page}...`);
      const response = await fetchAllContactsFromGHL(page, limit);
      const contacts = response.contacts || [];
      
      if (contacts.length === 0) {
        hasMore = false;
        continue;
      }

      totalContacts += contacts.length;
      console.log(`Processing ${contacts.length} contacts from page ${page}`);

      for (const contact of contacts) {
        const prismaContact = mapGHLContactToPrisma(contact);
        const existingContact = await prisma.contact.findUnique({
          where: { id: contact.id }
        });

        const contactData = {
          ...prismaContact,
          id: contact.id,
          customFields: prismaContact.customFields as Prisma.InputJsonValue
        };

        if (existingContact) {
          await prisma.contact.update({
            where: { id: contact.id },
            data: contactData
          });
          totalUpdated++;
        } else {
          await prisma.contact.create({
            data: contactData
          });
          totalCreated++;
        }
      }

      // Check if we've reached the last page
      hasMore = contacts.length === limit;
      page++;
    }

    console.log('\nContact sync completed successfully');
    console.log(`Total contacts processed: ${totalContacts}`);
    console.log(`Contacts updated: ${totalUpdated}`);
    console.log(`Contacts created: ${totalCreated}`);
  } catch (error) {
    console.error('Error syncing contacts:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main(); 