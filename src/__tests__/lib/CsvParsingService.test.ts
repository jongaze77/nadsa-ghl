import { CsvParsingService, ParsedPaymentData } from '../../lib/CsvParsingService';
import { prisma } from '../../lib/prisma';

jest.mock('../../lib/prisma', () => ({
  prisma: {
    reconciliationLog: {
      findUnique: jest.fn(),
    },
  },
}));

const mockPrisma = prisma as any;

describe('CsvParsingService', () => {
  let service: CsvParsingService;

  beforeEach(() => {
    service = new CsvParsingService();
    jest.clearAllMocks();
    mockPrisma.reconciliationLog.findUnique.mockResolvedValue(null);
  });

  describe('parseLloydsBankCsv', () => {
    const validLloydsCsv = `Transaction Date,Transaction Type,Sort Code,Account Number,Transaction Description,Debit Amount,Credit Amount,Balance
"01/01/2024","Credit","12-34-56","12345678","MEMBERSHIP PAYMENT - JOHN DOE","","50.00","1000.00"
"02/01/2024","Credit","12-34-56","12345678","RENEWAL - JANE SMITH","","75.50","1075.50"`;

    it('should parse valid Lloyds Bank CSV successfully', async () => {
      const result = await service.parseLloydsBankCsv(validLloydsCsv);

      expect(result.success).toBe(true);
      expect(result.processed).toBe(2);
      expect(result.skipped).toBe(0);
      expect(result.data).toHaveLength(2);
      
      const firstTransaction = result.data![0];
      expect(firstTransaction.amount).toBe(50.00);
      expect(firstTransaction.source).toBe('BANK_CSV');
      expect(firstTransaction.description).toBe('MEMBERSHIP PAYMENT - JOHN DOE');
      expect(firstTransaction.hashedAccountIdentifier).toBeDefined();
      expect(firstTransaction.transactionFingerprint).toBeDefined();
    });

    it('should hash account numbers and never store original values', async () => {
      const result = await service.parseLloydsBankCsv(validLloydsCsv);

      expect(result.success).toBe(true);
      const transaction = result.data![0];
      
      expect(transaction.hashedAccountIdentifier).toBeDefined();
      expect(transaction.hashedAccountIdentifier).not.toContain('12345678');
      expect(transaction.hashedAccountIdentifier).not.toContain('12-34-56');
      expect(transaction.hashedAccountIdentifier).toMatch(/^[a-f0-9]{64}$/); // SHA256 hex
    });

    it('should discard balance fields without storing them', async () => {
      const csvWithBalance = `Transaction Date,Transaction Type,Sort Code,Account Number,Transaction Description,Debit Amount,Credit Amount,Balance
"01/01/2024","Credit","12-34-56","12345678","MEMBERSHIP PAYMENT","","50.00","1000.00"`;

      const result = await service.parseLloydsBankCsv(csvWithBalance);

      expect(result.success).toBe(true);
      const transaction = result.data![0];
      
      expect(transaction).not.toHaveProperty('Balance');
      expect(transaction).not.toHaveProperty('balance');
      expect(JSON.stringify(transaction)).not.toContain('1000.00');
    });

    it('should generate unique transaction fingerprints', async () => {
      const result = await service.parseLloydsBankCsv(validLloydsCsv);

      expect(result.success).toBe(true);
      const fingerprints = result.data!.map(t => t.transactionFingerprint);
      
      expect(fingerprints).toHaveLength(2);
      expect(fingerprints[0]).not.toBe(fingerprints[1]);
      expect(fingerprints[0]).toMatch(/^[a-f0-9]{64}$/); // SHA256 hex
    });

    it('should skip duplicate transactions', async () => {
      mockPrisma.reconciliationLog.findUnique.mockResolvedValueOnce({ id: 1 });

      const result = await service.parseLloydsBankCsv(validLloydsCsv);

      expect(result.success).toBe(true);
      expect(result.processed).toBe(1);
      expect(result.skipped).toBe(1);
    });

    it('should skip transactions with zero or negative credit amounts', async () => {
      const csvWithZeroAmount = `Transaction Date,Transaction Type,Sort Code,Account Number,Transaction Description,Debit Amount,Credit Amount,Balance
"01/01/2024","Credit","12-34-56","12345678","MEMBERSHIP PAYMENT","","0.00","1000.00"
"02/01/2024","Credit","12-34-56","12345678","VALID PAYMENT","","50.00","1050.00"`;

      const result = await service.parseLloydsBankCsv(csvWithZeroAmount);

      expect(result.success).toBe(true);
      expect(result.processed).toBe(1);
      expect(result.skipped).toBe(1);
    });

    it('should handle missing required headers', async () => {
      const invalidCsv = `Date,Description,Amount
"01/01/2024","Payment","50.00"`;

      const result = await service.parseLloydsBankCsv(invalidCsv);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Missing required headers: Transaction Date, Account Number, Transaction Description, Credit Amount');
    });

    it('should handle empty CSV files', async () => {
      const result = await service.parseLloydsBankCsv('');

      expect(result.success).toBe(false);
      expect(result.errors).toContain('CSV file is empty');
    });

    it('should handle malformed CSV rows', async () => {
      const malformedCsv = `Transaction Date,Transaction Type,Sort Code,Account Number,Transaction Description,Debit Amount,Credit Amount,Balance
"01/01/2024","Credit","12-34-56","12345678","MEMBERSHIP PAYMENT","","50.00"`;

      const result = await service.parseLloydsBankCsv(malformedCsv);

      expect(result.success).toBe(false);
      expect(result.skipped).toBe(1);
      expect(result.errors).toContain('Row 2: Column count mismatch');
    });

    it('should handle invalid date formats', async () => {
      const invalidDateCsv = `Transaction Date,Transaction Type,Sort Code,Account Number,Transaction Description,Debit Amount,Credit Amount,Balance
"invalid-date","Credit","12-34-56","12345678","MEMBERSHIP PAYMENT","","50.00","1000.00"`;

      const result = await service.parseLloydsBankCsv(invalidDateCsv);

      expect(result.success).toBe(false);
      expect(result.skipped).toBe(1);
      expect(result.errors?.[0]).toContain('Invalid date format');
    });
  });

  describe('parseStripeCsv', () => {
    const validStripeCsv = `id,Amount,Created (UTC),Description
"ch_1234567890abcdef","-5000","2024-01-01T10:00:00Z","Membership payment"
"ch_abcdef1234567890","-7500","2024-01-02T11:00:00Z","Annual subscription"`;

    it('should parse valid Stripe CSV successfully', async () => {
      const result = await service.parseStripeCsv(validStripeCsv);

      expect(result.success).toBe(true);
      expect(result.processed).toBe(2);
      expect(result.skipped).toBe(0);
      expect(result.data).toHaveLength(2);
      
      const firstTransaction = result.data![0];
      expect(firstTransaction.amount).toBe(50.00); // Stripe amounts in cents
      expect(firstTransaction.source).toBe('STRIPE_REPORT');
      expect(firstTransaction.transactionFingerprint).toBe('ch_1234567890abcdef');
      expect(firstTransaction.description).toBe('Membership payment');
    });

    it('should use Stripe source_id as transaction fingerprint', async () => {
      const result = await service.parseStripeCsv(validStripeCsv);

      expect(result.success).toBe(true);
      const transaction = result.data![0];
      
      expect(transaction.transactionFingerprint).toBe('ch_1234567890abcdef');
      expect(transaction.transactionRef).toBe('ch_1234567890abcdef');
    });

    it('should convert Stripe amounts from cents to dollars', async () => {
      const result = await service.parseStripeCsv(validStripeCsv);

      expect(result.success).toBe(true);
      
      expect(result.data![0].amount).toBe(50.00); // -5000 cents = 50.00 dollars
      expect(result.data![1].amount).toBe(75.00); // -7500 cents = 75.00 dollars
    });

    it('should skip duplicate transactions', async () => {
      mockPrisma.reconciliationLog.findUnique.mockResolvedValueOnce({ id: 1 });

      const result = await service.parseStripeCsv(validStripeCsv);

      expect(result.success).toBe(true);
      expect(result.processed).toBe(1);
      expect(result.skipped).toBe(1);
    });

    it('should skip transactions with zero amounts', async () => {
      const csvWithZeroAmount = `id,Amount,Created (UTC),Description
"ch_zero","0","2024-01-01T10:00:00Z","Zero amount"
"ch_valid","-5000","2024-01-02T11:00:00Z","Valid payment"`;

      const result = await service.parseStripeCsv(csvWithZeroAmount);

      expect(result.success).toBe(true);
      expect(result.processed).toBe(1);
      expect(result.skipped).toBe(1);
    });

    it('should handle missing required headers', async () => {
      const invalidCsv = `id,total,date
"ch_123","5000","2024-01-01"`;

      const result = await service.parseStripeCsv(invalidCsv);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Missing required headers: Amount, Created (UTC)');
    });
  });

  describe('validateData', () => {
    it('should validate correct payment data', async () => {
      const validData: ParsedPaymentData[] = [{
        transactionFingerprint: 'abc123',
        paymentDate: new Date('2024-01-01'),
        amount: 50.00,
        source: 'BANK_CSV',
        transactionRef: 'REF123',
        description: 'Test payment'
      }];

      const result = await service.validateData(validData);

      expect(result.valid).toHaveLength(1);
      expect(result.invalid).toHaveLength(0);
    });

    it('should identify invalid payment data', async () => {
      const invalidData: ParsedPaymentData[] = [
        {
          transactionFingerprint: '',
          paymentDate: new Date('invalid'),
          amount: -10,
          source: 'INVALID_SOURCE' as any,
          transactionRef: '',
          description: 'Invalid payment'
        }
      ];

      const result = await service.validateData(invalidData);

      expect(result.valid).toHaveLength(0);
      expect(result.invalid).toHaveLength(1);
      
      const errors = result.invalid[0].errors;
      expect(errors).toContain('Missing transaction fingerprint');
      expect(errors).toContain('Invalid payment date');
      expect(errors).toContain('Invalid payment amount');
      expect(errors).toContain('Invalid payment source');
      expect(errors).toContain('Missing transaction reference');
    });

    it('should separate valid and invalid data', async () => {
      const mixedData: ParsedPaymentData[] = [
        {
          transactionFingerprint: 'valid123',
          paymentDate: new Date('2024-01-01'),
          amount: 50.00,
          source: 'BANK_CSV',
          transactionRef: 'REF123',
          description: 'Valid payment'
        },
        {
          transactionFingerprint: '',
          paymentDate: new Date('2024-01-01'),
          amount: 0,
          source: 'BANK_CSV',
          transactionRef: 'REF456',
          description: 'Invalid payment'
        }
      ];

      const result = await service.validateData(mixedData);

      expect(result.valid).toHaveLength(1);
      expect(result.invalid).toHaveLength(1);
    });
  });

  describe('CSV parsing edge cases', () => {
    it('should handle CSV with quoted fields containing commas', async () => {
      const csvWithCommas = `Transaction Date,Transaction Type,Sort Code,Account Number,Transaction Description,Debit Amount,Credit Amount,Balance
"01/01/2024","Credit","12-34-56","12345678","PAYMENT FROM SMITH, JOHN","","50.00","1000.00"`;

      const result = await service.parseLloydsBankCsv(csvWithCommas);

      expect(result.success).toBe(true);
      expect(result.data![0].description).toBe('PAYMENT FROM SMITH, JOHN');
    });

    it('should handle CSV with extra whitespace', async () => {
      const csvWithSpaces = ` Transaction Date , Transaction Type , Sort Code , Account Number , Transaction Description , Debit Amount , Credit Amount , Balance 
 "01/01/2024" , "Credit" , "12-34-56" , "12345678" , "MEMBERSHIP PAYMENT" , "" , "50.00" , "1000.00" `;

      const result = await service.parseLloydsBankCsv(csvWithSpaces);

      expect(result.success).toBe(true);
      expect(result.data![0].amount).toBe(50.00);
    });
  });

  describe('Memory safety and data cleanup', () => {
    it('should not retain sensitive data in memory after processing', async () => {
      const sensitiveData = `Transaction Date,Transaction Type,Sort Code,Account Number,Transaction Description,Debit Amount,Credit Amount,Balance
"01/01/2024","Credit","12-34-56","87654321","SECRET PAYMENT","","50.00","999999.99"`;

      const result = await service.parseLloydsBankCsv(sensitiveData);

      expect(result.success).toBe(true);
      
      // Verify sensitive data is not in result
      const resultString = JSON.stringify(result);
      expect(resultString).not.toContain('87654321');
      expect(resultString).not.toContain('999999.99');
      expect(resultString).not.toContain('Balance');
    });
  });
});