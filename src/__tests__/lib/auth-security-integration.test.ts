/**
 * Integration tests for security event logging in the authentication flow
 */

import { authOptions } from '@/lib/auth';
import { SecurityNotificationService } from '@/lib/SecurityNotificationService';
import { AuthService } from '@/lib/AuthService';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

// Mock dependencies
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    securityEvent: {
      create: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('@/lib/SecurityNotificationService');
jest.mock('@/lib/AuthService');
jest.mock('bcryptjs');

// Mock console methods
const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

describe('Authentication Security Integration', () => {
  const mockPrismaUser = prisma.user as jest.Mocked<typeof prisma.user>;
  const mockSecurityService = SecurityNotificationService as jest.Mocked<typeof SecurityNotificationService>;
  const mockAuthService = AuthService as jest.Mocked<typeof AuthService>;
  const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

  const mockRequest = {
    headers: {
      'x-forwarded-for': '192.168.1.100',
      'user-agent': 'Mozilla/5.0 (Test Browser)'
    },
    connection: {}
  };

  const mockCredentials = {
    username: 'testuser',
    password: 'testpassword'
  };

  const mockUser = {
    id: 123,
    username: 'testuser',
    password: '$2a$10$hashedpassword',
    role: 'user'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    consoleSpy.mockClear();
  });

  afterAll(() => {
    consoleSpy.mockRestore();
  });

  describe('successful authentication flow', () => {
    beforeEach(() => {
      mockAuthService.isAccountLocked.mockResolvedValue(false);
      mockPrismaUser.findUnique.mockResolvedValue(mockUser as any);
      (mockBcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockAuthService.resetFailedAttempts.mockResolvedValue();
    });

    it('should log successful login after failures when detected', async () => {
      const credentialsProvider = authOptions.providers[0];
      if ('authorize' in credentialsProvider) {
        await credentialsProvider.authorize(mockCredentials, mockRequest as any);

        expect(mockSecurityService.detectSuccessfulLoginAfterFailures).toHaveBeenCalledWith(
          123,
          'testuser',
          '192.168.1.100',
          'Mozilla/5.0 (Test Browser)'
        );
      }
    });

    it('should log new IP login detection', async () => {
      const credentialsProvider = authOptions.providers[0];
      if ('authorize' in credentialsProvider) {
        await credentialsProvider.authorize(mockCredentials, mockRequest as any);

        expect(mockSecurityService.detectNewIpLogin).toHaveBeenCalledWith(
          123,
          'testuser',
          '192.168.1.100',
          'Mozilla/5.0 (Test Browser)'
        );
      }
    });

    it('should handle comma-separated IP addresses correctly', async () => {
      const requestWithMultipleIPs = {
        ...mockRequest,
        headers: {
          ...mockRequest.headers,
          'x-forwarded-for': '192.168.1.100, 10.0.0.1, 172.16.0.1'
        }
      };

      const credentialsProvider = authOptions.providers[0];
      if ('authorize' in credentialsProvider) {
        await credentialsProvider.authorize(mockCredentials, requestWithMultipleIPs as any);

        expect(mockSecurityService.detectNewIpLogin).toHaveBeenCalledWith(
          123,
          'testuser',
          '192.168.1.100', // Should use first IP
          'Mozilla/5.0 (Test Browser)'
        );
      }
    });

    it('should use x-real-ip header when x-forwarded-for not available', async () => {
      const requestWithRealIP = {
        ...mockRequest,
        headers: {
          'x-real-ip': '10.0.0.50',
          'user-agent': 'Mozilla/5.0 (Test Browser)'
        }
      };

      const credentialsProvider = authOptions.providers[0];
      if ('authorize' in credentialsProvider) {
        await credentialsProvider.authorize(mockCredentials, requestWithRealIP as any);

        expect(mockSecurityService.detectNewIpLogin).toHaveBeenCalledWith(
          123,
          'testuser',
          '10.0.0.50',
          'Mozilla/5.0 (Test Browser)'
        );
      }
    });
  });

  describe('failed authentication flow', () => {
    beforeEach(() => {
      mockAuthService.isAccountLocked.mockResolvedValue(false);
      mockAuthService.incrementFailedAttempts.mockResolvedValue(false);
    });

    it('should log failed login attempt when user not found', async () => {
      mockPrismaUser.findUnique.mockResolvedValue(null);

      const credentialsProvider = authOptions.providers[0];
      if ('authorize' in credentialsProvider) {
        const result = await credentialsProvider.authorize(mockCredentials, mockRequest as any);

        expect(result).toBeNull();
        expect(mockSecurityService.detectFailedLogin).toHaveBeenCalledWith(
          'testuser',
          '192.168.1.100',
          'Mozilla/5.0 (Test Browser)'
        );
      }
    });

    it('should log failed login attempt when password incorrect', async () => {
      mockPrismaUser.findUnique.mockResolvedValue(mockUser as any);
      (mockBcrypt.compare as jest.Mock).mockResolvedValue(false);

      const credentialsProvider = authOptions.providers[0];
      if ('authorize' in credentialsProvider) {
        const result = await credentialsProvider.authorize(mockCredentials, mockRequest as any);

        expect(result).toBeNull();
        expect(mockSecurityService.detectFailedLogin).toHaveBeenCalledWith(
          'testuser',
          '192.168.1.100',
          'Mozilla/5.0 (Test Browser)'
        );
      }
    });

    it('should increment failed attempts after logging security event', async () => {
      mockPrismaUser.findUnique.mockResolvedValue(mockUser as any);
      (mockBcrypt.compare as jest.Mock).mockResolvedValue(false);

      const credentialsProvider = authOptions.providers[0];
      if ('authorize' in credentialsProvider) {
        await credentialsProvider.authorize(mockCredentials, mockRequest as any);

        expect(mockSecurityService.detectFailedLogin).toHaveBeenCalled();
        expect(mockAuthService.incrementFailedAttempts).toHaveBeenCalledWith('testuser');
      }
    });
  });

  describe('account lockout scenarios', () => {
    beforeEach(() => {
      mockAuthService.isAccountLocked.mockResolvedValue(true);
      mockAuthService.getLockoutEndTime.mockResolvedValue(new Date(Date.now() + 15 * 60 * 1000)); // 15 minutes from now
    });

    it('should log high-severity security event for locked account access attempt', async () => {
      const credentialsProvider = authOptions.providers[0];
      
      if ('authorize' in credentialsProvider) {
        try {
          await credentialsProvider.authorize(mockCredentials, mockRequest as any);
        } catch (error) {
          // Expected to throw
        }

        expect(mockSecurityService.logSecurityEvent).toHaveBeenCalledWith({
          eventType: 'failed_login',
          username: 'testuser',
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0 (Test Browser)',
          severity: 'high',
          context: {
            reason: 'account_locked',
            lockoutEnd: expect.any(String),
            minutesRemaining: expect.any(Number)
          }
        });
      }
    });

    it('should throw error with correct lockout message', async () => {
      const credentialsProvider = authOptions.providers[0];
      
      if ('authorize' in credentialsProvider) {
        await expect(credentialsProvider.authorize(mockCredentials, mockRequest as any))
          .rejects
          .toThrow(/Account temporarily locked/);
      }
    });
  });

  describe('IP address extraction edge cases', () => {
    it('should handle missing headers gracefully', async () => {
      const requestWithoutHeaders = {
        headers: {},
        connection: { remoteAddress: '127.0.0.1' }
      };

      mockAuthService.isAccountLocked.mockResolvedValue(false);
      mockPrismaUser.findUnique.mockResolvedValue(null);

      const credentialsProvider = authOptions.providers[0];
      if ('authorize' in credentialsProvider) {
        await credentialsProvider.authorize(mockCredentials, requestWithoutHeaders as any);

        expect(mockSecurityService.detectFailedLogin).toHaveBeenCalledWith(
          'testuser',
          '127.0.0.1', // Should fall back to connection.remoteAddress
          undefined
        );
      }
    });

    it('should use "unknown" when no IP address available', async () => {
      const requestWithoutIP = {
        headers: {},
        connection: {}
      };

      mockAuthService.isAccountLocked.mockResolvedValue(false);
      mockPrismaUser.findUnique.mockResolvedValue(null);

      const credentialsProvider = authOptions.providers[0];
      if ('authorize' in credentialsProvider) {
        await credentialsProvider.authorize(mockCredentials, requestWithoutIP as any);

        expect(mockSecurityService.detectFailedLogin).toHaveBeenCalledWith(
          'testuser',
          'unknown',
          undefined
        );
      }
    });

    it('should handle non-string IP addresses', async () => {
      const requestWithArrayIP = {
        headers: {
          'x-forwarded-for': ['192.168.1.100', '10.0.0.1'] as any
        },
        connection: {}
      };

      mockAuthService.isAccountLocked.mockResolvedValue(false);
      mockPrismaUser.findUnique.mockResolvedValue(null);

      const credentialsProvider = authOptions.providers[0];
      if ('authorize' in credentialsProvider) {
        await credentialsProvider.authorize(mockCredentials, requestWithArrayIP as any);

        expect(mockSecurityService.detectFailedLogin).toHaveBeenCalledWith(
          'testuser',
          'unknown', // Should fall back to unknown for non-string IPs
          undefined
        );
      }
    });
  });

  describe('security logging error handling', () => {
    it('should not break authentication flow if security logging fails', async () => {
      mockAuthService.isAccountLocked.mockResolvedValue(false);
      mockPrismaUser.findUnique.mockResolvedValue(mockUser as any);
      (mockBcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockAuthService.resetFailedAttempts.mockResolvedValue();
      
      // Mock security service to throw error
      mockSecurityService.detectSuccessfulLoginAfterFailures.mockRejectedValue(new Error('Security service error'));

      const credentialsProvider = authOptions.providers[0];
      if ('authorize' in credentialsProvider) {
        const result = await credentialsProvider.authorize(mockCredentials, mockRequest as any);

        // Authentication should still succeed despite security logging failure
        expect(result).toEqual({
          id: '123',
          name: 'testuser',
          role: 'user'
        });
      }
    });

    it('should handle security service failures during failed login attempts', async () => {
      mockAuthService.isAccountLocked.mockResolvedValue(false);
      mockPrismaUser.findUnique.mockResolvedValue(null);
      mockAuthService.incrementFailedAttempts.mockResolvedValue(false);
      
      mockSecurityService.detectFailedLogin.mockRejectedValue(new Error('Security logging failed'));

      const credentialsProvider = authOptions.providers[0];
      if ('authorize' in credentialsProvider) {
        const result = await credentialsProvider.authorize(mockCredentials, mockRequest as any);

        // Should still return null (failed auth) and increment attempts
        expect(result).toBeNull();
        expect(mockAuthService.incrementFailedAttempts).toHaveBeenCalled();
      }
    });
  });
});