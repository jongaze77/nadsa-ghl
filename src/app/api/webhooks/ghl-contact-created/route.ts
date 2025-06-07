import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { mapGHLContactToPrisma } from '@/lib/ghl-api';
import { Prisma } from '@prisma/client';

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-ghl-secret');
  if (secret !== process.env.GHL_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ghlContact = await req.json();
  const mapped = mapGHLContactToPrisma(ghlContact);

  if (!mapped.id || typeof mapped.id !== 'string') {
    return NextResponse.json({ error: 'Contact id is required for upsert.' }, { status: 400 });
  }

  // Only assign customFields if it's present, otherwise use DbNull
  const data: Prisma.ContactCreateInput = {
    id: mapped.id,
    ...mapped,
    customFields:
      mapped.customFields === undefined || mapped.customFields === null
        ? Prisma.DbNull
        : mapped.customFields,
    updatedAt: new Date(),
    createdAt: mapped.createdAt ? mapped.createdAt : new Date(),
    lastSyncedAt: new Date(),
  };

  const contact = await prisma.contact.upsert({
    where: { id: mapped.id },
    update: data,
    create: data,
  });

  return NextResponse.json({ ok: true, contact });
}