import { NextRequest } from 'next/server';
import { GET } from '@/app/api/reconciliation/payments/route';
import { getServerSession } from 'next-auth/next';
import { prisma } from '@/lib/prisma';

jest.mock('next-auth/next');
jest.mock('@/lib/prisma', () => ({
  prisma: {
    pendingPayment: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;
const mockPrisma = prisma as any;

describe('/api/reconciliation/payments', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue({
      user: { name: 'admin', role: 'admin' }
    } as any);
  });

  describe('Authentication', () => {
    it('should return 401 if not authenticated', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/reconciliation/payments');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.message).toBe('Unauthorized');
    });

    it('should return 403 if user is not admin', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { name: 'user', role: 'user' }
      } as any);

      const request = new NextRequest('http://localhost:3000/api/reconciliation/payments');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.message).toBe('Forbidden: Admin access required');
    });
  });

  describe('Basic Functionality', () => {
    it('should return payments successfully with default parameters', async () => {
      const mockPayments = [
        {
          id: 'payment1',
          transactionFingerprint: 'fp1',
          paymentDate: new Date('2024-01-01'),
          amount: { toString: () => '42.00' },
          source: 'STRIPE_REPORT',
          transactionRef: 'stripe_123',
          description: 'Test payment',
          hashedAccountIdentifier: null,
          status: 'pending',
          uploadedAt: new Date('2024-01-01'),
          metadata: {
            customer_name: 'John Doe',
            customer_email: 'john@example.com'
          },
          uploadedBy: { username: 'admin' }
        }
      ];

      mockPrisma.pendingPayment.count.mockResolvedValue(1);
      mockPrisma.pendingPayment.findMany.mockResolvedValue(mockPayments);

      const request = new NextRequest('http://localhost:3000/api/reconciliation/payments');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.payments).toHaveLength(1);
      expect(data.payments[0].customer_name).toBe('John Doe');
      expect(data.payments[0].customer_email).toBe('john@example.com');
      expect(data.total).toBe(1);
    });
  });

  describe('Status Filtering', () => {
    it('should filter by status', async () => {
      mockPrisma.pendingPayment.count.mockResolvedValue(0);
      mockPrisma.pendingPayment.findMany.mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/reconciliation/payments?status=confirmed');
      await GET(request);

      expect(mockPrisma.pendingPayment.count).toHaveBeenCalledWith({
        where: { status: 'confirmed' }
      });
      expect(mockPrisma.pendingPayment.findMany).toHaveBeenCalledWith({
        where: { status: 'confirmed' },
        orderBy: [
          { uploadedAt: 'desc' },
          { paymentDate: 'desc' }
        ],
        skip: 0,
        take: 50,
        include: {
          uploadedBy: {
            select: { username: true }
          }
        }
      });
    });

    it('should ignore invalid status values', async () => {
      mockPrisma.pendingPayment.count.mockResolvedValue(0);
      mockPrisma.pendingPayment.findMany.mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/reconciliation/payments?status=invalid');
      await GET(request);

      expect(mockPrisma.pendingPayment.count).toHaveBeenCalledWith({
        where: {}
      });
    });
  });

  describe('Source Filtering', () => {
    it('should filter by source', async () => {
      mockPrisma.pendingPayment.count.mockResolvedValue(0);
      mockPrisma.pendingPayment.findMany.mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/reconciliation/payments?source=STRIPE_REPORT');
      await GET(request);

      expect(mockPrisma.pendingPayment.count).toHaveBeenCalledWith({
        where: { source: 'STRIPE_REPORT' }
      });
    });

    it('should ignore invalid source values', async () => {
      mockPrisma.pendingPayment.count.mockResolvedValue(0);
      mockPrisma.pendingPayment.findMany.mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/reconciliation/payments?source=INVALID');
      await GET(request);

      expect(mockPrisma.pendingPayment.count).toHaveBeenCalledWith({
        where: {}
      });
    });
  });

  describe('Amount Filtering', () => {
    it('should filter by exact amount', async () => {
      mockPrisma.pendingPayment.count.mockResolvedValue(0);
      mockPrisma.pendingPayment.findMany.mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/reconciliation/payments?amount=42&amountExact=true');
      await GET(request);

      expect(mockPrisma.pendingPayment.count).toHaveBeenCalledWith({
        where: { amount: 42 }
      });
    });

    it('should filter by amount range when not exact', async () => {
      mockPrisma.pendingPayment.count.mockResolvedValue(0);
      mockPrisma.pendingPayment.findMany.mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/reconciliation/payments?amount=42&amountExact=false');
      await GET(request);

      expect(mockPrisma.pendingPayment.count).toHaveBeenCalledWith({
        where: {
          amount: {
            gte: 41.99,
            lte: 42.01
          }
        }
      });
    });

    it('should ignore zero or negative amounts', async () => {
      mockPrisma.pendingPayment.count.mockResolvedValue(0);
      mockPrisma.pendingPayment.findMany.mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/reconciliation/payments?amount=0');
      await GET(request);

      expect(mockPrisma.pendingPayment.count).toHaveBeenCalledWith({
        where: {}
      });
    });
  });

  describe('Text Search', () => {
    it('should search in description and customer metadata fields', async () => {
      mockPrisma.pendingPayment.count.mockResolvedValue(0);
      mockPrisma.pendingPayment.findMany.mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/reconciliation/payments?textSearch=john');
      await GET(request);

      expect(mockPrisma.pendingPayment.count).toHaveBeenCalledWith({
        where: {
          AND: [
            {
              OR: [
                {
                  description: {
                    contains: 'john',
                    mode: 'insensitive'
                  }
                },
                {
                  metadata: {
                    path: ['customer_name'],
                    string_contains: 'john'
                  }
                },
                {
                  metadata: {
                    path: ['customer_email'],
                    string_contains: 'john'
                  }
                },
                {
                  metadata: {
                    path: ['card_address_line1'],
                    string_contains: 'john'
                  }
                },
                {
                  metadata: {
                    path: ['card_address_postal_code'],
                    string_contains: 'john'
                  }
                }
              ]
            }
          ]
        }
      });
    });

    it('should trim whitespace from search terms', async () => {
      mockPrisma.pendingPayment.count.mockResolvedValue(0);
      mockPrisma.pendingPayment.findMany.mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/reconciliation/payments?textSearch=%20%20john%20%20');
      await GET(request);

      const whereClause = mockPrisma.pendingPayment.count.mock.calls[0][0].where;
      expect(whereClause.AND[0].OR[0].description.contains).toBe('john');
    });
  });

  describe('Date Range Filtering', () => {
    it('should filter by date range', async () => {
      mockPrisma.pendingPayment.count.mockResolvedValue(0);
      mockPrisma.pendingPayment.findMany.mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/reconciliation/payments?dateFrom=2024-01-01&dateTo=2024-01-31');
      await GET(request);

      expect(mockPrisma.pendingPayment.count).toHaveBeenCalledWith({
        where: {
          AND: [
            {
              paymentDate: {
                gte: new Date('2024-01-01T00:00:00.000Z')
              }
            },
            {
              paymentDate: {
                lte: new Date('2024-01-31T23:59:59.999Z')
              }
            }
          ]
        }
      });
    });

    it('should handle only dateFrom', async () => {
      mockPrisma.pendingPayment.count.mockResolvedValue(0);
      mockPrisma.pendingPayment.findMany.mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/reconciliation/payments?dateFrom=2024-01-01');
      await GET(request);

      expect(mockPrisma.pendingPayment.count).toHaveBeenCalledWith({
        where: {
          AND: [
            {
              paymentDate: {
                gte: new Date('2024-01-01T00:00:00.000Z')
              }
            }
          ]
        }
      });
    });

    it('should handle only dateTo', async () => {
      mockPrisma.pendingPayment.count.mockResolvedValue(0);
      mockPrisma.pendingPayment.findMany.mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/reconciliation/payments?dateTo=2024-01-31');
      await GET(request);

      expect(mockPrisma.pendingPayment.count).toHaveBeenCalledWith({
        where: {
          AND: [
            {
              paymentDate: {
                lte: new Date('2024-01-31T23:59:59.999Z')
              }
            }
          ]
        }
      });
    });
  });

  describe('Combined Filters', () => {
    it('should apply multiple filters together', async () => {
      mockPrisma.pendingPayment.count.mockResolvedValue(0);
      mockPrisma.pendingPayment.findMany.mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/reconciliation/payments?status=pending&amount=42&amountExact=true&textSearch=john&dateFrom=2024-01-01');
      await GET(request);

      expect(mockPrisma.pendingPayment.count).toHaveBeenCalledWith({
        where: {
          status: 'pending',
          amount: 42,
          AND: [
            {
              paymentDate: {
                gte: new Date('2024-01-01T00:00:00.000Z')
              }
            },
            {
              OR: [
                {
                  description: {
                    contains: 'john',
                    mode: 'insensitive'
                  }
                },
                {
                  metadata: {
                    path: ['customer_name'],
                    string_contains: 'john'
                  }
                },
                {
                  metadata: {
                    path: ['customer_email'],
                    string_contains: 'john'
                  }
                },
                {
                  metadata: {
                    path: ['card_address_line1'],
                    string_contains: 'john'
                  }
                },
                {
                  metadata: {
                    path: ['card_address_postal_code'],
                    string_contains: 'john'
                  }
                }
              ]
            }
          ]
        }
      });
    });
  });

  describe('Pagination', () => {
    it('should handle custom pagination parameters', async () => {
      mockPrisma.pendingPayment.count.mockResolvedValue(100);
      mockPrisma.pendingPayment.findMany.mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/reconciliation/payments?page=3&limit=10');
      const response = await GET(request);
      const data = await response.json();

      expect(mockPrisma.pendingPayment.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: [
          { uploadedAt: 'desc' },
          { paymentDate: 'desc' }
        ],
        skip: 20, // (3-1) * 10
        take: 10,
        include: {
          uploadedBy: {
            select: { username: true }
          }
        }
      });

      expect(data.page).toBe(3);
      expect(data.limit).toBe(10);
      expect(data.total).toBe(100);
    });

    it('should validate pagination parameters', async () => {
      const request = new NextRequest('http://localhost:3000/api/reconciliation/payments?page=0&limit=200');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.message).toContain('Invalid pagination parameters');
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      mockPrisma.pendingPayment.count.mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost:3000/api/reconciliation/payments');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.message).toBe('Internal server error');
    });
  });

  describe('Data Transformation', () => {
    it('should correctly transform payment data and include customer fields', async () => {
      const mockPayments = [
        {
          id: 'payment1',
          transactionFingerprint: 'fp1',
          paymentDate: new Date('2024-01-01T10:30:00Z'),
          amount: { toString: () => '42.50' },
          source: 'STRIPE_REPORT',
          transactionRef: 'stripe_123',
          description: 'Test payment',
          hashedAccountIdentifier: 'hashed123',
          status: 'pending',
          uploadedAt: new Date('2024-01-02T15:45:00Z'),
          metadata: {
            customer_name: 'John Doe',
            customer_email: 'john@example.com',
            card_address_line1: '123 Main St',
            card_address_postal_code: 'SW1A 1AA'
          },
          uploadedBy: { username: 'admin' }
        }
      ];

      mockPrisma.pendingPayment.count.mockResolvedValue(1);
      mockPrisma.pendingPayment.findMany.mockResolvedValue(mockPayments);

      const request = new NextRequest('http://localhost:3000/api/reconciliation/payments');
      const response = await GET(request);
      const data = await response.json();

      expect(data.payments[0]).toEqual({
        id: 'payment1',
        transactionFingerprint: 'fp1',
        paymentDate: '2024-01-01T10:30:00.000Z',
        amount: 42.5,
        source: 'STRIPE_REPORT',
        transactionRef: 'stripe_123',
        description: 'Test payment',
        hashedAccountIdentifier: 'hashed123',
        status: 'pending',
        uploadedAt: '2024-01-02T15:45:00.000Z',
        customer_name: 'John Doe',
        customer_email: 'john@example.com',
        card_address_line1: '123 Main St',
        card_address_postal_code: 'SW1A 1AA'
      });
    });

    it('should handle missing metadata gracefully', async () => {
      const mockPayments = [
        {
          id: 'payment1',
          transactionFingerprint: 'fp1',
          paymentDate: new Date('2024-01-01'),
          amount: { toString: () => '42.00' },
          source: 'BANK_CSV',
          transactionRef: 'bank_123',
          description: null,
          hashedAccountIdentifier: null,
          status: 'pending',
          uploadedAt: new Date('2024-01-01'),
          metadata: null,
          uploadedBy: { username: 'admin' }
        }
      ];

      mockPrisma.pendingPayment.count.mockResolvedValue(1);
      mockPrisma.pendingPayment.findMany.mockResolvedValue(mockPayments);

      const request = new NextRequest('http://localhost:3000/api/reconciliation/payments');
      const response = await GET(request);
      const data = await response.json();

      expect(data.payments[0].customer_name).toBeUndefined();
      expect(data.payments[0].customer_email).toBeUndefined();
      expect(data.payments[0].card_address_line1).toBeUndefined();
      expect(data.payments[0].card_address_postal_code).toBeUndefined();
    });
  });
});