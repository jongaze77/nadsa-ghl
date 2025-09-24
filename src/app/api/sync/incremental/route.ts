import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { fetchWithRetry, mapGHLContactToPrisma } from '@/lib/ghl-api';

const GHL_API_BASE = 'https://rest.gohighlevel.com/v1';
const prisma = new PrismaClient();

interface SyncResult {
  success: boolean;
  contactsProcessed: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  duration: number;
  lastSyncTime?: string;
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

async function getLastSuccessfulSync(): Promise<Date | null> {
  try {
    // Get the most recent successful sync timestamp from the most recently synced contact
    const mostRecentContact = await prisma.contact.findFirst({
      orderBy: { lastSyncedAt: 'desc' },
      select: { lastSyncedAt: true }
    });

    return mostRecentContact?.lastSyncedAt || null;
  } catch (error) {
    console.error('[INCREMENTAL-SYNC] Error getting last sync time:', error);
    return null;
  }
}

async function fetchContactsModifiedSince(lastSyncTime: Date): Promise<any[]> {
  const allContacts: any[] = [];
  let page = 1;
  let hasMore = true;
  const limit = 100;

  console.log(`[INCREMENTAL-SYNC] Fetching contacts modified since: ${lastSyncTime.toISOString()}`);

  while (hasMore) {
    try {
      const url = `${GHL_API_BASE}/contacts?updatedAt[gt]=${lastSyncTime.toISOString()}&include_custom_fields=true&page=${page}&limit=${limit}`;

      const response = await fetchWithRetry(url, { method: 'GET' });
      const data = await response.json();

      const contacts = data.contacts || [];
      console.log(`[INCREMENTAL-SYNC] Page ${page}: Found ${contacts.length} modified contacts`);

      if (contacts.length === 0) break;

      allContacts.push(...contacts);

      hasMore = data.pagination
        ? data.pagination.page < data.pagination.totalPages
        : contacts.length === limit;

      page++;
    } catch (error) {
      console.error(`[INCREMENTAL-SYNC] Error fetching page ${page}:`, error);
      throw error;
    }
  }

  console.log(`[INCREMENTAL-SYNC] Total modified contacts found: ${allContacts.length}`);
  return allContacts;
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const errorDetails: string[] = [];
  let syncOperation: any = null;

  try {
    console.log('[INCREMENTAL-SYNC] Starting incremental sync...');

    // Validate request authentication
    if (!validateCronRequest(request)) {
      console.log('[INCREMENTAL-SYNC] Unauthorized request');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Create sync operation record
    syncOperation = await prisma.syncOperation.create({
      data: {
        type: 'incremental',
        status: 'running',
        startedAt: new Date()
      }
    });

    // Get last successful sync timestamp
    const lastSyncTime = await getLastSuccessfulSync();

    if (!lastSyncTime) {
      console.log('[INCREMENTAL-SYNC] No previous sync found, skipping incremental sync');

      // Update sync operation record
      const duration = Date.now() - startTime;
      await prisma.syncOperation.update({
        where: { id: syncOperation.id },
        data: {
          status: 'success',
          completedAt: new Date(),
          duration,
          contactsProcessed: 0,
          contactsCreated: 0,
          contactsUpdated: 0,
          contactsSkipped: 0,
          errors: 0
        }
      });

      return NextResponse.json({
        success: true,
        message: 'No previous sync found, incremental sync skipped',
        contactsProcessed: 0,
        created: 0,
        updated: 0,
        skipped: 0,
        errors: 0,
        duration
      } as SyncResult);
    }

    // Fetch contacts modified since last sync
    const modifiedContacts = await fetchContactsModifiedSince(lastSyncTime);

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    console.log(`[INCREMENTAL-SYNC] Processing ${modifiedContacts.length} modified contacts...`);

    for (const [index, contact] of modifiedContacts.entries()) {
      try {
        // Skip contacts with "spammer" tag
        const contactTags = contact.tags || [];
        if (contactTags.includes('spammer')) {
          console.log(`[INCREMENTAL-SYNC] Skipping spammer contact: ${contact.id}`);
          skipped++;
          continue;
        }

        // Map GHL data to Prisma format
        const prismaContact = mapGHLContactToPrisma(contact);
        const existingContact = await prisma.contact.findUnique({
          where: { id: contact.id }
        });

        const contactData = {
          ...prismaContact,
          id: contact.id,
          customFields: prismaContact.customFields as any,
          lastSyncedAt: new Date(),
        };

        if (existingContact) {
          await prisma.contact.update({
            where: { id: contact.id },
            data: contactData
          });
          updated++;
          console.log(`[INCREMENTAL-SYNC] Updated contact: ${contact.id} (${index + 1}/${modifiedContacts.length})`);
        } else {
          await prisma.contact.create({
            data: contactData
          });
          created++;
          console.log(`[INCREMENTAL-SYNC] Created contact: ${contact.id} (${index + 1}/${modifiedContacts.length})`);
        }

      } catch (error) {
        errors++;
        const errorMsg = `Error processing contact ${contact.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(`[INCREMENTAL-SYNC] ${errorMsg}`);
        errorDetails.push(errorMsg);
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
        contactsProcessed: modifiedContacts.length,
        contactsCreated: created,
        contactsUpdated: updated,
        contactsSkipped: skipped,
        errors,
        errorDetails: errorDetails.length > 0 ? errorDetails : undefined
      }
    });

    console.log('[INCREMENTAL-SYNC] Incremental sync completed');
    console.log(`[INCREMENTAL-SYNC] Results: ${created} created, ${updated} updated, ${skipped} skipped, ${errors} errors`);
    console.log(`[INCREMENTAL-SYNC] Duration: ${duration}ms`);

    const result: SyncResult = {
      success: true,
      contactsProcessed: modifiedContacts.length,
      created,
      updated,
      skipped,
      errors,
      duration,
      lastSyncTime: lastSyncTime.toISOString(),
      errorDetails: errorDetails.length > 0 ? errorDetails : undefined
    };

    return NextResponse.json(result);

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    console.error('[INCREMENTAL-SYNC] Sync failed:', error);

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
        console.error('[INCREMENTAL-SYNC] Failed to update sync operation record:', updateError);
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