import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { randomUUID } from 'crypto';

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

  // Generate a UUID for the contact id (GHL uses string id)
  const id = randomUUID();

  const contact = await prisma.contact.create({
    data: {
      id,
      firstName,
      lastName,
      email,
      phone,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSyncedAt: new Date(),
    },
  });

  return NextResponse.json(contact);
}