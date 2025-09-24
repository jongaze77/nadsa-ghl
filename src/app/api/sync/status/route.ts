import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface SyncStatus {
  status: 'green' | 'yellow' | 'red';
  lastSyncTime: string | null;
  hoursAgo: number | null;
  message: string;
  totalContacts: number;
  recentlyUpdated: number;
  lastIncrementalSync: string | null;
  lastFullSync: string | null;
  recentSyncOperations: Array<{
    id: string;
    type: string;
    status: string;
    startedAt: string;
    completedAt: string | null;
    duration: number | null;
    contactsProcessed: number;
    errors: number;
  }>;
}

export async function GET() {
  try {
    // Get the most recent sync timestamp from contacts
    const mostRecentContact = await prisma.contact.findFirst({
      orderBy: { lastSyncedAt: 'desc' },
      select: { lastSyncedAt: true }
    });

    const lastSyncTime = mostRecentContact?.lastSyncedAt;

    // Get the most recent successful sync operations
    const lastIncrementalSync = await prisma.syncOperation.findFirst({
      where: { type: 'incremental', status: 'success' },
      orderBy: { completedAt: 'desc' },
      select: { completedAt: true }
    });

    const lastFullSync = await prisma.syncOperation.findFirst({
      where: { type: 'full', status: 'success' },
      orderBy: { completedAt: 'desc' },
      select: { completedAt: true }
    });

    // Get recent sync operations (last 10)
    const recentSyncOperations = await prisma.syncOperation.findMany({
      orderBy: { startedAt: 'desc' },
      take: 10,
      select: {
        id: true,
        type: true,
        status: true,
        startedAt: true,
        completedAt: true,
        duration: true,
        contactsProcessed: true,
        errors: true
      }
    });

    // Get total contact count
    const totalContacts = await prisma.contact.count();

    // Get contacts updated in the last 24 hours
    const yesterday = new Date();
    yesterday.setHours(yesterday.getHours() - 24);

    const recentlyUpdated = await prisma.contact.count({
      where: {
        lastSyncedAt: {
          gte: yesterday
        }
      }
    });

    let status: 'green' | 'yellow' | 'red';
    let hoursAgo: number | null = null;
    let message: string;

    if (!lastSyncTime) {
      status = 'red';
      message = 'No sync has been performed yet';
    } else {
      const now = new Date();
      const timeDiff = now.getTime() - lastSyncTime.getTime();
      hoursAgo = Math.floor(timeDiff / (1000 * 60 * 60));

      if (hoursAgo < 2) {
        status = 'green';
        message = `Last sync ${hoursAgo === 0 ? 'less than an hour' : `${hoursAgo} hour${hoursAgo > 1 ? 's' : ''}`} ago`;
      } else if (hoursAgo <= 6) {
        status = 'yellow';
        message = `Last sync ${hoursAgo} hours ago (warning)`;
      } else {
        status = 'red';
        message = `Last sync ${hoursAgo} hours ago (stale)`;
      }
    }

    const result: SyncStatus = {
      status,
      lastSyncTime: lastSyncTime?.toISOString() || null,
      hoursAgo,
      message,
      totalContacts,
      recentlyUpdated,
      lastIncrementalSync: lastIncrementalSync?.completedAt?.toISOString() || null,
      lastFullSync: lastFullSync?.completedAt?.toISOString() || null,
      recentSyncOperations: recentSyncOperations.map(op => ({
        id: op.id,
        type: op.type,
        status: op.status,
        startedAt: op.startedAt.toISOString(),
        completedAt: op.completedAt?.toISOString() || null,
        duration: op.duration,
        contactsProcessed: op.contactsProcessed,
        errors: op.errors
      }))
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('[SYNC-STATUS] Error getting sync status:', error);

    return NextResponse.json(
      {
        status: 'red',
        lastSyncTime: null,
        hoursAgo: null,
        message: 'Error retrieving sync status',
        totalContacts: 0,
        recentlyUpdated: 0,
        lastIncrementalSync: null,
        lastFullSync: null,
        recentSyncOperations: []
      } as SyncStatus,
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}