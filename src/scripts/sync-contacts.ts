require('dotenv').config({ path: '.env.local' });
import { PrismaClient } from '.prisma/client';
import { fetchAllContactsFromGHL, mapGHLContactToPrisma, fetchContactFromGHL } from '../lib/ghl-api';
import type { Prisma } from '.prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting contact sync...');
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalErrors = 0;
  let totalSkippedSpammers = 0;

  try {
    // --- Fetch all contacts from all pages ---
    let page = 1;
    let hasMore = true;
    const limit = 100;
    const allContacts: any[] = [];

    while (hasMore) {
      let response;
      try {
        response = await fetchAllContactsFromGHL(page, limit);
      } catch (e) {
        console.error(`❌ Error fetching contacts from GHL on page ${page}: ${e instanceof Error ? e.message : e}`);
        break;
      }
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
        // This fetch gets the most up-to-date/correct contact from GHL
        correctGhlContact = await fetchContactFromGHL(contact.id);
      } catch (e) {
        console.warn(
          `  ⚠️  Couldn't fetch full GHL contact for id ${contact.id}, using paged data`
        );
        totalErrors++;
      }
      try {
        // Defensive: If GHL API returns {contact: {...}}, unwrap it
        const source = correctGhlContact.contact || correctGhlContact;

        // Skip contacts with "spammer" tag
        const contactTags = source.tags || [];
        if (contactTags.includes('spammer')) {
          console.log(`  🚫 Skipping contact with "spammer" tag: ${source.firstName || ''} ${source.lastName || ''} (${source.id})`);
          totalSkippedSpammers++;
          continue;
        }

        // Map GHL data to Prisma
        const prismaContact = mapGHLContactToPrisma(source);
        const existingContact = await prisma.contact.findUnique({
          where: { id: source.id }
        });

        const contactData = {
          ...prismaContact,
          id: source.id,
          customFields: prismaContact.customFields as Prisma.InputJsonValue,
          lastSyncedAt: new Date(),
        };

        if (existingContact) {
          await prisma.contact.update({
            where: { id: source.id },
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

    console.log('Sync completed.');
    console.log(`Created: ${totalCreated}`);
    console.log(`Updated: ${totalUpdated}`);
    console.log(`Skipped (spammers): ${totalSkippedSpammers}`);
    console.log(`Errors: ${totalErrors}`);

  } catch (error) {
    console.error('Error during sync:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();