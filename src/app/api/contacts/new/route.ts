import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getApiKey, mapGHLContactToPrisma } from '@/lib/ghl-api';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { firstName, lastName, email, phone } = await req.json();

  if (!firstName || !lastName || !email) {
    return NextResponse.json(
      { error: 'First name, last name, and email are required.' },
      { status: 400 }
    );
  }

  // Check for duplicate email
  const existing = await prisma.contact.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
  });
  if (existing) {
    return NextResponse.json({ error: 'Email already exists' }, { status: 409 });
  }

  // === 1. Create contact in GHL ===
  const apiKey = getApiKey();
  if (!apiKey) {
    return NextResponse.json({ error: 'Missing GHL API key' }, { status: 500 });
  }

  // GHL create contact endpoint
  let ghlContact: any;
  try {
    const ghlRes = await fetch('https://rest.gohighlevel.com/v1/contacts/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        firstName,
        lastName,
        email,
        phone,
      }),
    });
    const ghlData = await ghlRes.json();
    if (!ghlRes.ok) {
      return NextResponse.json(
        { error: ghlData.message || 'Failed to create contact in GHL' },
        { status: ghlRes.status }
      );
    }
    // GHL returns { contact: { ... } }
    ghlContact = ghlData.contact || ghlData;
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Error creating contact in GHL', detail: err.message || String(err) },
      { status: 500 }
    );
  }

  // === 2. Create contact in local DB, using GHL data ===
  const mapped = mapGHLContactToPrisma(ghlContact);

  const contact = await prisma.contact.create({
    data: {
      ...mapped,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSyncedAt: new Date(),
    },
  });

  return NextResponse.json(contact);
}