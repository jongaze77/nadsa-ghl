import { POST } from '../../../app/api/reconciliation/upload/route';
import { getServerSession } from 'next-auth/next';
import { CsvParsingService } from '../../../lib/CsvParsingService';
import { NextRequest } from 'next/server';

// Mock dependencies
jest.mock('next-auth/next');
jest.mock('../../../lib/CsvParsingService');

const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;
const mockCsvParsingService = CsvParsingService as jest.MockedClass<typeof CsvParsingService>;

describe('/api/reconciliation/upload', () => {
  let mockParseLloydsBankCsv: jest.Mock;
  let mockParseStripeCsv: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockParseLloydsBankCsv = jest.fn();
    mockParseStripeCsv = jest.fn();
    
    mockCsvParsingService.mockImplementation(() => ({
      parseLloydsBankCsv: mockParseLloydsBankCsv,
      parseStripeCsv: mockParseStripeCsv,
    } as any));
  });

  const createMockRequest = (formData: FormData): NextRequest => {
    const mockRequest = {
      formData: jest.fn().mockResolvedValue(formData),
    } as unknown as NextRequest;
    return mockRequest;
  };

  const createMockFile = (name: string, content: string, size: number = 1000): File => {
    return {
      name,
      size,
      text: jest.fn().mockResolvedValue(content),
    } as unknown as File;
  };

  describe('Authentication', () => {
    it('should return 401 when not authenticated', async () => {
      mockGetServerSession.mockResolvedValue(null);
      
      const formData = new FormData();
      const request = createMockRequest(formData);

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
      
      const formData = new FormData();
      const request = createMockRequest(formData);

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.message).toBe('Forbidden: Admin access required');
    });
  });

  describe('File Validation', () => {
    beforeEach(() => {
      mockGetServerSession.mockResolvedValue({
        user: { name: 'admin', role: 'admin' },
      });
    });

    it('should return 400 when no file provided', async () => {
      const formData = new FormData();
      formData.append('type', 'lloyds');
      
      const request = createMockRequest(formData);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.message).toBe('No file provided');
    });

    it('should return 400 when file type is missing', async () => {
      const formData = new FormData();
      const mockFile = createMockFile('test.csv', 'test content');
      formData.append('file', mockFile);
      
      const request = createMockRequest(formData);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.message).toBe('Invalid file type. Must be "lloyds" or "stripe"');
    });

    it('should return 400 when file type is invalid', async () => {
      const formData = new FormData();
      const mockFile = createMockFile('test.csv', 'test content');
      formData.append('file', mockFile);
      formData.append('type', 'invalid');
      
      const request = createMockRequest(formData);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.message).toBe('Invalid file type. Must be "lloyds" or "stripe"');
    });

    it('should return 400 when file is not CSV', async () => {
      const formData = new FormData();
      const mockFile = createMockFile('test.txt', 'test content');
      formData.append('file', mockFile);
      formData.append('type', 'lloyds');
      
      const request = createMockRequest(formData);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.message).toBe('Invalid file format. Only CSV files are accepted');
    });

    it('should return 400 when file is too large', async () => {
      const formData = new FormData();
      const mockFile = createMockFile('test.csv', 'test content', 11 * 1024 * 1024); // 11MB
      formData.append('file', mockFile);
      formData.append('type', 'lloyds');
      
      const request = createMockRequest(formData);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.message).toBe('File too large. Maximum size is 10MB');
    });

    it('should return 400 when file is empty', async () => {
      const formData = new FormData();
      const mockFile = createMockFile('test.csv', '');
      formData.append('file', mockFile);
      formData.append('type', 'lloyds');
      
      const request = createMockRequest(formData);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.message).toBe('File is empty');
    });
  });

  describe('Lloyds Bank CSV Processing', () => {
    beforeEach(() => {
      mockGetServerSession.mockResolvedValue({
        user: { name: 'admin', role: 'admin' },
      });
    });

    it('should successfully process Lloyds Bank CSV', async () => {
      const csvContent = 'Transaction Date,Account Number,Transaction Description,Credit Amount\n2024-01-01,12345678,MEMBERSHIP PAYMENT,50.00';
      const mockResult = {
        success: true,
        data: [{
          transactionFingerprint: 'test123',
          amount: 50.00,
          paymentDate: new Date('2024-01-01'),
          source: 'BANK_CSV',
          description: 'MEMBERSHIP PAYMENT',
        }],
        processed: 1,
        skipped: 0,
      };

      mockParseLloydsBankCsv.mockResolvedValue(mockResult);

      const formData = new FormData();
      const mockFile = createMockFile('test.csv', csvContent);
      formData.append('file', mockFile);
      formData.append('type', 'lloyds');
      
      const request = createMockRequest(formData);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.processed).toBe(1);
      expect(data.skipped).toBe(0);
      expect(data.data).toEqual(mockResult.data);
      expect(mockParseLloydsBankCsv).toHaveBeenCalledWith(csvContent);
    });

    it('should handle Lloyds Bank CSV parsing errors', async () => {
      const csvContent = 'invalid csv content';
      const mockResult = {
        success: false,
        errors: ['Invalid CSV format'],
        processed: 0,
        skipped: 0,
      };

      mockParseLloydsBankCsv.mockResolvedValue(mockResult);

      const formData = new FormData();
      const mockFile = createMockFile('test.csv', csvContent);
      formData.append('file', mockFile);
      formData.append('type', 'lloyds');
      
      const request = createMockRequest(formData);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.message).toBe('CSV parsing failed');
      expect(data.errors).toEqual(['Invalid CSV format']);
    });
  });

  describe('Stripe CSV Processing', () => {
    beforeEach(() => {
      mockGetServerSession.mockResolvedValue({
        user: { name: 'admin', role: 'admin' },
      });
    });

    it('should successfully process Stripe CSV', async () => {
      const csvContent = 'id,Amount,Created (UTC),Description\nch_123,5000,2024-01-01 10:00:00,Membership Payment';
      const mockResult = {
        success: true,
        data: [{
          transactionFingerprint: 'ch_123',
          amount: 50.00,
          paymentDate: new Date('2024-01-01'),
          source: 'STRIPE_REPORT',
          description: 'Membership Payment',
        }],
        processed: 1,
        skipped: 0,
      };

      mockParseStripeCsv.mockResolvedValue(mockResult);

      const formData = new FormData();
      const mockFile = createMockFile('stripe.csv', csvContent);
      formData.append('file', mockFile);
      formData.append('type', 'stripe');
      
      const request = createMockRequest(formData);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.processed).toBe(1);
      expect(data.skipped).toBe(0);
      expect(data.data).toEqual(mockResult.data);
      expect(mockParseStripeCsv).toHaveBeenCalledWith(csvContent);
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      mockGetServerSession.mockResolvedValue({
        user: { name: 'admin', role: 'admin' },
      });
    });

    it('should handle CSV parsing service errors', async () => {
      const csvContent = 'test content';
      mockParseLloydsBankCsv.mockRejectedValue(new Error('Service error'));

      const formData = new FormData();
      const mockFile = createMockFile('test.csv', csvContent);
      formData.append('file', mockFile);
      formData.append('type', 'lloyds');
      
      const request = createMockRequest(formData);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.message).toBe('Failed to process CSV file');
      expect(data.errors).toEqual(['Service error']);
    });

    it('should handle unexpected errors', async () => {
      mockGetServerSession.mockRejectedValue(new Error('Session error'));
      
      const formData = new FormData();
      const request = createMockRequest(formData);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.message).toBe('Internal server error');
    });
  });
});