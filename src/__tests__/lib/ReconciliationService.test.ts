import { ReconciliationService } from '../../lib/ReconciliationService';
import { prisma } from '../../lib/prisma';
import * as ghlApi from '../../lib/ghl-api';
import type { ConfirmMatchRequest } from '../../lib/ReconciliationService';
import type { ParsedPaymentData } from '../../lib/CsvParsingService';

// Mock dependencies
jest.mock('../../lib/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
    reconciliationLog: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
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

jest.mock('../../lib/ghl-api', () => ({
  updateContactInGHL: jest.fn(),
  updateMembershipStatus: jest.fn(),
  checkGHLConnection: jest.fn(),
}));

const mockPrisma = prisma as any;
const mockUpdateContactInGHL = ghlApi.updateContactInGHL as jest.MockedFunction<typeof ghlApi.updateContactInGHL>;
const mockUpdateMembershipStatus = ghlApi.updateMembershipStatus as jest.MockedFunction<typeof ghlApi.updateMembershipStatus>;
const mockCheckGHLConnection = ghlApi.checkGHLConnection as jest.MockedFunction<typeof ghlApi.checkGHLConnection>;

describe('ReconciliationService', () => {
  let reconciliationService: ReconciliationService;
  
  const mockPaymentData: ParsedPaymentData = {
    transactionFingerprint: 'test-fingerprint-123',
    amount: 50.00,
    paymentDate: new Date('2024-01-15'),
    source: 'BANK_CSV' as const,
    transactionRef: 'REF123',
    description: 'MEMBERSHIP PAYMENT - JOHN SMITH',
    hashedAccountIdentifier: 'hashed-account-123',
  };

  const mockConfirmRequest: ConfirmMatchRequest = {
    paymentData: mockPaymentData,
    contactId: 'contact-123',
    confidence: 0.95,
    reasoning: { nameMatch: { score: 0.9 } },
    reconciledByUserId: 1,
  };

  const mockReconciliationLog = {
    id: 'recon-log-123',
    transactionFingerprint: 'test-fingerprint-123',
    paymentDate: new Date('2024-01-15'),
    amount: 50.00,
    source: 'BANK_CSV',
    transactionRef: 'REF123',
    reconciledByUserId: 1,
    contactId: 'contact-123',
    metadata: {},
  };

  const mockContact = {
    id: 'contact-123',
    firstName: 'John',
    lastName: 'Smith',
    email: 'john@example.com',
  };

  const mockUser = {
    id: 1,
    username: 'admin',
    role: 'admin',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    reconciliationService = new ReconciliationService();
  });

  describe('confirmMatch', () => {
    beforeEach(() => {
      // Setup default successful mocks
      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        // Mock transaction context
        const txContext = {
          reconciliationLog: {
            findUnique: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue(mockReconciliationLog),
            delete: jest.fn().mockResolvedValue({}),
          },
          contact: {
            findUnique: jest.fn().mockResolvedValue(mockContact),
          },
          user: {
            findUnique: jest.fn().mockResolvedValue(mockUser),
          },
          paymentSource: {
            upsert: jest.fn().mockResolvedValue({}),
            delete: jest.fn().mockResolvedValue({}),
          },
        };
        return await callback(txContext);
      });

      mockUpdateMembershipStatus.mockResolvedValue({ success: true });
    });

    it('should successfully confirm a match with valid data', async () => {
      const result = await reconciliationService.confirmMatch(mockConfirmRequest);

      expect(result.success).toBe(true);
      expect(result.reconciliationLogId).toBe('recon-log-123');
      expect(result.ghlUpdateResult).toEqual({ success: true });
      expect(result.errors).toBeUndefined();
      expect(result.rollbackPerformed).toBeUndefined();
    });

    it('should validate required payment data fields', async () => {
      const invalidRequest = {
        ...mockConfirmRequest,
        paymentData: {
          ...mockPaymentData,
          transactionFingerprint: '',
        },
      };

      const result = await reconciliationService.confirmMatch(invalidRequest);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Reconciliation failed: Transaction fingerprint is required');
    });

    it('should validate payment amount is positive', async () => {
      const invalidRequest = {
        ...mockConfirmRequest,
        paymentData: {
          ...mockPaymentData,
          amount: -10,
        },
      };

      const result = await reconciliationService.confirmMatch(invalidRequest);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Reconciliation failed: Valid payment amount is required');
    });

    it('should validate payment date format', async () => {
      const invalidRequest = {
        ...mockConfirmRequest,
        paymentData: {
          ...mockPaymentData,
          paymentDate: 'invalid-date' as any,
        },
      };

      const result = await reconciliationService.confirmMatch(invalidRequest);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Reconciliation failed: Invalid payment date format');
    });

    it('should handle duplicate transaction fingerprints', async () => {
      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        const txContext = {
          reconciliationLog: {
            findUnique: jest.fn().mockResolvedValue(mockReconciliationLog), // Existing record
            create: jest.fn(),
          },
          contact: { findUnique: jest.fn() },
          user: { findUnique: jest.fn() },
          paymentSource: { upsert: jest.fn() },
        };
        return await callback(txContext);
      });

      const result = await reconciliationService.confirmMatch(mockConfirmRequest);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Reconciliation failed: Transaction has already been reconciled');
    });

    it('should handle non-existent contact', async () => {
      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        const txContext = {
          reconciliationLog: {
            findUnique: jest.fn().mockResolvedValue(null),
            create: jest.fn(),
          },
          contact: {
            findUnique: jest.fn().mockResolvedValue(null), // Contact not found
          },
          user: { findUnique: jest.fn() },
          paymentSource: { upsert: jest.fn() },
        };
        return await callback(txContext);
      });

      const result = await reconciliationService.confirmMatch(mockConfirmRequest);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Reconciliation failed: Contact not found');
    });

    it('should handle GHL API failures with rollback', async () => {
      mockUpdateMembershipStatus.mockRejectedValue(new Error('GHL API Error'));
      
      // Mock the transaction for both creating reconciliation log and rollback
      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        const txContext = {
          reconciliationLog: {
            findUnique: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue(mockReconciliationLog),
            delete: jest.fn().mockResolvedValue({}),
          },
          contact: { findUnique: jest.fn().mockResolvedValue(mockContact) },
          user: { findUnique: jest.fn().mockResolvedValue(mockUser) },
          paymentSource: { upsert: jest.fn().mockResolvedValue({}) },
        };
        return await callback(txContext);
      });

      const result = await reconciliationService.confirmMatch(mockConfirmRequest);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('GHL update failed: GHL API Error');
      expect(result.rollbackPerformed).toBe(true);
    }, 10000); // Increase timeout

    it('should calculate correct GHL renewal date', async () => {
      await reconciliationService.confirmMatch(mockConfirmRequest);

      expect(mockUpdateMembershipStatus).toHaveBeenCalledWith('contact-123', {
        renewalDate: expect.any(Date),
        membershipStatus: 'active',
        paymentAmount: 50.00,
        paymentDate: expect.any(Date),
        paidTag: true,
      });
    });

    it('should create payment source when hashedAccountIdentifier exists', async () => {
      let paymentSourceUpsertCalled = false;
      
      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        const txContext = {
          reconciliationLog: {
            findUnique: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue(mockReconciliationLog),
          },
          contact: { findUnique: jest.fn().mockResolvedValue(mockContact) },
          user: { findUnique: jest.fn().mockResolvedValue(mockUser) },
          paymentSource: {
            upsert: jest.fn().mockImplementation(() => {
              paymentSourceUpsertCalled = true;
              return Promise.resolve({});
            }),
          },
        };
        return await callback(txContext);
      });

      await reconciliationService.confirmMatch(mockConfirmRequest);

      expect(paymentSourceUpsertCalled).toBe(true);
    });

    it('should handle WordPress update placeholders', async () => {
      const result = await reconciliationService.confirmMatch(mockConfirmRequest);

      expect(result.success).toBe(true);
      expect(result.wordpressUpdateResult).toEqual({
        status: 'skipped',
        message: 'WordPress service not configured'
      });
    });
  });

  describe('healthCheck', () => {
    it('should check database health successfully', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ '1': 1 }]);

      const result = await reconciliationService.healthCheck();

      expect(result.database).toBe(true);
      expect(mockPrisma.$queryRaw).toHaveBeenCalledWith(expect.any(Array));
    });

    it('should handle database health check failure', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('Database connection failed'));

      const result = await reconciliationService.healthCheck();

      expect(result.database).toBe(false);
    });

    it('should check GHL configuration', async () => {
      // Mock environment variables
      process.env.GHL_API_KEY = 'test-api-key';
      process.env.GHL_LOCATION_ID = 'test-location-id';

      const result = await reconciliationService.healthCheck();

      expect(result.ghl).toBe(true);

      // Clean up
      delete process.env.GHL_API_KEY;
      delete process.env.GHL_LOCATION_ID;
    });

    it('should detect missing GHL configuration', async () => {
      // Ensure no environment variables
      delete process.env.GHL_API_KEY;
      delete process.env.GHL_LOCATION_ID;

      const result = await reconciliationService.healthCheck();

      expect(result.ghl).toBe(false);
    });

    it('should check WordPress service health', async () => {
      // Mock database health check
      mockPrisma.$queryRaw.mockResolvedValue([{ '1': 1 }]);
      // Mock GHL health check  
      mockCheckGHLConnection.mockResolvedValue({ connected: true });

      const result = await reconciliationService.healthCheck();

      expect(result.wordpress).toBeDefined();
      expect(typeof result.wordpress).toBe('boolean');
    });
  });

  describe('retry mechanism', () => {
    it('should retry failed operations with exponential backoff', async () => {
      let attemptCount = 0;
      mockUpdateMembershipStatus
        .mockImplementationOnce(() => {
          attemptCount++;
          throw new Error('Temporary failure');
        })
        .mockImplementationOnce(() => {
          attemptCount++;
          throw new Error('Temporary failure');
        })
        .mockImplementationOnce(() => {
          attemptCount++;
          return Promise.resolve({ success: true });
        });

      const result = await reconciliationService.confirmMatch(mockConfirmRequest);

      expect(result.success).toBe(true);
      expect(attemptCount).toBe(3);
      // Note: Due to retry logic, the function is called for initial attempt + retries
      expect(mockUpdateMembershipStatus).toHaveBeenCalledTimes(3);
    }, 15000); // Increase timeout for retry delays

    it('should fail after max retry attempts', async () => {
      mockUpdateMembershipStatus.mockRejectedValue(new Error('Persistent failure'));

      const result = await reconciliationService.confirmMatch(mockConfirmRequest);

      expect(result.success).toBe(false);
      expect(result.rollbackPerformed).toBe(true);
      expect(mockUpdateMembershipStatus).toHaveBeenCalledTimes(4); // Initial + 3 retries
    }, 15000); // Increase timeout for retry delays
  });
});