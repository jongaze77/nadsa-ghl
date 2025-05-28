// src/app/api/contacts/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fetchAllContactsFromGHL, mapGHLContactToPrisma } from '@/lib/ghl-api';
import { Prisma } from '@prisma/client';

// Tell Next.js this route is always dynamic
export const dynamic = 'force-dynamic';
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    // Use req.nextUrl instead of new URL()
    const { searchParams } = req.nextUrl;
    const search = searchParams.get('search') ?? '';
    const page = Number(searchParams.get('page') ?? '1');
    const limit = Number(searchParams.get('limit') ?? '100');

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
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
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