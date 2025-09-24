// src/__tests__/api/sync/incremental.test.ts

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/sync/incremental/route';
import { PrismaClient } from '@prisma/client';
import * as ghlApi from '@/lib/ghl-api';

// Mock dependencies
jest.mock('@prisma/client');
jest.mock('@/lib/ghl-api');

const MockedPrismaClient = PrismaClient as jest.MockedClass<typeof PrismaClient>;
const mockedGhlApi = ghlApi as jest.Mocked<typeof ghlApi>;

describe('/api/sync/incremental', () => {
  let prisma: jest.Mocked<PrismaClient>;

  beforeEach(() => {
    jest.clearAllMocks();

    prisma = new MockedPrismaClient() as jest.Mocked<PrismaClient>;
    (prisma as any).contact = {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    };
    (prisma as any).syncOperation = {
      create: jest.fn(),
      update: jest.fn(),
    };
    (prisma as any).$disconnect = jest.fn();

    // Mock the prisma instance used in the route
    require('@/app/api/sync/incremental/route').__prisma = prisma;
  });

  afterEach(() => {
    jest.resetModules();
  });

  describe('GET /api/sync/incremental', () => {
    it('should reject unauthorized requests', async () => {
      const request = new NextRequest('http://localhost/api/sync/incremental');
      const response = await GET(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should allow Vercel cron requests', async () => {
      const request = new NextRequest('http://localhost/api/sync/incremental', {
        headers: {
          'user-agent': 'vercel-cron',
        },
      });

      // Mock no previous sync found scenario
      (prisma as any).syncOperation.create.mockResolvedValueOnce({ id: 'sync-1' });
      (prisma as any).contact.findFirst.mockResolvedValueOnce(null);
      (prisma as any).syncOperation.update.mockResolvedValueOnce({});

      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.message).toBe('No previous sync found, incremental sync skipped');
    });

    it('should allow requests with valid CRON_SECRET', async () => {
      process.env.CRON_SECRET = 'test-secret';

      const request = new NextRequest('http://localhost/api/sync/incremental', {
        headers: {
          'authorization': 'Bearer test-secret',
        },
      });

      (prisma as any).syncOperation.create.mockResolvedValueOnce({ id: 'sync-1' });
      (prisma as any).contact.findFirst.mockResolvedValueOnce(null);
      (prisma as any).syncOperation.update.mockResolvedValueOnce({});

      const response = await GET(request);

      expect(response.status).toBe(200);
      delete process.env.CRON_SECRET;
    });

    it('should skip incremental sync when no previous sync exists', async () => {
      const request = new NextRequest('http://localhost/api/sync/incremental', {
        headers: { 'user-agent': 'vercel-cron' },
      });

      (prisma as any).syncOperation.create.mockResolvedValueOnce({ id: 'sync-1' });
      (prisma as any).contact.findFirst.mockResolvedValueOnce(null);
      (prisma as any).syncOperation.update.mockResolvedValueOnce({});

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.contactsProcessed).toBe(0);
      expect(data.message).toBe('No previous sync found, incremental sync skipped');

      expect((prisma as any).syncOperation.update).toHaveBeenCalledWith({
        where: { id: 'sync-1' },
        data: expect.objectContaining({
          status: 'success',
          contactsProcessed: 0,
          errors: 0,
        }),
      });
    });

    it('should process modified contacts when previous sync exists', async () => {
      const request = new NextRequest('http://localhost/api/sync/incremental', {
        headers: { 'user-agent': 'vercel-cron' },
      });

      const lastSyncTime = new Date('2024-01-01T10:00:00Z');
      const mockContact = {
        id: 'contact-1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        tags: [],
        updatedAt: '2024-01-01T11:00:00Z',
      };

      (prisma as any).syncOperation.create.mockResolvedValueOnce({ id: 'sync-1' });
      (prisma as any).contact.findFirst.mockResolvedValueOnce({ lastSyncedAt: lastSyncTime });

      // Mock fetchWithRetry to return contacts
      mockedGhlApi.fetchWithRetry.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({
          contacts: [mockContact],
          pagination: null,
        }),
      } as any);

      // Mock mapGHLContactToPrisma
      mockedGhlApi.mapGHLContactToPrisma.mockReturnValueOnce({
        id: 'contact-1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        customFields: {},
      });

      (prisma as any).contact.findUnique.mockResolvedValueOnce(null); // New contact
      (prisma as any).contact.create.mockResolvedValueOnce({});
      (prisma as any).syncOperation.update.mockResolvedValueOnce({});

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.contactsProcessed).toBe(1);
      expect(data.created).toBe(1);
      expect(data.updated).toBe(0);

      expect((prisma as any).contact.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: 'contact-1',
          firstName: 'John',
          lastName: 'Doe',
        }),
      });
    });

    it('should skip contacts with spammer tag', async () => {
      const request = new NextRequest('http://localhost/api/sync/incremental', {
        headers: { 'user-agent': 'vercel-cron' },
      });

      const lastSyncTime = new Date('2024-01-01T10:00:00Z');
      const spammerContact = {
        id: 'spammer-1',
        firstName: 'Spam',
        lastName: 'Bot',
        tags: ['spammer'],
      };

      (prisma as any).syncOperation.create.mockResolvedValueOnce({ id: 'sync-1' });
      (prisma as any).contact.findFirst.mockResolvedValueOnce({ lastSyncedAt: lastSyncTime });

      mockedGhlApi.fetchWithRetry.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({
          contacts: [spammerContact],
          pagination: null,
        }),
      } as any);

      (prisma as any).syncOperation.update.mockResolvedValueOnce({});

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.contactsProcessed).toBe(1);
      expect(data.skipped).toBe(1);
      expect(data.created).toBe(0);
      expect(data.updated).toBe(0);
    });

    it('should handle sync operation creation failure', async () => {
      const request = new NextRequest('http://localhost/api/sync/incremental', {
        headers: { 'user-agent': 'vercel-cron' },
      });

      (prisma as any).syncOperation.create.mockRejectedValueOnce(new Error('DB Error'));

      const response = await GET(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.errorDetails).toContain('DB Error');
    });

    it('should disconnect prisma client', async () => {
      const request = new NextRequest('http://localhost/api/sync/incremental', {
        headers: { 'user-agent': 'vercel-cron' },
      });

      (prisma as any).syncOperation.create.mockResolvedValueOnce({ id: 'sync-1' });
      (prisma as any).contact.findFirst.mockResolvedValueOnce(null);
      (prisma as any).syncOperation.update.mockResolvedValueOnce({});

      await GET(request);

      expect((prisma as any).$disconnect).toHaveBeenCalled();
    });
  });
});