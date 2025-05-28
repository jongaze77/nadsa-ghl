// src/app/api/contacts/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient, Prisma } from '@prisma/client';
import { fetchAllContactsFromGHL, mapGHLContactToPrisma } from '@/lib/ghl-api';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    // Use a base URL for the URL constructor
    const url = new URL(request.url, 'http://localhost');
    const search = url.searchParams.get('search') || '';
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '100');

    // Build where clause for search
    const where: Prisma.ContactWhereInput = search
      ? {
          OR: [
            { firstName: { contains: search, mode: Prisma.QueryMode.insensitive } },
            { lastName: { contains: search, mode: Prisma.QueryMode.insensitive } },
            { email: { contains: search, mode: Prisma.QueryMode.insensitive } },
            { name: { contains: search, mode: Prisma.QueryMode.insensitive } },
          ],
        }
      : {};

    try {
      // Fetch contacts from database
      const [contacts, total] = await Promise.all([
        prisma.contact.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { updatedAt: 'desc' }
        }),
        prisma.contact.count({ where }),
      ]);

      return NextResponse.json({
        contacts,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      });
    } catch (dbError: any) {
      console.error('Database error:', dbError);
      if (dbError.code === 'P1001') {
        return NextResponse.json(
          { error: 'Database connection error. Please try again in a few moments.' },
          { status: 503 }
        );
      }
      throw dbError;
    }
  } catch (error: any) {
    console.error('Error in GET /api/contacts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch contacts' },
      { status: 500 }
    );
  }
}