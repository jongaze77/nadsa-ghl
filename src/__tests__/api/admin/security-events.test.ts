/**
 * API endpoint tests for security events
 */

import { GET as securityEventsGET } from '@/app/api/admin/security-events/route';
import { GET as statsGET } from '@/app/api/admin/security-events/stats/route';
import { GET as configGET, POST as configPOST } from '@/app/api/admin/security-events/config/route';
import { getServerSession } from 'next-auth';
import { SecurityNotificationService } from '@/lib/SecurityNotificationService';
import { EmailService } from '@/lib/EmailService';

// Mock dependencies
jest.mock('next-auth');
jest.mock('@/lib/SecurityNotificationService');
jest.mock('@/lib/EmailService');

// Mock NextRequest
class MockNextRequest {
  url: string;
  
  constructor(url: string) {
    this.url = url;
  }
  
  async json() {
    return {};
  }
}

describe('Security Events API Endpoints', () => {
  const mockGetServerSession = getServerSession as jest.Mock;
  const mockSecurityService = SecurityNotificationService as jest.Mocked<typeof SecurityNotificationService>;
  const mockEmailService = EmailService as jest.Mocked<typeof EmailService>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('/api/admin/security-events', () => {
    describe('GET', () => {
      it('should return security events for admin user', async () => {
        mockGetServerSession.mockResolvedValue({
          user: { role: 'admin' }
        });

        const mockEvents = [
          { id: '1', eventType: 'failed_login', username: 'test' },
          { id: '2', eventType: 'new_ip_login', username: 'test2' }
        ];
        mockSecurityService.getSecurityEvents.mockResolvedValue(mockEvents);

        const request = new MockNextRequest('http://localhost/api/admin/security-events?limit=50&offset=0');
        const response = await securityEventsGET(request as any);
        
        const responseData = await response.json();
        
        expect(response.status).toBe(200);
        expect(responseData.events).toEqual(mockEvents);
        expect(mockSecurityService.getSecurityEvents).toHaveBeenCalledWith({
          limit: 50,
          offset: 0,
          userId: undefined,
          eventType: undefined,
          severity: undefined,
          startDate: undefined,
          endDate: undefined
        });
      });

      it('should apply query parameters correctly', async () => {
        mockGetServerSession.mockResolvedValue({
          user: { role: 'admin' }
        });

        mockSecurityService.getSecurityEvents.mockResolvedValue([]);

        const queryParams = [
          'limit=25',
          'offset=50',
          'userId=123',
          'eventType=failed_login',
          'severity=high',
          'startDate=2024-01-01T00:00:00Z',
          'endDate=2024-01-31T23:59:59Z'
        ].join('&');

        const request = new MockNextRequest(`http://localhost/api/admin/security-events?${queryParams}`);
        await securityEventsGET(request as any);

        expect(mockSecurityService.getSecurityEvents).toHaveBeenCalledWith({
          limit: 25,
          offset: 50,
          userId: 123,
          eventType: 'failed_login',
          severity: 'high',
          startDate: new Date('2024-01-01T00:00:00Z'),
          endDate: new Date('2024-01-31T23:59:59Z')
        });
      });

      it('should return 403 for non-admin users', async () => {
        mockGetServerSession.mockResolvedValue({
          user: { role: 'user' }
        });

        const request = new MockNextRequest('http://localhost/api/admin/security-events');
        const response = await securityEventsGET(request as any);
        
        expect(response.status).toBe(403);
        const responseData = await response.json();
        expect(responseData.error).toBe('Unauthorized');
        expect(mockSecurityService.getSecurityEvents).not.toHaveBeenCalled();
      });

      it('should return 403 for unauthenticated users', async () => {
        mockGetServerSession.mockResolvedValue(null);

        const request = new MockNextRequest('http://localhost/api/admin/security-events');
        const response = await securityEventsGET(request as any);
        
        expect(response.status).toBe(403);
      });

      it('should handle service errors gracefully', async () => {
        mockGetServerSession.mockResolvedValue({
          user: { role: 'admin' }
        });

        mockSecurityService.getSecurityEvents.mockRejectedValue(new Error('Database error'));

        const request = new MockNextRequest('http://localhost/api/admin/security-events');
        const response = await securityEventsGET(request as any);
        
        expect(response.status).toBe(500);
        const responseData = await response.json();
        expect(responseData.error).toBe('Internal server error');
      });
    });
  });

  describe('/api/admin/security-events/stats', () => {
    describe('GET', () => {
      it('should return security stats for admin user', async () => {
        mockGetServerSession.mockResolvedValue({
          user: { role: 'admin' }
        });

        const mockStats = {
          'failed_login': 10,
          'new_ip_login': 3
        };
        mockSecurityService.getSecurityEventStats.mockResolvedValue(mockStats);

        const request = new MockNextRequest('http://localhost/api/admin/security-events/stats?timeframe=week');
        const response = await statsGET(request as any);
        
        const responseData = await response.json();
        
        expect(response.status).toBe(200);
        expect(responseData.stats).toEqual(mockStats);
        expect(responseData.timeframe).toBe('week');
        expect(mockSecurityService.getSecurityEventStats).toHaveBeenCalledWith('week');
      });

      it('should use default timeframe when not specified', async () => {
        mockGetServerSession.mockResolvedValue({
          user: { role: 'admin' }
        });

        mockSecurityService.getSecurityEventStats.mockResolvedValue({});

        const request = new MockNextRequest('http://localhost/api/admin/security-events/stats');
        await statsGET(request as any);

        expect(mockSecurityService.getSecurityEventStats).toHaveBeenCalledWith('day');
      });

      it('should return 403 for non-admin users', async () => {
        mockGetServerSession.mockResolvedValue({
          user: { role: 'user' }
        });

        const request = new MockNextRequest('http://localhost/api/admin/security-events/stats');
        const response = await statsGET(request as any);
        
        expect(response.status).toBe(403);
      });
    });
  });

  describe('/api/admin/security-events/config', () => {
    describe('GET', () => {
      it('should return security configuration for admin user', async () => {
        mockGetServerSession.mockResolvedValue({
          user: { role: 'admin' }
        });

        const mockEmailConfig = {
          enabled: true,
          host: 'smtp.test.com',
          port: 587,
          adminEmails: ['admin@test.com']
        };
        mockEmailService.getConfiguration.mockReturnValue(mockEmailConfig);

        // Mock environment variables
        const originalEnv = process.env;
        process.env = {
          ...originalEnv,
          SECURITY_NOTIFICATIONS_ENABLED: 'true',
          SECURITY_NOTIFICATION_THROTTLE_MINUTES: '30',
          SECURITY_NOTIFICATION_SEVERITY_THRESHOLD: 'high'
        };

        const request = new MockNextRequest('http://localhost/api/admin/security-events/config');
        const response = await configGET(request as any);
        
        const responseData = await response.json();
        
        expect(response.status).toBe(200);
        expect(responseData.email).toEqual(mockEmailConfig);
        expect(responseData.securityNotifications).toEqual({
          enabled: true,
          throttleMinutes: 30,
          severityThreshold: 'high'
        });

        process.env = originalEnv;
      });

      it('should handle missing environment variables', async () => {
        mockGetServerSession.mockResolvedValue({
          user: { role: 'admin' }
        });

        mockEmailService.getConfiguration.mockReturnValue({});

        const request = new MockNextRequest('http://localhost/api/admin/security-events/config');
        const response = await configGET(request as any);
        
        const responseData = await response.json();
        
        expect(response.status).toBe(200);
        expect(responseData.securityNotifications.enabled).toBe(true); // Default value
        expect(responseData.securityNotifications.throttleMinutes).toBe(60); // Default value
        expect(responseData.securityNotifications.severityThreshold).toBe('medium'); // Default value
      });
    });

    describe('POST', () => {
      it('should test email configuration when requested', async () => {
        mockGetServerSession.mockResolvedValue({
          user: { role: 'admin' }
        });

        const mockTestResult = { success: true };
        mockEmailService.testEmailConfiguration.mockResolvedValue(mockTestResult);

        const request = new MockNextRequest('http://localhost/api/admin/security-events/config');
        request.json = jest.fn().mockResolvedValue({ action: 'test-email' });

        const response = await configPOST(request as any);
        
        const responseData = await response.json();
        
        expect(response.status).toBe(200);
        expect(responseData).toEqual(mockTestResult);
        expect(mockEmailService.testEmailConfiguration).toHaveBeenCalled();
      });

      it('should return 400 for invalid actions', async () => {
        mockGetServerSession.mockResolvedValue({
          user: { role: 'admin' }
        });

        const request = new MockNextRequest('http://localhost/api/admin/security-events/config');
        request.json = jest.fn().mockResolvedValue({ action: 'invalid-action' });

        const response = await configPOST(request as any);
        
        expect(response.status).toBe(400);
        const responseData = await response.json();
        expect(responseData.error).toBe('Invalid action');
      });

      it('should return 403 for non-admin users', async () => {
        mockGetServerSession.mockResolvedValue({
          user: { role: 'user' }
        });

        const request = new MockNextRequest('http://localhost/api/admin/security-events/config');
        const response = await configPOST(request as any);
        
        expect(response.status).toBe(403);
      });

      it('should handle email test failures', async () => {
        mockGetServerSession.mockResolvedValue({
          user: { role: 'admin' }
        });

        const mockTestResult = { success: false, error: 'SMTP connection failed' };
        mockEmailService.testEmailConfiguration.mockResolvedValue(mockTestResult);

        const request = new MockNextRequest('http://localhost/api/admin/security-events/config');
        request.json = jest.fn().mockResolvedValue({ action: 'test-email' });

        const response = await configPOST(request as any);
        
        const responseData = await response.json();
        
        expect(response.status).toBe(200);
        expect(responseData).toEqual(mockTestResult);
      });
    });
  });

  describe('error handling across all endpoints', () => {
    it('should handle session retrieval errors', async () => {
      mockGetServerSession.mockRejectedValue(new Error('Session error'));

      const request = new MockNextRequest('http://localhost/api/admin/security-events');
      const response = await securityEventsGET(request as any);
      
      expect(response.status).toBe(500);
    });

    it('should handle JSON parsing errors in POST requests', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { role: 'admin' }
      });

      const request = new MockNextRequest('http://localhost/api/admin/security-events/config');
      request.json = jest.fn().mockRejectedValue(new Error('Invalid JSON'));

      const response = await configPOST(request as any);
      
      expect(response.status).toBe(500);
    });
  });
});