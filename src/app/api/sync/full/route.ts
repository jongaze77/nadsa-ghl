import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { fetchAllContactsFromGHL, mapGHLContactToPrisma, fetchContactFromGHL } from '@/lib/ghl-api';

const prisma = new PrismaClient();

interface SyncResult {
  success: boolean;
  contactsProcessed: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  duration: number;
  errorDetails?: string[];
}

// Authentication check for cron endpoints
function validateCronRequest(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const vercelCronSecret = process.env.CRON_SECRET;

  // Allow Vercel cron requests
  if (request.headers.get('user-agent')?.includes('vercel-cron')) {
    return true;
  }

  // Allow requests with valid CRON_SECRET
  if (vercelCronSecret && authHeader === `Bearer ${vercelCronSecret}`) {
    return true;
  }

  return false;
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const errorDetails: string[] = [];
  let syncOperation: any = null;

  try {
    console.log('[FULL-SYNC] Starting full reconciliation sync...');

    // Validate request authentication
    if (!validateCronRequest(request)) {
      console.log('[FULL-SYNC] Unauthorized request');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Create sync operation record
    syncOperation = await prisma.syncOperation.create({
      data: {
        type: 'full',
        status: 'running',
        startedAt: new Date()
      }
    });

    let totalCreated = 0;
    let totalUpdated = 0;
    let totalErrors = 0;
    let totalSkippedSpammers = 0;

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
        const errorMsg = `Error fetching contacts from GHL on page ${page}: ${e instanceof Error ? e.message : e}`;
        console.error(`[FULL-SYNC] ${errorMsg}`);
        errorDetails.push(errorMsg);
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

    console.log(`[FULL-SYNC] Found ${allContacts.length} contacts in GHL`);

    const total = allContacts.length;
    let processed = 0;

    for (const [i, contact] of allContacts.entries()) {
      processed = i + 1;

      // Show progress every 25 contacts, and for first/last contact
      if (processed === 1 || processed === total || processed % 25 === 0) {
        console.log(
          `[FULL-SYNC] [${processed}/${total}] Syncing contact: ${contact.firstName || ''} ${contact.lastName || ''} (${contact.id})`
        );
      }

      let correctGhlContact = contact;
      try {
        // This fetch gets the most up-to-date/correct contact from GHL
        correctGhlContact = await fetchContactFromGHL(contact.id);
      } catch (e) {
        console.warn(
          `[FULL-SYNC] Couldn't fetch full GHL contact for id ${contact.id}, using paged data`
        );
        totalErrors++;
        errorDetails.push(`Couldn't fetch full contact data for ${contact.id}`);
      }

      try {
        // Defensive: If GHL API returns {contact: {...}}, unwrap it
        const source = correctGhlContact.contact || correctGhlContact;

        // Skip contacts with "spammer" tag
        const contactTags = source.tags || [];
        if (contactTags.includes('spammer')) {
          console.log(`[FULL-SYNC] Skipping contact with "spammer" tag: ${source.firstName || ''} ${source.lastName || ''} (${source.id})`);
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
          customFields: prismaContact.customFields as any,
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
        const errorMsg = `Error syncing contact ${contact.id}: ${err instanceof Error ? err.message : err}`;
        console.error(`[FULL-SYNC] ${errorMsg}`);
        errorDetails.push(errorMsg);
        totalErrors++;
      }
    }

    const duration = Date.now() - startTime;

    // Update sync operation record
    await prisma.syncOperation.update({
      where: { id: syncOperation.id },
      data: {
        status: 'success',
        completedAt: new Date(),
        duration,
        contactsProcessed: total,
        contactsCreated: totalCreated,
        contactsUpdated: totalUpdated,
        contactsSkipped: totalSkippedSpammers,
        errors: totalErrors,
        errorDetails: errorDetails.length > 0 ? errorDetails : undefined
      }
    });

    console.log('[FULL-SYNC] Full sync completed');
    console.log(`[FULL-SYNC] Created: ${totalCreated}`);
    console.log(`[FULL-SYNC] Updated: ${totalUpdated}`);
    console.log(`[FULL-SYNC] Skipped (spammers): ${totalSkippedSpammers}`);
    console.log(`[FULL-SYNC] Errors: ${totalErrors}`);
    console.log(`[FULL-SYNC] Duration: ${duration}ms`);

    const result: SyncResult = {
      success: true,
      contactsProcessed: total,
      created: totalCreated,
      updated: totalUpdated,
      skipped: totalSkippedSpammers,
      errors: totalErrors,
      duration,
      errorDetails: errorDetails.length > 0 ? errorDetails : undefined
    };

    return NextResponse.json(result);

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    console.error('[FULL-SYNC] Sync failed:', error);

    // Update sync operation record on failure
    if (syncOperation) {
      try {
        await prisma.syncOperation.update({
          where: { id: syncOperation.id },
          data: {
            status: 'failed',
            completedAt: new Date(),
            duration,
            errors: 1,
            errorDetails: [errorMessage]
          }
        });
      } catch (updateError) {
        console.error('[FULL-SYNC] Failed to update sync operation record:', updateError);
      }
    }

    const result: SyncResult = {
      success: false,
      contactsProcessed: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: 1,
      duration,
      errorDetails: [errorMessage]
    };

    return NextResponse.json(result, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}