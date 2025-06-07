import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { mapGHLContactToPrisma } from '@/lib/ghl-api';

export async function POST(req: NextRequest) {
  // Check webhook secret
  const secret = req.headers.get('x-ghl-secret');
  if (secret !== process.env.GHL_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ghlContact = await req.json();
  const mapped = mapGHLContactToPrisma(ghlContact);

  // 1. Ensure email exists and is string
  if (!mapped.email || typeof mapped.email !== 'string') {
    return NextResponse.json({ error: 'Contact email is required for upsert.' }, { status: 400 });
  }

  // 2. Clean up fields for Prisma
  // Remove id if undefined
  if (typeof mapped.id === 'undefined') {
    delete mapped.id;
  }

  // If you have fields like customFields that could be null, 
  // and Prisma expects undefined, set to undefined instead of null:
  if (mapped.customFields === null) {
    mapped.customFields = undefined;
  }

  // Add timestamps or any additional fields needed for your schema
  mapped.updatedAt = new Date();
  if (!mapped.createdAt) mapped.createdAt = new Date();
  mapped.lastSyncedAt = new Date();

  // 3. Upsert by email (assuming email is unique in your Prisma schema)
  const contact = await prisma.contact.upsert({
    where: { email: mapped.email },
    update: mapped,
    create: mapped,
  });

  return NextResponse.json({ ok: true, contact });
}