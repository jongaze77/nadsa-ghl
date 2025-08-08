import { POST } from '../../../app/api/reconciliation/confirm/route';
import { getServerSession } from 'next-auth/next';
import { prisma } from '../../../lib/prisma';
import { NextRequest } from 'next/server';
import { Decimal } from '@prisma/client/runtime/library';

// Mock dependencies
jest.mock('next-auth/next');
jest.mock('../../../lib/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
    reconciliationLog: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    contact: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    paymentSource: {
      upsert: jest.fn(),
    },
  },
}));

const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;
const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('/api/reconciliation/confirm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockPaymentData = {
    transactionFingerprint: 'test123',
    amount: 50.00,
    paymentDate: new Date('2024-01-01'),
    source: 'BANK_CSV' as const,
    transactionRef: 'REF123',
    description: 'MEMBERSHIP - JOHN SMITH',
    hashedAccountIdentifier: 'hashed123',
  };

  const mockConfirmRequest = {
    paymentData: mockPaymentData,
    contactId: 'contact-123',
    confidence: 0.95,
    reasoning: {
      nameMatch: { score: 0.9 },
      amountMatch: { score: 1.0 },
    },
  };

  describe('Authentication', () => {
    it('should return 401 when not authenticated', async () => {
      mockGetServerSession.mockResolvedValue(null);
      
      const request = new NextRequest('http://localhost:3000/api/reconciliation/confirm', {
        method: 'POST',
        body: JSON.stringify(mockConfirmRequest),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.message).toBe('Unauthorized');
    });

    it('should return 403 when user is not admin', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { name: 'testuser', role: 'user' },
      });
      
      const request = new NextRequest('http://localhost:3000/api/reconciliation/confirm', {
        method: 'POST',
        body: JSON.stringify(mockConfirmRequest),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.message).toBe('Forbidden: Admin access required');
    });
  });

  describe('Request Validation', () => {
    beforeEach(() => {
      mockGetServerSession.mockResolvedValue({
        user: { name: 'admin', role: 'admin' },
      });
    });

    it('should return 400 when paymentData is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/reconciliation/confirm', {
        method: 'POST',
        body: JSON.stringify({ contactId: 'contact-123' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.message).toBe('Payment data and contact ID are required');
    });

    it('should return 400 when contactId is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/reconciliation/confirm', {
        method: 'POST',
        body: JSON.stringify({ paymentData: mockPaymentData }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.message).toBe('Payment data and contact ID are required');
    });

    it('should return 400 when payment data is invalid', async () => {
      const invalidRequest = {
        paymentData: {
          amount: 50.00,
          // Missing required fields
        },
        contactId: 'contact-123',
      };

      const request = new NextRequest('http://localhost:3000/api/reconciliation/confirm', {
        method: 'POST',
        body: JSON.stringify(invalidRequest),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.message).toBe('Invalid payment data. Required fields: transactionFingerprint, amount, paymentDate');
    });

    it('should return 400 when amount is not positive', async () => {
      const invalidRequest = {
        ...mockConfirmRequest,
        paymentData: {
          ...mockPaymentData,
          amount: -10,
        },
      };

      const request = new NextRequest('http://localhost:3000/api/reconciliation/confirm', {
        method: 'POST',
        body: JSON.stringify(invalidRequest),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.message).toBe('Amount must be a positive number');
    });

    it('should return 400 when paymentDate is invalid', async () => {
      const invalidRequest = {
        ...mockConfirmRequest,
        paymentData: {
          ...mockPaymentData,
          paymentDate: 'invalid-date',
        },
      };

      const request = new NextRequest('http://localhost:3000/api/reconciliation/confirm', {
        method: 'POST',
        body: JSON.stringify(invalidRequest),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.message).toBe('Invalid payment date format');
    });

    it('should return 400 when contactId is empty', async () => {
      const invalidRequest = {
        ...mockConfirmRequest,
        contactId: '',
      };

      const request = new NextRequest('http://localhost:3000/api/reconciliation/confirm', {
        method: 'POST',
        body: JSON.stringify(invalidRequest),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.message).toBe('Invalid contact ID');
    });
  });

  describe('Successful Confirmation', () => {
    beforeEach(() => {
      mockGetServerSession.mockResolvedValue({
        user: { name: 'admin', role: 'admin' },
      });
    });

    it('should successfully confirm a match', async () => {
      const mockReconciliationLog = {
        id: 'reconciliation-123',
        transactionFingerprint: 'test123',
        amount: new Decimal(50.00),
        contactId: 'contact-123',
      };

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        // Mock the transaction callback
        const mockTx = {
          reconciliationLog: {
            findUnique: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue(mockReconciliationLog),
          },
          contact: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'contact-123',
              firstName: 'John',
              lastName: 'Smith',
            }),
          },
          user: {
            findUnique: jest.fn().mockResolvedValue({
              id: 1,
              username: 'admin',
            }),
          },
          paymentSource: {
            upsert: jest.fn().mockResolvedValue({
              id: 'payment-source-123',
            }),
          },
        };
        return await callback(mockTx as any);
      });

      const request = new NextRequest('http://localhost:3000/api/reconciliation/confirm', {
        method: 'POST',
        body: JSON.stringify(mockConfirmRequest),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.reconciliationLogId).toBe('reconciliation-123');
      expect(data.message).toBe('Match confirmed and reconciliation logged successfully');
    });

    it('should handle confirmation without hashedAccountIdentifier', async () => {
      const requestWithoutHash = {
        ...mockConfirmRequest,
        paymentData: {
          ...mockPaymentData,
          hashedAccountIdentifier: undefined,
        },
      };

      const mockReconciliationLog = {
        id: 'reconciliation-123',
        transactionFingerprint: 'test123',
      };

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          reconciliationLog: {
            findUnique: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue(mockReconciliationLog),
          },
          contact: {
            findUnique: jest.fn().mockResolvedValue({ id: 'contact-123' }),
          },
          user: {
            findUnique: jest.fn().mockResolvedValue({ id: 1, username: 'admin' }),
          },
          paymentSource: {
            upsert: jest.fn(),
          },
        };
        return await callback(mockTx as any);
      });

      const request = new NextRequest('http://localhost:3000/api/reconciliation/confirm', {
        method: 'POST',
        body: JSON.stringify(requestWithoutHash),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Verify paymentSource.upsert was not called
      const transactionCallback = mockPrisma.$transaction.mock.calls[0][0];
      const mockTx = {
        reconciliationLog: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue(mockReconciliationLog),
        },
        contact: {
          findUnique: jest.fn().mockResolvedValue({ id: 'contact-123' }),
        },
        user: {
          findUnique: jest.fn().mockResolvedValue({ id: 1, username: 'admin' }),
        },
        paymentSource: {
          upsert: jest.fn(),
        },
      };
      await transactionCallback(mockTx as any);
      expect(mockTx.paymentSource.upsert).not.toHaveBeenCalled();
    });
  });

  describe('Database Error Handling', () => {
    beforeEach(() => {
      mockGetServerSession.mockResolvedValue({
        user: { name: 'admin', role: 'admin' },
      });
    });

    it('should return 409 when transaction already reconciled', async () => {
      mockPrisma.$transaction.mockRejectedValue(new Error('Transaction has already been reconciled'));

      const request = new NextRequest('http://localhost:3000/api/reconciliation/confirm', {
        method: 'POST',
        body: JSON.stringify(mockConfirmRequest),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.success).toBe(false);
      expect(data.message).toBe('This transaction has already been reconciled');
    });

    it('should return 404 when contact not found', async () => {
      mockPrisma.$transaction.mockRejectedValue(new Error('Contact not found'));

      const request = new NextRequest('http://localhost:3000/api/reconciliation/confirm', {
        method: 'POST',
        body: JSON.stringify(mockConfirmRequest),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.message).toBe('Contact not found');
    });

    it('should return 401 when user not found', async () => {
      mockPrisma.$transaction.mockRejectedValue(new Error('User not found'));

      const request = new NextRequest('http://localhost:3000/api/reconciliation/confirm', {
        method: 'POST',
        body: JSON.stringify(mockConfirmRequest),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.message).toBe('User session invalid');
    });

    it('should return 500 for generic database errors', async () => {
      mockPrisma.$transaction.mockRejectedValue(new Error('Database connection failed'));

      const request = new NextRequest('http://localhost:3000/api/reconciliation/confirm', {
        method: 'POST',
        body: JSON.stringify(mockConfirmRequest),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.message).toBe('Failed to confirm match');
    });
  });

  describe('Detailed Database Transaction Flow', () => {
    beforeEach(() => {
      mockGetServerSession.mockResolvedValue({
        user: { name: 'admin', role: 'admin' },
      });
    });

    it('should execute complete database transaction flow', async () => {
      const mockReconciliationLog = {
        id: 'reconciliation-123',
        transactionFingerprint: 'test123',
        amount: new Decimal(50.00),
        contactId: 'contact-123',
      };

      const transactionSteps: string[] = [];

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          reconciliationLog: {
            findUnique: jest.fn().mockImplementation(() => {
              transactionSteps.push('check-existing');
              return Promise.resolve(null);
            }),
            create: jest.fn().mockImplementation((data) => {
              transactionSteps.push('create-reconciliation');
              expect(data.transactionFingerprint).toBe('test123');
              expect(data.amount).toEqual(new Decimal(50.00));
              expect(data.contactId).toBe('contact-123');
              return Promise.resolve(mockReconciliationLog);
            }),
          },
          contact: {
            findUnique: jest.fn().mockImplementation(() => {
              transactionSteps.push('verify-contact');
              return Promise.resolve({ id: 'contact-123', firstName: 'John' });
            }),
          },
          user: {
            findUnique: jest.fn().mockImplementation(() => {
              transactionSteps.push('find-user');
              return Promise.resolve({ id: 1, username: 'admin' });
            }),
          },
          paymentSource: {
            upsert: jest.fn().mockImplementation(() => {
              transactionSteps.push('upsert-payment-source');
              return Promise.resolve({ id: 'payment-source-123' });
            }),
          },
        };
        return await callback(mockTx as any);
      });

      const request = new NextRequest('http://localhost:3000/api/reconciliation/confirm', {
        method: 'POST',
        body: JSON.stringify(mockConfirmRequest),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(transactionSteps).toEqual([
        'check-existing',
        'verify-contact',
        'find-user',
        'create-reconciliation',
        'upsert-payment-source'
      ]);
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      mockGetServerSession.mockResolvedValue({
        user: { name: 'admin', role: 'admin' },
      });
    });

    it('should handle unexpected errors', async () => {
      mockGetServerSession.mockRejectedValue(new Error('Session error'));
      
      const request = new NextRequest('http://localhost:3000/api/reconciliation/confirm', {
        method: 'POST',
        body: JSON.stringify(mockConfirmRequest),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.message).toBe('Internal server error');
    });
  });
});