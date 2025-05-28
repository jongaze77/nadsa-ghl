import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fetchContactFromGHL, updateContactInGHL, mapGHLContactToPrisma } from '@/lib/ghl-api';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const contactId = params.id;
    const updates = await request.json();

    // 1. Update local database
    const localContact = await prisma.contact.update({
      where: { id: contactId },
      data: {
        ...updates,
        lastSyncedAt: new Date(),
      },
    });

    // 2. Update GHL
    await updateContactInGHL(contactId, updates);

    // 3. Fetch updated contact from GHL to ensure consistency
    const ghlContact = await fetchContactFromGHL(contactId);
    const prismaData = mapGHLContactToPrisma(ghlContact);

    // 4. Update local database with GHL data
    const syncedContact = await prisma.contact.update({
      where: { id: contactId },
      data: {
        ...prismaData,
        customFields: prismaData.customFields ? JSON.parse(JSON.stringify(prismaData.customFields)) : null,
      },
    });

    return NextResponse.json(syncedContact);
  } catch (error) {
    console.error('Error updating contact:', error);
    return NextResponse.json(
      { error: 'Failed to update contact' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const contactId = params.id;
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