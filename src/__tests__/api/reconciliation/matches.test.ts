import { POST, GET } from '../../../app/api/reconciliation/matches/route';
import { getServerSession } from 'next-auth/next';
import { MatchingService } from '../../../lib/MatchingService';
import { NextRequest } from 'next/server';

// Mock dependencies
jest.mock('next-auth/next');
jest.mock('../../../lib/MatchingService');

const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;
const mockMatchingService = MatchingService as jest.MockedClass<typeof MatchingService>;

describe('/api/reconciliation/matches', () => {
  let mockFindMatches: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockFindMatches = jest.fn();
    mockMatchingService.mockImplementation(() => ({
      findMatches: mockFindMatches,
    } as any));
  });

  const mockPaymentData = {
    transactionFingerprint: 'test123',
    amount: 50.00,
    paymentDate: new Date('2024-01-01'),
    source: 'BANK_CSV' as const,
    transactionRef: 'REF123',
    description: 'MEMBERSHIP - JOHN SMITH',
  };

  const mockMatchResult = {
    suggestions: [{
      contact: {
        id: 'contact-1',
        firstName: 'John',
        lastName: 'Smith',
        email: 'john@example.com',
        membershipType: 'Full',
      },
      confidence: 0.95,
      reasoning: {
        nameMatch: { score: 0.9, extractedName: 'JOHN SMITH', matchedAgainst: 'JOHN SMITH' },
        amountMatch: { score: 1.0, expectedRange: '£60-80', actualAmount: 50 },
      },
    }],
    totalMatches: 1,
    processingTimeMs: 150,
  };

  describe('POST /api/reconciliation/matches', () => {
    describe('Authentication', () => {
      it('should return 401 when not authenticated', async () => {
        mockGetServerSession.mockResolvedValue(null);
        
        const request = new NextRequest('http://localhost:3000/api/reconciliation/matches', {
          method: 'POST',
          body: JSON.stringify({ paymentData: mockPaymentData }),
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
        
        const request = new NextRequest('http://localhost:3000/api/reconciliation/matches', {
          method: 'POST',
          body: JSON.stringify({ paymentData: mockPaymentData }),
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
        const request = new NextRequest('http://localhost:3000/api/reconciliation/matches', {
          method: 'POST',
          body: JSON.stringify({}),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.message).toBe('Payment data is required');
      });

      it('should return 400 when required fields are missing', async () => {
        const invalidPaymentData = {
          amount: 50.00,
          // Missing transactionFingerprint and paymentDate
        };

        const request = new NextRequest('http://localhost:3000/api/reconciliation/matches', {
          method: 'POST',
          body: JSON.stringify({ paymentData: invalidPaymentData }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.message).toBe('Invalid payment data. Required fields: transactionFingerprint, amount, paymentDate');
      });

      it('should return 400 when amount is not a positive number', async () => {
        const invalidPaymentData = {
          ...mockPaymentData,
          amount: -10,
        };

        const request = new NextRequest('http://localhost:3000/api/reconciliation/matches', {
          method: 'POST',
          body: JSON.stringify({ paymentData: invalidPaymentData }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.message).toBe('Amount must be a positive number');
      });

      it('should return 400 when paymentDate is invalid', async () => {
        const invalidPaymentData = {
          ...mockPaymentData,
          paymentDate: 'invalid-date',
        };

        const request = new NextRequest('http://localhost:3000/api/reconciliation/matches', {
          method: 'POST',
          body: JSON.stringify({ paymentData: invalidPaymentData }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.message).toBe('Invalid payment date format');
      });
    });

    describe('Successful Matching', () => {
      beforeEach(() => {
        mockGetServerSession.mockResolvedValue({
          user: { name: 'admin', role: 'admin' },
        });
      });

      it('should successfully find matches', async () => {
        mockFindMatches.mockResolvedValue(mockMatchResult);

        const request = new NextRequest('http://localhost:3000/api/reconciliation/matches', {
          method: 'POST',
          body: JSON.stringify({ paymentData: mockPaymentData }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.suggestions).toEqual(mockMatchResult.suggestions);
        expect(data.totalMatches).toBe(1);
        expect(data.processingTimeMs).toBe(150);
        expect(data.message).toBe('Found 1 match suggestions');

        expect(mockFindMatches).toHaveBeenCalledWith({
          ...mockPaymentData,
          paymentDate: new Date(mockPaymentData.paymentDate),
        });
      });

      it('should handle no matches found', async () => {
        const emptyResult = {
          suggestions: [],
          totalMatches: 0,
          processingTimeMs: 50,
        };
        mockFindMatches.mockResolvedValue(emptyResult);

        const request = new NextRequest('http://localhost:3000/api/reconciliation/matches', {
          method: 'POST',
          body: JSON.stringify({ paymentData: mockPaymentData }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.suggestions).toEqual([]);
        expect(data.totalMatches).toBe(0);
        expect(data.message).toBe('Found 0 match suggestions');
      });
    });
  });

  describe('GET /api/reconciliation/matches', () => {
    describe('Authentication', () => {
      it('should return 401 when not authenticated', async () => {
        mockGetServerSession.mockResolvedValue(null);
        
        const request = new NextRequest('http://localhost:3000/api/reconciliation/matches?transactionFingerprint=test&amount=50&paymentDate=2024-01-01');

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.success).toBe(false);
        expect(data.message).toBe('Unauthorized');
      });
    });

    describe('Query Parameter Validation', () => {
      beforeEach(() => {
        mockGetServerSession.mockResolvedValue({
          user: { name: 'admin', role: 'admin' },
        });
      });

      it('should return 400 when required parameters are missing', async () => {
        const request = new NextRequest('http://localhost:3000/api/reconciliation/matches?amount=50');

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.message).toBe('Missing required parameters: transactionFingerprint, amount, paymentDate');
      });

      it('should return 400 when amount is invalid', async () => {
        const request = new NextRequest('http://localhost:3000/api/reconciliation/matches?transactionFingerprint=test&amount=invalid&paymentDate=2024-01-01');

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.message).toBe('Amount must be a positive number');
      });

      it('should return 400 when paymentDate is invalid', async () => {
        const request = new NextRequest('http://localhost:3000/api/reconciliation/matches?transactionFingerprint=test&amount=50&paymentDate=invalid');

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.message).toBe('Invalid payment date format');
      });

      it('should return 400 when source is invalid', async () => {
        const request = new NextRequest('http://localhost:3000/api/reconciliation/matches?transactionFingerprint=test&amount=50&paymentDate=2024-01-01&source=INVALID');

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.message).toBe('Source must be "BANK_CSV" or "STRIPE_REPORT"');
      });
    });

    describe('Successful GET Matching', () => {
      beforeEach(() => {
        mockGetServerSession.mockResolvedValue({
          user: { name: 'admin', role: 'admin' },
        });
      });

      it('should successfully find matches with query parameters', async () => {
        mockFindMatches.mockResolvedValue(mockMatchResult);

        const request = new NextRequest('http://localhost:3000/api/reconciliation/matches?transactionFingerprint=test123&amount=50&paymentDate=2024-01-01&description=MEMBERSHIP%20JOHN&source=BANK_CSV');

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.suggestions).toEqual(mockMatchResult.suggestions);
        expect(data.totalMatches).toBe(1);

        expect(mockFindMatches).toHaveBeenCalledWith({
          transactionFingerprint: 'test123',
          amount: 50,
          paymentDate: new Date('2024-01-01'),
          source: 'BANK_CSV',
          transactionRef: 'test123',
          description: 'MEMBERSHIP JOHN',
        });
      });

      it('should use default values for optional parameters', async () => {
        mockFindMatches.mockResolvedValue(mockMatchResult);

        const request = new NextRequest('http://localhost:3000/api/reconciliation/matches?transactionFingerprint=test123&amount=50&paymentDate=2024-01-01');

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(mockFindMatches).toHaveBeenCalledWith({
          transactionFingerprint: 'test123',
          amount: 50,
          paymentDate: new Date('2024-01-01'),
          source: 'BANK_CSV', // Default value
          transactionRef: 'test123',
          description: undefined,
        });
      });
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      mockGetServerSession.mockResolvedValue({
        user: { name: 'admin', role: 'admin' },
      });
    });

    it('should handle MatchingService errors in POST', async () => {
      mockFindMatches.mockRejectedValue(new Error('Matching service error'));

      const request = new NextRequest('http://localhost:3000/api/reconciliation/matches', {
        method: 'POST',
        body: JSON.stringify({ paymentData: mockPaymentData }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.message).toBe('Internal server error');
    });

    it('should handle MatchingService errors in GET', async () => {
      mockFindMatches.mockRejectedValue(new Error('Matching service error'));

      const request = new NextRequest('http://localhost:3000/api/reconciliation/matches?transactionFingerprint=test&amount=50&paymentDate=2024-01-01');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.message).toBe('Internal server error');
    });
  });
});