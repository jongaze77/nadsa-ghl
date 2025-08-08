// src/__tests__/api/reconciliation/confirm-integration.test.ts

import { POST } from '../../../app/api/reconciliation/confirm/route';
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { prisma } from '../../../lib/prisma';
import * as ghlApi from '../../../lib/ghl-api';
import { WordPressService } from '../../../lib/WordPressService';

// Mock external dependencies
jest.mock('next-auth/next');
jest.mock('../../../lib/prisma');
jest.mock('../../../lib/ghl-api');
jest.mock('../../../lib/WordPressService');

const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
  },
  contact: {
    findUnique: jest.fn(),
  },
  reconciliationLog: {
    create: jest.fn(),
    delete: jest.fn(),
  },
  paymentSource: {
    upsert: jest.fn(),
    delete: jest.fn(),
  },
  $transaction: jest.fn(),
} as any;

// Override the prisma mock
(prisma as any).user = mockPrisma.user;
(prisma as any).contact = mockPrisma.contact;
(prisma as any).reconciliationLog = mockPrisma.reconciliationLog;
(prisma as any).paymentSource = mockPrisma.paymentSource;
(prisma as any).$transaction = mockPrisma.$transaction;

const mockGhlApi = ghlApi as jest.Mocked<typeof ghlApi>;
const MockWordPressService = WordPressService as jest.MockedClass<typeof WordPressService>;

describe('POST /api/reconciliation/confirm - Integration Tests', () => {
  const mockUser = {
    id: 'user-123',
    username: 'admin',
    role: 'admin',
  };

  const mockContact = {
    id: 'contact-456',
    email: 'john@example.com',
    firstName: 'John',
    lastName: 'Smith',
    membershipType: 'Full',
    customFields: {},
  };

  const mockPaymentData = {
    transactionFingerprint: 'payment-123',
    amount: 50.00,
    paymentDate: new Date('2024-01-15'),
    source: 'BANK_CSV' as const,
    transactionRef: 'REF123',
    description: 'MEMBERSHIP PAYMENT',
  };

  const mockRequest = {
    paymentData: mockPaymentData,
    contactId: 'contact-456',
    confidence: 0.95,
    reasoning: { match: 'email_and_amount' },
  };

  const mockReconciliationLog = {
    id: 'reconciliation-123',
    transactionFingerprint: 'payment-123',
    paymentDate: mockPaymentData.paymentDate,
    amount: mockPaymentData.amount,
    source: mockPaymentData.source,
    contactId: 'contact-456',
    reconciledByUserId: 'user-123',
    reconciledAt: new Date(),
  };

  let mockWordPressInstance: jest.Mocked<WordPressService>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock authentication
    mockGetServerSession.mockResolvedValue({
      user: { name: 'admin', role: 'admin' },
    } as any);

    // Mock database operations
    mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);
    mockPrisma.contact.findUnique.mockResolvedValue(mockContact as any);
    mockPrisma.reconciliationLog.create.mockResolvedValue(mockReconciliationLog as any);
    mockPrisma.paymentSource.upsert.mockResolvedValue({} as any);

    // Mock transaction to execute the callback
    mockPrisma.$transaction.mockImplementation(async (callback: any) => {
      if (typeof callback === 'function') {
        return await callback(mockPrisma);
      }
      return callback;
    });

    // Mock GHL API
    mockGhlApi.updateMembershipStatus.mockResolvedValue({ 
      success: true, 
      contactId: 'contact-456' 
    });

    // Mock WordPress service
    mockWordPressInstance = {
      updateUserFromReconciliation: jest.fn().mockResolvedValue({ 
        success: true, 
        userId: 123 
      }),
      testConnection: jest.fn().mockResolvedValue({ 
        connected: true 
      }),
    } as any;

    MockWordPressService.mockImplementation(() => mockWordPressInstance);
  });

  describe('Complete Reconciliation Workflow', () => {
    it('should successfully complete end-to-end reconciliation', async () => {
      const request = new NextRequest('http://localhost:3000/api/reconciliation/confirm', {
        method: 'POST',
        body: JSON.stringify(mockRequest),
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.reconciliationLogId).toBeDefined();
      expect(responseData.message).toBe('Match confirmed and reconciliation completed successfully');

      // Verify database operations
      expect(mockPrisma.contact.findUnique).toHaveBeenCalledWith({
        where: { id: 'contact-456' },
      });

      expect(mockPrisma.reconciliationLog.create).toHaveBeenCalledWith({
        data: {
          transactionFingerprint: 'payment-123',
          paymentDate: mockPaymentData.paymentDate,
          amount: mockPaymentData.amount,
          source: mockPaymentData.source,
          contactId: 'contact-456',
          reconciledByUserId: 'user-123',
          reconciledAt: expect.any(Date),
          confidence: 0.95,
          reasoning: { match: 'email_and_amount' },
        },
      });

      expect(mockPrisma.paymentSource.upsert).toHaveBeenCalledWith({
        where: { hashedIdentifier: expect.any(String) },
        update: { contactId: 'contact-456' },
        create: {
          hashedIdentifier: expect.any(String),
          sourceType: 'BANK_CSV',
          contactId: 'contact-456',
        },
      });

      // Verify GHL update
      expect(mockGhlApi.updateMembershipStatus).toHaveBeenCalledWith(
        'contact-456',
        expect.objectContaining({
          renewalDate: expect.any(Date),
          membershipType: 'Full',
          paymentAmount: 50.00,
          paidStatus: true,
        })
      );

      // Verify WordPress update
      expect(mockWordPressInstance.updateUserFromReconciliation).toHaveBeenCalledWith(
        mockContact,
        mockPaymentData
      );

      expect(responseData.ghlUpdateResult).toEqual({
        success: true,
        contactId: 'contact-456',
      });

      expect(responseData.wordpressUpdateResult).toEqual({
        success: true,
        userId: 123,
      });
    });

    it('should handle missing contact gracefully', async () => {
      mockPrisma.contact.findUnique.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/reconciliation/confirm', {
        method: 'POST',
        body: JSON.stringify(mockRequest),
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(422);
      expect(responseData.success).toBe(false);
      expect(responseData.errors).toContain('Contact not found');

      // Verify no external updates were attempted
      expect(mockGhlApi.updateMembershipStatus).not.toHaveBeenCalled();
      expect(mockWordPressInstance.updateUserFromReconciliation).not.toHaveBeenCalled();
    });

    it('should rollback database changes when GHL update fails', async () => {
      // Mock GHL API failure
      mockGhlApi.updateMembershipStatus.mockRejectedValue(new Error('GHL API Error'));

      const request = new NextRequest('http://localhost:3000/api/reconciliation/confirm', {
        method: 'POST',
        body: JSON.stringify(mockRequest),
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData.success).toBe(false);
      expect(responseData.errors).toContain('Failed to update GHL contact');

      // Verify transaction was attempted but would be rolled back
      expect(mockPrisma.$transaction).toHaveBeenCalled();

      // WordPress update should not be attempted if GHL fails
      expect(mockWordPressInstance.updateUserFromReconciliation).not.toHaveBeenCalled();
    });

    it('should rollback when WordPress update fails', async () => {
      // Mock WordPress service failure
      mockWordPressInstance.updateUserFromReconciliation.mockRejectedValue(new Error('WordPress API Error'));

      const request = new NextRequest('http://localhost:3000/api/reconciliation/confirm', {
        method: 'POST',
        body: JSON.stringify(mockRequest),
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData.success).toBe(false);
      expect(responseData.errors).toContain('Failed to update WordPress user');

      // Verify both services were attempted
      expect(mockGhlApi.updateMembershipStatus).toHaveBeenCalled();
      expect(mockWordPressInstance.updateUserFromReconciliation).toHaveBeenCalled();

      // Transaction would be rolled back
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should handle partial failure with detailed error reporting', async () => {
      // Mock GHL success but WordPress failure
      mockWordPressInstance.updateUserFromReconciliation.mockResolvedValue({ 
        success: false 
      });

      const request = new NextRequest('http://localhost:3000/api/reconciliation/confirm', {
        method: 'POST',
        body: JSON.stringify(mockRequest),
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData.success).toBe(false);
      expect(responseData.ghlUpdateResult).toEqual({
        success: true,
        contactId: 'contact-456',
      });
      expect(responseData.wordpressUpdateResult).toEqual({
        success: false,
      });
      expect(responseData.errors).toContain('WordPress user update failed');
    });

    it('should validate request payload', async () => {
      const invalidRequest = {
        paymentData: {
          // Missing required fields
          transactionFingerprint: '',
          amount: -50,
        },
        contactId: '',
      };

      const request = new NextRequest('http://localhost:3000/api/reconciliation/confirm', {
        method: 'POST',
        body: JSON.stringify(invalidRequest),
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.success).toBe(false);
      expect(responseData.message).toBeDefined();
    });

    it('should require admin role', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { name: 'user', role: 'user' },
      } as any);

      const request = new NextRequest('http://localhost:3000/api/reconciliation/confirm', {
        method: 'POST',
        body: JSON.stringify(mockRequest),
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(403);
      expect(responseData.success).toBe(false);
      expect(responseData.message).toBe('Forbidden: Admin access required');
    });

    it('should handle unauthenticated requests', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/reconciliation/confirm', {
        method: 'POST',
        body: JSON.stringify(mockRequest),
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(401);
      expect(responseData.success).toBe(false);
      expect(responseData.message).toBe('Unauthorized');
    });
  });

  describe('Transaction Atomicity', () => {
    it('should maintain data consistency during database failures', async () => {
      // Mock database transaction failure
      mockPrisma.$transaction.mockRejectedValue(new Error('Database connection lost'));

      const request = new NextRequest('http://localhost:3000/api/reconciliation/confirm', {
        method: 'POST',
        body: JSON.stringify(mockRequest),
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData.success).toBe(false);

      // External services should not be called if database transaction fails
      expect(mockGhlApi.updateMembershipStatus).not.toHaveBeenCalled();
      expect(mockWordPressInstance.updateUserFromReconciliation).not.toHaveBeenCalled();
    });

    it('should provide comprehensive error details for debugging', async () => {
      // Mock multiple failure points
      mockGhlApi.updateMembershipStatus.mockRejectedValue(new Error('GHL timeout'));
      mockWordPressInstance.updateUserFromReconciliation.mockRejectedValue(new Error('WordPress auth failed'));

      const request = new NextRequest('http://localhost:3000/api/reconciliation/confirm', {
        method: 'POST',
        body: JSON.stringify(mockRequest),
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData.success).toBe(false);
      expect(responseData.errors).toContain('Failed to update GHL contact');
      expect(responseData.reconciliationLogId).toBeDefined(); // Should still have the attempted log ID
    });
  });
});