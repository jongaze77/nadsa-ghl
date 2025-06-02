require('dotenv').config({ path: '.env.local' });
import { PrismaClient } from '@prisma/client';
import { fetchAllContactsFromGHL, mapGHLContactToPrisma, fetchContactFromGHL } from '../lib/ghl-api';
import type { Prisma } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting contact sync...');
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalErrors = 0;

  try {
    // --- Fetch all contacts from all pages ---
    let page = 1;
    let hasMore = true;
    const limit = 100;
    const allContacts: any[] = [];

    while (hasMore) {
      const response = await fetchAllContactsFromGHL(page, limit);
      const contacts = response.contacts || [];
      if (contacts.length === 0) break;
      allContacts.push(...contacts);

      hasMore = response.pagination
        ? response.pagination.page < response.pagination.totalPages
        : contacts.length === limit;
      page++;
    }
    console.log(`Found ${allContacts.length} contacts in GHL`);

    const total = allContacts.length;
    let processed = 0;

    for (const [i, contact] of allContacts.entries()) {
      processed = i + 1;
      // Show progress every 10, and for first/last contact
      if (processed === 1 || processed === total || processed % 10 === 0) {
        console.log(
          `[${processed}/${total}] Syncing contact: ${contact.firstName || ''} ${contact.lastName || ''} (${contact.id})`
        );
      }
      let correctGhlContact = contact;
      try {
        correctGhlContact = await fetchContactFromGHL(contact.id);
      } catch (e) {
        console.warn(
          `  ⚠️  Couldn't fetch case-corrected GHL contact for id ${contact.id}, using paged data`
        );
        totalErrors++;
      }
      try {
        const prismaContact = mapGHLContactToPrisma(correctGhlContact);
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
      } catch (err) {
        console.error(
          `  ❌ Error syncing contact ${contact.id}: ${err instanceof Error ? err.message : err}`
        );
        totalErrors++;
      }
    }

    console.log('Sync completed successfully!');
    console.log(`Created: ${totalCreated}`);
    console.log(`Updated: ${totalUpdated}`);
    console.log(`Errors: ${totalErrors}`);

  } catch (error) {
    console.error('Error during sync:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();