// src/app/api/contacts/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const showMembersOnly = searchParams.get('membersOnly') === 'true';

  try {
    const contacts = await prisma.contact.findMany({
      where: showMembersOnly ? {
        membershipType: {
          in: ['Full', 'Associate', 'Newsletter Only', 'Ex Member']
        }
      } : undefined,
      orderBy: {
        lastName: 'asc'
      }
    });

    return NextResponse.json(contacts);
  } catch (error) {
    console.error('Error fetching contacts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch contacts' },
      { status: 500 }
    );
  }
}