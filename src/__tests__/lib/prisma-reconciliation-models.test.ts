import { prisma } from '@/lib/prisma';
import { PaymentSource, ReconciliationLog, Contact, User } from '@prisma/client';

// Type for PaymentSource with relations
type PaymentSourceWithContact = PaymentSource & {
  contact: Contact;
};

// Type for ReconciliationLog with relations  
type ReconciliationLogWithRelations = ReconciliationLog & {
  reconciledBy: User;
  contact: Contact;
};

// Mock console methods to avoid noise during tests
const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

describe('Prisma Reconciliation Models', () => {
  // Test data
  const testUser = {
    username: 'test-reconciler',
    password: 'hashedpassword',
    role: 'admin'
  };

  const testContact = {
    id: 'test-contact-id',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    membershipType: 'premium'
  };

  beforeEach(() => {
    consoleSpy.mockClear();
    consoleLogSpy.mockClear();
  });

  afterAll(() => {
    consoleSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  describe('PaymentSource Model', () => {
    let createdUser: User;
    let createdContact: Contact;
    let createdPaymentSource: PaymentSourceWithContact;

    beforeAll(async () => {
      // Create test user and contact
      createdUser = await prisma.user.create({ data: testUser });
      createdContact = await prisma.contact.create({ data: testContact });
    });

    afterAll(async () => {
      // Cleanup test data
      await prisma.paymentSource.deleteMany({
        where: { contactId: createdContact.id }
      });
      await prisma.contact.delete({ where: { id: createdContact.id } });
      await prisma.user.delete({ where: { id: createdUser.id } });
    });

    it('should create PaymentSource with hashed identifier', async () => {
      const paymentSourceData = {
        hashedIdentifier: 'hashed_account_12345',
        sourceType: 'bank_account',
        contactId: createdContact.id
      };

      createdPaymentSource = await prisma.paymentSource.create({
        data: paymentSourceData,
        include: { contact: true }
      });

      expect(createdPaymentSource.hashedIdentifier).toBe('hashed_account_12345');
      expect(createdPaymentSource.sourceType).toBe('bank_account');
      expect(createdPaymentSource.contactId).toBe(createdContact.id);
      expect(createdPaymentSource.contact.email).toBe('john.doe@example.com');
      expect(createdPaymentSource.createdAt).toBeDefined();
      expect(createdPaymentSource.updatedAt).toBeDefined();
    });

    it('should enforce unique constraint on hashedIdentifier', async () => {
      const duplicateData = {
        hashedIdentifier: 'hashed_account_12345', // Same as above
        sourceType: 'stripe_source',
        contactId: createdContact.id
      };

      await expect(
        prisma.paymentSource.create({ data: duplicateData })
      ).rejects.toThrow();
    });

    it('should maintain foreign key relationship with Contact', async () => {
      const paymentSourceWithContact = await prisma.paymentSource.findUnique({
        where: { id: createdPaymentSource.id },
        include: { contact: true }
      });

      expect(paymentSourceWithContact?.contact.id).toBe(createdContact.id);
      expect(paymentSourceWithContact?.contact.firstName).toBe('John');
    });

    it('should support different source types', async () => {
      const stripeSource = await prisma.paymentSource.create({
        data: {
          hashedIdentifier: 'hashed_stripe_67890',
          sourceType: 'stripe_source',
          contactId: createdContact.id
        }
      });

      expect(stripeSource.sourceType).toBe('stripe_source');
      
      await prisma.paymentSource.delete({ where: { id: stripeSource.id } });
    });
  });

  describe('ReconciliationLog Model', () => {
    let createdUser: User;
    let createdContact: Contact;
    let createdReconciliationLog: ReconciliationLogWithRelations;

    beforeAll(async () => {
      // Create test user and contact
      createdUser = await prisma.user.create({ data: testUser });
      createdContact = await prisma.contact.create({ data: testContact });
    });

    afterAll(async () => {
      // Cleanup test data
      await prisma.reconciliationLog.deleteMany({
        where: { contactId: createdContact.id }
      });
      await prisma.contact.delete({ where: { id: createdContact.id } });
      await prisma.user.delete({ where: { id: createdUser.id } });
    });

    it('should create ReconciliationLog with all required fields', async () => {
      const reconciliationData = {
        transactionFingerprint: 'unique_transaction_123',
        paymentDate: new Date('2024-01-15'),
        amount: 29.99,
        source: 'lloyds_bank',
        transactionRef: 'TXN_REF_123',
        reconciledByUserId: createdUser.id,
        contactId: createdContact.id,
        metadata: {
          description: 'Monthly membership payment',
          originalAmount: '£29.99'
        }
      };

      createdReconciliationLog = await prisma.reconciliationLog.create({
        data: reconciliationData,
        include: { 
          reconciledBy: true, 
          contact: true 
        }
      });

      expect(createdReconciliationLog.transactionFingerprint).toBe('unique_transaction_123');
      expect(createdReconciliationLog.paymentDate).toEqual(new Date('2024-01-15'));
      expect(Number(createdReconciliationLog.amount)).toBe(29.99);
      expect(createdReconciliationLog.source).toBe('lloyds_bank');
      expect(createdReconciliationLog.transactionRef).toBe('TXN_REF_123');
      expect(createdReconciliationLog.reconciledBy.username).toBe('test-reconciler');
      expect(createdReconciliationLog.contact.email).toBe('john.doe@example.com');
      expect(createdReconciliationLog.metadata).toEqual({
        description: 'Monthly membership payment',
        originalAmount: '£29.99'
      });
      expect(createdReconciliationLog.reconciledAt).toBeDefined();
    });

    it('should enforce unique constraint on transactionFingerprint', async () => {
      const duplicateData = {
        transactionFingerprint: 'unique_transaction_123', // Same as above
        paymentDate: new Date('2024-01-16'),
        amount: 39.99,
        source: 'stripe',
        transactionRef: 'DIFFERENT_REF',
        reconciledByUserId: createdUser.id,
        contactId: createdContact.id
      };

      await expect(
        prisma.reconciliationLog.create({ data: duplicateData })
      ).rejects.toThrow();
    });

    it('should maintain foreign key relationships with User and Contact', async () => {
      const logWithRelations = await prisma.reconciliationLog.findUnique({
        where: { id: createdReconciliationLog.id },
        include: { 
          reconciledBy: true, 
          contact: true 
        }
      });

      expect(logWithRelations?.reconciledBy.id).toBe(createdUser.id);
      expect(logWithRelations?.reconciledBy.username).toBe('test-reconciler');
      expect(logWithRelations?.contact.id).toBe(createdContact.id);
      expect(logWithRelations?.contact.firstName).toBe('John');
    });

    it('should handle decimal amounts precisely', async () => {
      const preciseAmountLog = await prisma.reconciliationLog.create({
        data: {
          transactionFingerprint: 'precise_amount_test',
          paymentDate: new Date('2024-01-15'),
          amount: 123.45,
          source: 'stripe',
          transactionRef: 'PRECISE_REF',
          reconciledByUserId: createdUser.id,
          contactId: createdContact.id
        }
      });

      expect(Number(preciseAmountLog.amount)).toBe(123.45);
      
      await prisma.reconciliationLog.delete({ where: { id: preciseAmountLog.id } });
    });

    it('should support different payment sources', async () => {
      const stripeLog = await prisma.reconciliationLog.create({
        data: {
          transactionFingerprint: 'stripe_transaction_456',
          paymentDate: new Date('2024-01-16'),
          amount: 49.99,
          source: 'stripe',
          transactionRef: 'STRIPE_REF_456',
          reconciledByUserId: createdUser.id,
          contactId: createdContact.id
        }
      });

      expect(stripeLog.source).toBe('stripe');
      
      await prisma.reconciliationLog.delete({ where: { id: stripeLog.id } });
    });
  });

  describe('Model Relationships', () => {
    let createdUser: User;
    let createdContact: Contact;

    beforeAll(async () => {
      createdUser = await prisma.user.create({ data: testUser });
      createdContact = await prisma.contact.create({ data: testContact });
    });

    afterAll(async () => {
      // Clean up in correct order due to foreign key constraints
      await prisma.reconciliationLog.deleteMany({
        where: { contactId: createdContact.id }
      });
      await prisma.paymentSource.deleteMany({
        where: { contactId: createdContact.id }
      });
      await prisma.contact.delete({ where: { id: createdContact.id } });
      await prisma.user.delete({ where: { id: createdUser.id } });
    });

    it('should retrieve Contact with PaymentSources relationship', async () => {
      // Create payment source
      const paymentSource = await prisma.paymentSource.create({
        data: {
          hashedIdentifier: 'contact_relationship_test',
          sourceType: 'bank_account',
          contactId: createdContact.id
        }
      });

      // Retrieve contact with payment sources
      const contactWithPaymentSources = await prisma.contact.findUnique({
        where: { id: createdContact.id },
        include: { paymentSources: true }
      });

      expect(contactWithPaymentSources?.paymentSources).toHaveLength(1);
      expect(contactWithPaymentSources?.paymentSources[0].hashedIdentifier).toBe('contact_relationship_test');

      await prisma.paymentSource.delete({ where: { id: paymentSource.id } });
    });

    it('should retrieve Contact with ReconciliationLogs relationship', async () => {
      // Create reconciliation log
      const reconciliationLog = await prisma.reconciliationLog.create({
        data: {
          transactionFingerprint: 'contact_relationship_log_test',
          paymentDate: new Date('2024-01-15'),
          amount: 25.00,
          source: 'lloyds_bank',
          transactionRef: 'REL_TEST_REF',
          reconciledByUserId: createdUser.id,
          contactId: createdContact.id
        }
      });

      // Retrieve contact with reconciliation logs
      const contactWithLogs = await prisma.contact.findUnique({
        where: { id: createdContact.id },
        include: { reconciliationLogs: true }
      });

      expect(contactWithLogs?.reconciliationLogs).toHaveLength(1);
      expect(contactWithLogs?.reconciliationLogs[0].transactionFingerprint).toBe('contact_relationship_log_test');

      await prisma.reconciliationLog.delete({ where: { id: reconciliationLog.id } });
    });

    it('should retrieve User with ReconciliationLogs relationship', async () => {
      // Create reconciliation log
      const reconciliationLog = await prisma.reconciliationLog.create({
        data: {
          transactionFingerprint: 'user_relationship_test',
          paymentDate: new Date('2024-01-15'),
          amount: 35.00,
          source: 'stripe',
          transactionRef: 'USER_REL_TEST',
          reconciledByUserId: createdUser.id,
          contactId: createdContact.id
        }
      });

      // Retrieve user with reconciliation logs
      const userWithLogs = await prisma.user.findUnique({
        where: { id: createdUser.id },
        include: { reconciliationLogs: true }
      });

      expect(userWithLogs?.reconciliationLogs).toHaveLength(1);
      expect(userWithLogs?.reconciliationLogs[0].transactionFingerprint).toBe('user_relationship_test');

      await prisma.reconciliationLog.delete({ where: { id: reconciliationLog.id } });
    });
  });

  describe('Database Indexes and Performance', () => {
    let createdUser: User;
    let createdContact: Contact;

    beforeAll(async () => {
      createdUser = await prisma.user.create({ data: testUser });
      createdContact = await prisma.contact.create({ data: testContact });
    });

    afterAll(async () => {
      await prisma.reconciliationLog.deleteMany({
        where: { contactId: createdContact.id }
      });
      await prisma.paymentSource.deleteMany({
        where: { contactId: createdContact.id }
      });
      await prisma.contact.delete({ where: { id: createdContact.id } });
      await prisma.user.delete({ where: { id: createdUser.id } });
    });

    it('should efficiently query PaymentSource by hashedIdentifier', async () => {
      const paymentSource = await prisma.paymentSource.create({
        data: {
          hashedIdentifier: 'performance_test_hash',
          sourceType: 'bank_account',
          contactId: createdContact.id
        }
      });

      const startTime = Date.now();
      const found = await prisma.paymentSource.findUnique({
        where: { hashedIdentifier: 'performance_test_hash' }
      });
      const queryTime = Date.now() - startTime;

      expect(found?.id).toBe(paymentSource.id);
      expect(queryTime).toBeLessThan(100); // Should be fast with unique index

      await prisma.paymentSource.delete({ where: { id: paymentSource.id } });
    });

    it('should efficiently query ReconciliationLog by transactionFingerprint', async () => {
      const reconciliationLog = await prisma.reconciliationLog.create({
        data: {
          transactionFingerprint: 'performance_fingerprint_test',
          paymentDate: new Date('2024-01-15'),
          amount: 45.00,
          source: 'lloyds_bank',
          transactionRef: 'PERF_TEST_REF',
          reconciledByUserId: createdUser.id,
          contactId: createdContact.id
        }
      });

      const startTime = Date.now();
      const found = await prisma.reconciliationLog.findUnique({
        where: { transactionFingerprint: 'performance_fingerprint_test' }
      });
      const queryTime = Date.now() - startTime;

      expect(found?.id).toBe(reconciliationLog.id);
      expect(queryTime).toBeLessThan(100); // Should be fast with unique index

      await prisma.reconciliationLog.delete({ where: { id: reconciliationLog.id } });
    });

    it('should efficiently query ReconciliationLog by composite index (paymentDate, amount)', async () => {
      const testDate = new Date('2024-01-20');
      const testAmount = 55.00;

      const reconciliationLog = await prisma.reconciliationLog.create({
        data: {
          transactionFingerprint: 'composite_index_test',
          paymentDate: testDate,
          amount: testAmount,
          source: 'stripe',
          transactionRef: 'COMPOSITE_TEST_REF',
          reconciledByUserId: createdUser.id,
          contactId: createdContact.id
        }
      });

      const startTime = Date.now();
      const found = await prisma.reconciliationLog.findMany({
        where: {
          AND: [
            { paymentDate: testDate },
            { amount: testAmount }
          ]
        }
      });
      const queryTime = Date.now() - startTime;

      expect(found).toHaveLength(1);
      expect(found[0].id).toBe(reconciliationLog.id);
      expect(queryTime).toBeLessThan(100); // Should be fast with composite index

      await prisma.reconciliationLog.delete({ where: { id: reconciliationLog.id } });
    });
  });

  describe('Constraint Validation', () => {
    let createdUser: User;
    let createdContact: Contact;

    beforeAll(async () => {
      createdUser = await prisma.user.create({ data: testUser });
      createdContact = await prisma.contact.create({ data: testContact });
    });

    afterAll(async () => {
      await prisma.reconciliationLog.deleteMany({
        where: { contactId: createdContact.id }
      });
      await prisma.paymentSource.deleteMany({
        where: { contactId: createdContact.id }
      });
      await prisma.contact.delete({ where: { id: createdContact.id } });
      await prisma.user.delete({ where: { id: createdUser.id } });
    });

    it('should reject PaymentSource with invalid contactId', async () => {
      await expect(
        prisma.paymentSource.create({
          data: {
            hashedIdentifier: 'invalid_contact_test',
            sourceType: 'bank_account',
            contactId: 'non-existent-contact-id'
          }
        })
      ).rejects.toThrow();
    });

    it('should reject ReconciliationLog with invalid reconciledByUserId', async () => {
      await expect(
        prisma.reconciliationLog.create({
          data: {
            transactionFingerprint: 'invalid_user_test',
            paymentDate: new Date(),
            amount: 25.00,
            source: 'test',
            transactionRef: 'TEST_REF',
            reconciledByUserId: 99999, // Non-existent user ID
            contactId: createdContact.id
          }
        })
      ).rejects.toThrow();
    });

    it('should reject ReconciliationLog with invalid contactId', async () => {
      await expect(
        prisma.reconciliationLog.create({
          data: {
            transactionFingerprint: 'invalid_contact_log_test',
            paymentDate: new Date(),
            amount: 25.00,
            source: 'test',
            transactionRef: 'TEST_REF',
            reconciledByUserId: createdUser.id,
            contactId: 'non-existent-contact-id'
          }
        })
      ).rejects.toThrow();
    });
  });
});