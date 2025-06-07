import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { mapGHLContactToPrisma } from '@/lib/ghl-api'; // already in your code!




export async function POST(req: NextRequest) {
  const ghlContact = await req.json();

  // At the start of your POST handler:
const secret = req.headers.get('x-ghl-secret');
if (secret !== process.env.GHL_WEBHOOK_SECRET) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

  // Map incoming GHL contact to your Prisma schema
  const mapped = mapGHLContactToPrisma(ghlContact);

  // Upsert: update if exists (by GHL id or email), otherwise create
  await prisma.contact.upsert({
    where: { email: mapped.email }, // or use a unique GHL id if you store it
    update: mapped,
    create: mapped,
  });

  return NextResponse.json({ ok: true });
}