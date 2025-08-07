import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { mapGHLContactToPrisma } from '@/lib/ghl-api';
import { Prisma } from '@prisma/client';

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-ghl-secret');
  if (secret !== process.env.GHL_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const raw = await req.json();
  console.log('GHL WEBHOOK RAW BODY:', raw);

  // Extract id from contact_id or customData.id
  const id = raw.contact_id || (raw.customData && raw.customData.id);
  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'Contact id is required for upsert.' }, { status: 400 });
  }

  // Merge id into the mapped object
  const mapped = mapGHLContactToPrisma({ ...raw, id });

  if (!mapped.id || typeof mapped.id !== 'string') {
    return NextResponse.json({ error: 'Contact id is required for upsert.' }, { status: 400 });
  }

  if (mapped.customFields === undefined || mapped.customFields === null) {
    delete mapped.customFields;
  }

  mapped.updatedAt = new Date();
  if (!mapped.createdAt) mapped.createdAt = new Date();
  mapped.lastSyncedAt = new Date();

  const { id: mappedId, ...rest } = mapped;
  const data = {
    id: mappedId,
    ...rest,
    customFields: mapped.customFields ?? Prisma.JsonNull,
  } satisfies Prisma.ContactCreateInput;

  const contact = await prisma.contact.upsert({
    where: { id: mappedId },
    update: data,
    create: data,
  });

  return NextResponse.json({ ok: true, contact });
}