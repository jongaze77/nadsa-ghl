// src/__tests__/api/reconciliation/health-integration.test.ts

import { GET } from '../../../app/api/reconciliation/health/route';
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { ReconciliationService } from '../../../lib/ReconciliationService';

// Mock external dependencies
jest.mock('next-auth/next');
jest.mock('../../../lib/ReconciliationService');

const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;
const MockReconciliationService = ReconciliationService as jest.MockedClass<typeof ReconciliationService>;

describe('GET /api/reconciliation/health - Integration Tests', () => {
  let mockReconciliationServiceInstance: jest.Mocked<ReconciliationService>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock instance
    mockReconciliationServiceInstance = {
      healthCheck: jest.fn(),
      confirmMatch: jest.fn(),
    } as any;

    MockReconciliationService.mockImplementation(() => mockReconciliationServiceInstance);
  });

  describe('Authentication and Authorization', () => {
    it('should require authentication', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/reconciliation/health');
      const response = await GET(request);
      const responseData = await response.json();

      expect(response.status).toBe(401);
      expect(responseData.success).toBe(false);
      expect(responseData.errors).toContain('Unauthorized');
      expect(responseData.services).toEqual({
        database: false,
        ghl: false,
        wordpress: false,
      });
    });

    it('should require admin role', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { name: 'user', role: 'user' },
      } as any);

      const request = new NextRequest('http://localhost:3000/api/reconciliation/health');
      const response = await GET(request);
      const responseData = await response.json();

      expect(response.status).toBe(403);
      expect(responseData.success).toBe(false);
      expect(responseData.errors).toContain('Forbidden: Admin access required');
    });

    it('should allow admin access', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { name: 'admin', role: 'admin' },
      } as any);

      mockReconciliationServiceInstance.healthCheck.mockResolvedValue({
        database: true,
        ghl: true,
        wordpress: true,
      });

      const request = new NextRequest('http://localhost:3000/api/reconciliation/health');
      const response = await GET(request);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
    });
  });

  describe('Health Check Scenarios', () => {
    beforeEach(() => {
      mockGetServerSession.mockResolvedValue({
        user: { name: 'admin', role: 'admin' },
      } as any);
    });

    it('should return success when all services are healthy', async () => {
      mockReconciliationServiceInstance.healthCheck.mockResolvedValue({
        database: true,
        ghl: true,
        wordpress: true,
      });

      const request = new NextRequest('http://localhost:3000/api/reconciliation/health');
      const response = await GET(request);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData).toEqual({
        success: true,
        services: {
          database: true,
          ghl: true,
          wordpress: true,
        },
        timestamp: expect.any(String),
      });

      expect(mockReconciliationServiceInstance.healthCheck).toHaveBeenCalled();
    });

    it('should return failure when database is unhealthy', async () => {
      mockReconciliationServiceInstance.healthCheck.mockResolvedValue({
        database: false,
        ghl: true,
        wordpress: true,
      });

      const request = new NextRequest('http://localhost:3000/api/reconciliation/health');
      const response = await GET(request);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(false);
      expect(responseData.services.database).toBe(false);
      expect(responseData.errors).toContain('Database connection failed');
    });

    it('should return failure when GHL is unhealthy', async () => {
      mockReconciliationServiceInstance.healthCheck.mockResolvedValue({
        database: true,
        ghl: false,
        wordpress: true,
      });

      const request = new NextRequest('http://localhost:3000/api/reconciliation/health');
      const response = await GET(request);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(false);
      expect(responseData.services.ghl).toBe(false);
      expect(responseData.errors).toContain('GHL API connection failed or not configured');
    });

    it('should return failure when WordPress is unhealthy', async () => {
      mockReconciliationServiceInstance.healthCheck.mockResolvedValue({
        database: true,
        ghl: true,
        wordpress: false,
      });

      const request = new NextRequest('http://localhost:3000/api/reconciliation/health');
      const response = await GET(request);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(false);
      expect(responseData.services.wordpress).toBe(false);
      expect(responseData.errors).toContain('WordPress API connection failed or not configured');
    });

    it('should report all unhealthy services', async () => {
      mockReconciliationServiceInstance.healthCheck.mockResolvedValue({
        database: false,
        ghl: false,
        wordpress: false,
      });

      const request = new NextRequest('http://localhost:3000/api/reconciliation/health');
      const response = await GET(request);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(false);
      expect(responseData.services).toEqual({
        database: false,
        ghl: false,
        wordpress: false,
      });
      expect(responseData.errors).toEqual([
        'Database connection failed',
        'GHL API connection failed or not configured',
        'WordPress API connection failed or not configured',
      ]);
    });

    it('should include timestamp in all responses', async () => {
      mockReconciliationServiceInstance.healthCheck.mockResolvedValue({
        database: true,
        ghl: true,
        wordpress: true,
      });

      const beforeTime = new Date();
      
      const request = new NextRequest('http://localhost:3000/api/reconciliation/health');
      const response = await GET(request);
      const responseData = await response.json();

      const afterTime = new Date();
      const responseTime = new Date(responseData.timestamp);

      expect(responseTime.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(responseTime.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });

    it('should handle health check service errors gracefully', async () => {
      mockReconciliationServiceInstance.healthCheck.mockRejectedValue(
        new Error('Health check service failed')
      );

      const request = new NextRequest('http://localhost:3000/api/reconciliation/health');
      const response = await GET(request);
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData.success).toBe(false);
      expect(responseData.services).toEqual({
        database: false,
        ghl: false,
        wordpress: false,
      });
      expect(responseData.errors).toContain('Health check service error');
    });

    it('should provide different response structure for healthy vs unhealthy', async () => {
      // Test healthy response structure
      mockReconciliationServiceInstance.healthCheck.mockResolvedValue({
        database: true,
        ghl: true,
        wordpress: true,
      });

      const healthyRequest = new NextRequest('http://localhost:3000/api/reconciliation/health');
      const healthyResponse = await GET(healthyRequest);
      const healthyData = await healthyResponse.json();

      expect(healthyData.errors).toBeUndefined();

      // Test unhealthy response structure
      mockReconciliationServiceInstance.healthCheck.mockResolvedValue({
        database: false,
        ghl: false,
        wordpress: false,
      });

      const unhealthyRequest = new NextRequest('http://localhost:3000/api/reconciliation/health');
      const unhealthyResponse = await GET(unhealthyRequest);
      const unhealthyData = await unhealthyResponse.json();

      expect(unhealthyData.errors).toBeDefined();
      expect(Array.isArray(unhealthyData.errors)).toBe(true);
      expect(unhealthyData.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Service Integration', () => {
    beforeEach(() => {
      mockGetServerSession.mockResolvedValue({
        user: { name: 'admin', role: 'admin' },
      } as any);
    });

    it('should create ReconciliationService instance', async () => {
      mockReconciliationServiceInstance.healthCheck.mockResolvedValue({
        database: true,
        ghl: true,
        wordpress: true,
      });

      const request = new NextRequest('http://localhost:3000/api/reconciliation/health');
      await GET(request);

      expect(MockReconciliationService).toHaveBeenCalledWith();
      expect(mockReconciliationServiceInstance.healthCheck).toHaveBeenCalled();
    });

    it('should handle timeout scenarios', async () => {
      // Mock a timeout scenario
      mockReconciliationServiceInstance.healthCheck.mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Timeout')), 1);
        });
      });

      const request = new NextRequest('http://localhost:3000/api/reconciliation/health');
      const response = await GET(request);
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData.success).toBe(false);
    });

    it('should be idempotent (multiple calls return consistent results)', async () => {
      const healthStatus = {
        database: true,
        ghl: false,
        wordpress: true,
      };

      mockReconciliationServiceInstance.healthCheck.mockResolvedValue(healthStatus);

      const request1 = new NextRequest('http://localhost:3000/api/reconciliation/health');
      const response1 = await GET(request1);
      const data1 = await response1.json();

      const request2 = new NextRequest('http://localhost:3000/api/reconciliation/health');
      const response2 = await GET(request2);
      const data2 = await response2.json();

      expect(data1.success).toBe(data2.success);
      expect(data1.services).toEqual(data2.services);
      expect(data1.errors).toEqual(data2.errors);
    });
  });
});