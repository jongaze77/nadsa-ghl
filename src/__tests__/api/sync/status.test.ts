// src/__tests__/api/sync/status.test.ts

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/sync/status/route';
import { PrismaClient } from '@prisma/client';

// Mock Prisma
jest.mock('@prisma/client');
const MockedPrismaClient = PrismaClient as jest.MockedClass<typeof PrismaClient>;

describe('/api/sync/status', () => {
  let prisma: jest.Mocked<PrismaClient>;

  beforeEach(() => {
    jest.clearAllMocks();

    prisma = new MockedPrismaClient() as jest.Mocked<PrismaClient>;
    (prisma as any).contact = {
      findFirst: jest.fn(),
      count: jest.fn(),
    };
    (prisma as any).syncOperation = {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    };
    (prisma as any).$disconnect = jest.fn();

    // Mock the prisma instance used in the route
    require('@/app/api/sync/status/route').__prisma = prisma;
  });

  afterEach(() => {
    jest.resetModules();
  });

  describe('GET /api/sync/status', () => {
    it('should return green status for recent sync', async () => {
      const recentSyncTime = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes ago

      (prisma as any).contact.findFirst.mockResolvedValueOnce({
        lastSyncedAt: recentSyncTime
      });
      (prisma as any).contact.count
        .mockResolvedValueOnce(1000) // total contacts
        .mockResolvedValueOnce(50);  // recently updated

      (prisma as any).syncOperation.findFirst
        .mockResolvedValueOnce({ completedAt: recentSyncTime }) // incremental
        .mockResolvedValueOnce({ completedAt: new Date(Date.now() - 24 * 60 * 60 * 1000) }); // full

      (prisma as any).syncOperation.findMany.mockResolvedValueOnce([
        {
          id: '1',
          type: 'incremental',
          status: 'success',
          startedAt: recentSyncTime,
          completedAt: recentSyncTime,
          duration: 1500,
          contactsProcessed: 5,
          errors: 0
        }
      ]);

      const request = new NextRequest('http://localhost/api/sync/status');
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('green');
      expect(data.totalContacts).toBe(1000);
      expect(data.recentlyUpdated).toBe(50);
      expect(data.recentSyncOperations).toHaveLength(1);
      expect(data.hoursAgo).toBe(0); // Less than an hour
    });

    it('should return yellow status for moderately stale sync', async () => {
      const staleSync = new Date(Date.now() - 4 * 60 * 60 * 1000); // 4 hours ago

      (prisma as any).contact.findFirst.mockResolvedValueOnce({
        lastSyncedAt: staleSync
      });
      (prisma as any).contact.count
        .mockResolvedValueOnce(1000)
        .mockResolvedValueOnce(10);

      (prisma as any).syncOperation.findFirst
        .mockResolvedValueOnce({ completedAt: staleSync })
        .mockResolvedValueOnce({ completedAt: staleSync });

      (prisma as any).syncOperation.findMany.mockResolvedValueOnce([]);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('yellow');
      expect(data.hoursAgo).toBe(4);
      expect(data.message).toContain('4 hours ago (warning)');
    });

    it('should return red status for very stale sync', async () => {
      const veryStaleSync = new Date(Date.now() - 10 * 60 * 60 * 1000); // 10 hours ago

      (prisma as any).contact.findFirst.mockResolvedValueOnce({
        lastSyncedAt: veryStaleSync
      });
      (prisma as any).contact.count
        .mockResolvedValueOnce(1000)
        .mockResolvedValueOnce(0);

      (prisma as any).syncOperation.findFirst
        .mockResolvedValueOnce({ completedAt: veryStaleSync })
        .mockResolvedValueOnce({ completedAt: veryStaleSync });

      (prisma as any).syncOperation.findMany.mockResolvedValueOnce([]);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('red');
      expect(data.hoursAgo).toBe(10);
      expect(data.message).toContain('10 hours ago (stale)');
    });

    it('should return red status when no sync has been performed', async () => {
      (prisma as any).contact.findFirst.mockResolvedValueOnce(null);
      (prisma as any).contact.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      (prisma as any).syncOperation.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      (prisma as any).syncOperation.findMany.mockResolvedValueOnce([]);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('red');
      expect(data.lastSyncTime).toBeNull();
      expect(data.hoursAgo).toBeNull();
      expect(data.message).toBe('No sync has been performed yet');
    });

    it('should handle database errors gracefully', async () => {
      (prisma as any).contact.findFirst.mockRejectedValueOnce(new Error('Database error'));

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.status).toBe('red');
      expect(data.message).toBe('Error retrieving sync status');
      expect(data.recentSyncOperations).toEqual([]);
    });

    it('should disconnect prisma client', async () => {
      (prisma as any).contact.findFirst.mockResolvedValueOnce(null);
      (prisma as any).contact.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);
      (prisma as any).syncOperation.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      (prisma as any).syncOperation.findMany.mockResolvedValueOnce([]);

      await GET();

      expect((prisma as any).$disconnect).toHaveBeenCalled();
    });
  });
});