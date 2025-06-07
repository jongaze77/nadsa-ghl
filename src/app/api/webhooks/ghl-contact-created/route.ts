import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { mapGHLContactToPrisma } from '@/lib/ghl-api';
import { Prisma } from '@prisma/client';

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-ghl-secret');
  if (secret !== process.env.GHL_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get and log the full incoming payload for debugging
  const raw = await req.json();
  console.log('GHL WEBHOOK RAW BODY:', raw);

  // Expect a flat object, fields like id, firstName, etc
  const ghlContact = raw;

  const mapped = mapGHLContactToPrisma(ghlContact);

  if (!mapped.id || typeof mapped.id !== 'string') {
    return NextResponse.json({ error: 'Contact id is required for upsert.' }, { status: 400 });
  }

  // Only assign customFields if it's present, otherwise use JsonNull (or just delete if you prefer)
  if (mapped.customFields === undefined || mapped.customFields === null) {
    delete mapped.customFields; // safest for type compatibility
  }

  mapped.updatedAt = new Date();
  if (!mapped.createdAt) mapped.createdAt = new Date();
  mapped.lastSyncedAt = new Date();

  const { id, ...rest } = mapped;
  const data = {
    id,
    ...rest,
    customFields: mapped.customFields ?? Prisma.JsonNull,
  } satisfies Prisma.ContactCreateInput;

  const contact = await prisma.contact.upsert({
    where: { id },
    update: data,
    create: data,
  });

  return NextResponse.json({ ok: true, contact });
}