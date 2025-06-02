import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fetchContactFromGHL, updateContactInGHL, mapGHLContactToPrisma, trackContactChanges, getApiKey, FIELD_MAP } from '@/lib/ghl-api';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Helper function for reliable server-side logging
function log(message: string) {
  process.stdout.write(message + '\n');
}

async function createNote(contactId: string, body: string) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('Missing API key');
  }

  log(`\n📝 Creating note for contact ${contactId}`);
  log(`Note body: ${body}`);

  const res = await fetch(`https://rest.gohighlevel.com/v1/contacts/${contactId}/notes`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ body }),
  });

  if (!res.ok) {
    const error = await res.json();
    log(`❌ Failed to create note: ${error.message || 'Unknown error'}`);
    throw new Error(error.message || 'Failed to create note');
  }

  log('✅ Note created successfully');
  return res.json();
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: contactId } = await params;
    const updates = await request.json();
    const session = await getServerSession(authOptions);
    const username = session?.user?.name || 'Unknown User';

    log('\n🔵 ===== CONTACT UPDATE STARTED =====');
    log(`Contact ID: ${contactId}`);
    log(`Updates: ${JSON.stringify(updates, null, 2)}`);
    log(`Username: ${username}`);

    // If this is just a note creation request
    if (updates.note && Object.keys(updates).length === 1) {
      log(`📝 Creating manual note: ${updates.note}`);
      await createNote(contactId, updates.note);
      return NextResponse.json({ ok: true });
    }

    // 1. Get current contact data
    const currentContact = await prisma.contact.findUnique({
      where: { id: contactId },
    });

    if (!currentContact) {
      log(`❌ Contact not found: ${contactId}`);
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      );
    }

    log(`📋 Current contact: ${JSON.stringify(currentContact, null, 2)}`);

    // 2. Update local database
    const { customField, ...restUpdates } = updates;

    // Ensure that all fields are updated, including explicit nulls
    const updateData: any = {
      ...restUpdates,
      lastSyncedAt: new Date(),
    };
    if (customField !== undefined) {
      updateData.customFields = customField;
    }

    const updatedContact = await prisma.contact.update({
      where: { id: contactId },
      data: updateData,
    });

    log(`💾 Local contact updated: ${JSON.stringify(updatedContact, null, 2)}`);

    // 2b. Detect changes and create note BEFORE GHL sync
    log('\n🔍 ===== TRACKING CHANGES =====');
    const changes = trackContactChanges(currentContact, updatedContact);
    log(`📊 Changes detected: ${JSON.stringify(changes, null, 2)}`);

    if (changes.length > 0) {
      const changeNote = changes
        .map(change => {
          // Try to get a human-readable field name
          const fieldName = FIELD_MAP[change.field] || change.field;
          return `${fieldName}: "${change.oldValue || ''}" --> "${change.newValue || ''}"`;
        })
        .join('\n');
      
      const noteBody = `Changes made by ${username}:\n${changeNote}`;
      
      log('\n📝 ===== CREATING CHANGE NOTE =====');
      log(`Note body: ${noteBody}`);
      
      // Create note in GHL
      await createNote(contactId, noteBody);
      log('✅ Note created successfully');
    } else {
      log('ℹ️ No changes detected, skipping note creation');
    }

    // 3. Update GHL
    log('🔄 Updating contact in GHL...');
    await updateContactInGHL(contactId, updates);
    log('✅ GHL update complete');

    // 4. Fetch updated contact from GHL to ensure consistency
    log('🔄 Fetching updated contact from GHL...');
    const ghlContact = await fetchContactFromGHL(contactId);
    const prismaData = mapGHLContactToPrisma(ghlContact);

    log(`🔄 GHL contact fetched: ${JSON.stringify(ghlContact, null, 2)}`);
    log(`📦 Mapped to Prisma: ${JSON.stringify(prismaData, null, 2)}`);

    // 5. Update local database with GHL data
    const syncedContact = await prisma.contact.update({
      where: { id: contactId },
      data: {
        ...prismaData,
        customFields: prismaData.customFields ? JSON.parse(JSON.stringify(prismaData.customFields)) : null,
      },
    });

    log(`✅ Synced contact: ${JSON.stringify(syncedContact, null, 2)}`);
    log('\n🔵 ===== CONTACT UPDATE COMPLETED =====\n');

    return NextResponse.json(syncedContact);
  } catch (error) {
    log('\n❌ ===== ERROR IN CONTACT UPDATE =====');
    log(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update contact' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: contactId } = await params;
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
    });

    if (!contact) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(contact);
  } catch (error) {
    console.error('Error fetching contact:', error);
    return NextResponse.json(
      { error: 'Failed to fetch contact' },
      { status: 500 }
    );
  }
} 