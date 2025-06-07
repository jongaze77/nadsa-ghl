import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { mapGHLContactToPrisma } from '@/lib/ghl-api';
import { Prisma } from '@prisma/client';

export async function POST(req: NextRequest) {
  // Secret check
  const secret = req.headers.get('x-ghl-secret');
  if (secret !== process.env.GHL_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ghlContact = await req.json();
  const mapped = mapGHLContactToPrisma(ghlContact);

  // Must have id (from GHL) and it must be a string
  if (!mapped.id || typeof mapped.id !== 'string') {
    return NextResponse.json({ error: 'Contact id is required for upsert.' }, { status: 400 });
  }

  // Prisma requires: customFields is JSON, Prisma.DbNull, or undefined (not plain null)
  if (mapped.customFields === null || mapped.customFields === undefined) {
    delete mapped.customFields; // or mapped.customFields = Prisma.DbNull;
  }

  mapped.updatedAt = new Date();
  if (!mapped.createdAt) mapped.createdAt = new Date();
  mapped.lastSyncedAt = new Date();

  // Remove undefined fields (especially id)
  const { id, ...rest } = mapped;
  // DO NOT use "as const" here!
  const data = {
    id,
    ...rest,
  };

  const contact = await prisma.contact.upsert({
    where: { id },
    update: data,
    create: data,
  });

  return NextResponse.json({ ok: true, contact });
}