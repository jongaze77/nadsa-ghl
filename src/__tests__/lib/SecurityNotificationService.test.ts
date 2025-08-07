import { SecurityNotificationService, SecurityEventData } from '@/lib/SecurityNotificationService';
import { prisma } from '@/lib/prisma';
import { EmailService } from '@/lib/EmailService';

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    securityEvent: {
      create: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
  },
}));

// Mock EmailService
jest.mock('@/lib/EmailService');

// Mock console methods
const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

describe('SecurityNotificationService', () => {
  const mockPrismaSecurityEvent = prisma.securityEvent as jest.Mocked<typeof prisma.securityEvent>;
  const mockEmailService = EmailService as jest.Mocked<typeof EmailService>;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleSpy.mockClear();
    consoleLogSpy.mockClear();
    consoleWarnSpy.mockClear();
  });

  afterAll(() => {
    consoleSpy.mockRestore();
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe('logSecurityEvent', () => {
    const mockEventData: SecurityEventData = {
      eventType: 'failed_login',
      username: 'testuser',
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0',
      severity: 'medium',
      context: { test: 'data' }
    };

    it('should create security event successfully', async () => {
      const mockEvent = { id: 'test-event-id' };
      mockPrismaSecurityEvent.create.mockResolvedValue(mockEvent as any);
      mockPrismaSecurityEvent.count.mockResolvedValue(0);

      const result = await SecurityNotificationService.logSecurityEvent(mockEventData);

      expect(result).toBe('test-event-id');
      expect(mockPrismaSecurityEvent.create).toHaveBeenCalledWith({
        data: {
          eventType: 'failed_login',
          userId: undefined,
          username: 'testuser',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          context: { test: 'data' },
          severity: 'medium',
          notificationSent: false
        }
      });
    });

    it('should handle database errors gracefully', async () => {
      mockPrismaSecurityEvent.create.mockRejectedValue(new Error('Database error'));

      const result = await SecurityNotificationService.logSecurityEvent(mockEventData);

      expect(result).toBe('');
      expect(consoleSpy).toHaveBeenCalledWith('Failed to log security event:', expect.any(Error));
    });

    it('should trigger notification for high severity events', async () => {
      const highSeverityData = { ...mockEventData, severity: 'high' as const };
      const mockEvent = { id: 'test-event-id' };
      
      mockPrismaSecurityEvent.create.mockResolvedValue(mockEvent as any);
      mockPrismaSecurityEvent.count.mockResolvedValue(0);
      mockPrismaSecurityEvent.update.mockResolvedValue(mockEvent as any);
      mockEmailService.sendSecurityNotification.mockResolvedValue(true);

      await SecurityNotificationService.logSecurityEvent(highSeverityData);

      expect(mockPrismaSecurityEvent.update).toHaveBeenCalledWith({
        where: { id: 'test-event-id' },
        data: { notificationSent: true }
      });
    });

    it('should not trigger notification for low severity events', async () => {
      const lowSeverityData = { ...mockEventData, severity: 'low' as const };
      const mockEvent = { id: 'test-event-id' };
      
      mockPrismaSecurityEvent.create.mockResolvedValue(mockEvent as any);

      await SecurityNotificationService.logSecurityEvent(lowSeverityData);

      expect(mockPrismaSecurityEvent.update).not.toHaveBeenCalled();
      expect(mockEmailService.sendSecurityNotification).not.toHaveBeenCalled();
    });
  });

  describe('detectFailedLogin', () => {
    it('should log failed login event with correct parameters', async () => {
      const mockEvent = { id: 'test-event-id' };
      mockPrismaSecurityEvent.create.mockResolvedValue(mockEvent as any);

      await SecurityNotificationService.detectFailedLogin('testuser', '192.168.1.1', 'Mozilla/5.0');

      expect(mockPrismaSecurityEvent.create).toHaveBeenCalledWith({
        data: {
          eventType: 'failed_login',
          userId: undefined,
          username: 'testuser',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          context: {
            timestamp: expect.any(String),
            attemptType: 'credential_failure'
          },
          severity: 'medium',
          notificationSent: false
        }
      });
    });
  });

  describe('detectSuccessfulLoginAfterFailures', () => {
    it('should detect and log successful login after failures', async () => {
      mockPrismaSecurityEvent.count.mockResolvedValue(5);
      const mockEvent = { id: 'test-event-id' };
      mockPrismaSecurityEvent.create.mockResolvedValue(mockEvent as any);

      await SecurityNotificationService.detectSuccessfulLoginAfterFailures(
        123, 
        'testuser', 
        '192.168.1.1', 
        'Mozilla/5.0'
      );

      expect(mockPrismaSecurityEvent.count).toHaveBeenCalledWith({
        where: {
          username: 'testuser',
          eventType: 'failed_login',
          timestamp: {
            gte: expect.any(Date)
          }
        }
      });

      expect(mockPrismaSecurityEvent.create).toHaveBeenCalledWith({
        data: {
          eventType: 'successful_login_after_failures',
          userId: 123,
          username: 'testuser',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          context: {
            recentFailures: 5,
            timestamp: expect.any(String)
          },
          severity: 'medium',
          notificationSent: false
        }
      });
    });

    it('should use high severity for many failed attempts', async () => {
      mockPrismaSecurityEvent.count.mockResolvedValue(10);
      const mockEvent = { id: 'test-event-id' };
      mockPrismaSecurityEvent.create.mockResolvedValue(mockEvent as any);

      await SecurityNotificationService.detectSuccessfulLoginAfterFailures(
        123, 
        'testuser', 
        '192.168.1.1'
      );

      expect(mockPrismaSecurityEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          severity: 'high'
        })
      });
    });

    it('should not log if no recent failures', async () => {
      mockPrismaSecurityEvent.count.mockResolvedValue(0);

      await SecurityNotificationService.detectSuccessfulLoginAfterFailures(
        123, 
        'testuser', 
        '192.168.1.1'
      );

      expect(mockPrismaSecurityEvent.create).not.toHaveBeenCalled();
    });
  });

  describe('detectNewIpLogin', () => {
    it('should detect and log new IP login', async () => {
      mockPrismaSecurityEvent.count.mockResolvedValue(0);
      const mockEvent = { id: 'test-event-id' };
      mockPrismaSecurityEvent.create.mockResolvedValue(mockEvent as any);

      await SecurityNotificationService.detectNewIpLogin(123, 'testuser', '192.168.1.1', 'Mozilla/5.0');

      expect(mockPrismaSecurityEvent.count).toHaveBeenCalledWith({
        where: {
          userId: 123,
          ipAddress: '192.168.1.1',
          eventType: {
            in: ['successful_login_after_failures', 'new_ip_login']
          }
        }
      });

      expect(mockPrismaSecurityEvent.create).toHaveBeenCalledWith({
        data: {
          eventType: 'new_ip_login',
          userId: 123,
          username: 'testuser',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          context: {
            timestamp: expect.any(String),
            firstTimeIp: true
          },
          severity: 'medium',
          notificationSent: false
        }
      });
    });

    it('should not log if IP has been used before', async () => {
      mockPrismaSecurityEvent.count.mockResolvedValue(1);

      await SecurityNotificationService.detectNewIpLogin(123, 'testuser', '192.168.1.1');

      expect(mockPrismaSecurityEvent.create).not.toHaveBeenCalled();
    });
  });

  describe('getSecurityEvents', () => {
    it('should retrieve security events with default options', async () => {
      const mockEvents: any[] = [
        { id: 'event-1', eventType: 'failed_login' },
        { id: 'event-2', eventType: 'new_ip_login' }
      ];
      mockPrismaSecurityEvent.findMany.mockResolvedValue(mockEvents);

      const result = await SecurityNotificationService.getSecurityEvents();

      expect(mockPrismaSecurityEvent.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { timestamp: 'desc' },
        take: 50,
        skip: 0,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              role: true
            }
          }
        }
      });

      expect(result).toEqual(mockEvents);
    });

    it('should apply filters correctly', async () => {
      const mockEvents: any[] = [];
      mockPrismaSecurityEvent.findMany.mockResolvedValue(mockEvents);
      
      const options = {
        userId: 123,
        eventType: 'failed_login',
        severity: 'high',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        limit: 25,
        offset: 50
      };

      await SecurityNotificationService.getSecurityEvents(options);

      expect(mockPrismaSecurityEvent.findMany).toHaveBeenCalledWith({
        where: {
          userId: 123,
          eventType: 'failed_login',
          severity: 'high',
          timestamp: {
            gte: new Date('2024-01-01'),
            lte: new Date('2024-01-31')
          }
        },
        orderBy: { timestamp: 'desc' },
        take: 25,
        skip: 50,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              role: true
            }
          }
        }
      });
    });
  });

  describe('getSecurityEventStats', () => {
    it('should return aggregated statistics for different timeframes', async () => {
      const mockStats = [
        { eventType: 'failed_login', _count: 10 },
        { eventType: 'new_ip_login', _count: 3 }
      ];
      mockPrismaSecurityEvent.groupBy.mockResolvedValue(mockStats as any);

      const result = await SecurityNotificationService.getSecurityEventStats('week');

      expect(mockPrismaSecurityEvent.groupBy).toHaveBeenCalledWith({
        by: ['eventType'],
        where: {
          timestamp: { gte: expect.any(Date) }
        },
        _count: true
      });

      expect(result).toEqual({
        'failed_login': 10,
        'new_ip_login': 3
      });
    });

    it('should handle different timeframe calculations', async () => {
      mockPrismaSecurityEvent.groupBy.mockResolvedValue([]);

      // Test different timeframes
      await SecurityNotificationService.getSecurityEventStats('day');
      await SecurityNotificationService.getSecurityEventStats('week');
      await SecurityNotificationService.getSecurityEventStats('month');

      // Verify that different date ranges are calculated
      const calls = mockPrismaSecurityEvent.groupBy.mock.calls;
      expect(calls).toHaveLength(3);
      
      // Each call should have a different start date
      const dayTimestamp = calls[0]?.[0]?.where?.timestamp;
      const weekTimestamp = calls[1]?.[0]?.where?.timestamp;
      const monthTimestamp = calls[2]?.[0]?.where?.timestamp;
      
      // Verify timestamps exist and are Date objects
      expect(dayTimestamp).toBeDefined();
      expect(weekTimestamp).toBeDefined();
      expect(monthTimestamp).toBeDefined();
      
      if (dayTimestamp && weekTimestamp && monthTimestamp && 
          typeof dayTimestamp === 'object' && 'gte' in dayTimestamp &&
          typeof weekTimestamp === 'object' && 'gte' in weekTimestamp &&
          typeof monthTimestamp === 'object' && 'gte' in monthTimestamp) {
        const dayStart = (dayTimestamp.gte as Date).getTime();
        const weekStart = (weekTimestamp.gte as Date).getTime();
        const monthStart = (monthTimestamp.gte as Date).getTime();

        expect(dayStart).toBeGreaterThan(weekStart);
        expect(weekStart).toBeGreaterThan(monthStart);
      }
    });
  });

  describe('notification throttling', () => {
    it('should respect throttling settings and not send duplicate notifications', async () => {
      const mockEventData: SecurityEventData = {
        eventType: 'failed_login',
        username: 'testuser',
        ipAddress: '192.168.1.1',
        severity: 'high'
      };

      const mockEvent = { id: 'test-event-id' };
      mockPrismaSecurityEvent.create.mockResolvedValue(mockEvent as any);
      
      // Mock that there's a recent notification
      mockPrismaSecurityEvent.count.mockResolvedValue(1);

      await SecurityNotificationService.logSecurityEvent(mockEventData);

      // Should not update notification status or send email due to throttling
      expect(mockPrismaSecurityEvent.update).not.toHaveBeenCalled();
      expect(mockEmailService.sendSecurityNotification).not.toHaveBeenCalled();
    });

    it('should send notification when throttle window has passed', async () => {
      const mockEventData: SecurityEventData = {
        eventType: 'failed_login',
        username: 'testuser',
        ipAddress: '192.168.1.1',
        severity: 'high'
      };

      const mockEvent = { id: 'test-event-id' };
      mockPrismaSecurityEvent.create.mockResolvedValue(mockEvent as any);
      mockPrismaSecurityEvent.update.mockResolvedValue(mockEvent as any);
      
      // Mock no recent notifications
      mockPrismaSecurityEvent.count.mockResolvedValue(0);
      mockEmailService.sendSecurityNotification.mockResolvedValue(true);

      await SecurityNotificationService.logSecurityEvent(mockEventData);

      expect(mockPrismaSecurityEvent.update).toHaveBeenCalledWith({
        where: { id: 'test-event-id' },
        data: { notificationSent: true }
      });
      expect(mockEmailService.sendSecurityNotification).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle notification processing errors gracefully', async () => {
      const mockEventData: SecurityEventData = {
        eventType: 'failed_login',
        username: 'testuser',
        ipAddress: '192.168.1.1',
        severity: 'high'
      };

      const mockEvent = { id: 'test-event-id' };
      mockPrismaSecurityEvent.create.mockResolvedValue(mockEvent as any);
      mockPrismaSecurityEvent.count.mockResolvedValue(0);
      mockPrismaSecurityEvent.update.mockRejectedValue(new Error('Update failed'));

      await SecurityNotificationService.logSecurityEvent(mockEventData);

      expect(consoleSpy).toHaveBeenCalledWith('Failed to process security notification:', expect.any(Error));
    });

    it('should handle email service failures gracefully', async () => {
      const mockEventData: SecurityEventData = {
        eventType: 'failed_login',
        username: 'testuser',
        ipAddress: '192.168.1.1',
        severity: 'high'
      };

      const mockEvent = { id: 'test-event-id' };
      mockPrismaSecurityEvent.create.mockResolvedValue(mockEvent as any);
      mockPrismaSecurityEvent.count.mockResolvedValue(0);
      mockPrismaSecurityEvent.update.mockResolvedValue(mockEvent as any);
      mockEmailService.sendSecurityNotification.mockResolvedValue(false);

      await SecurityNotificationService.logSecurityEvent(mockEventData);

      expect(consoleWarnSpy).toHaveBeenCalledWith('Failed to send email notification for event test-event-id');
    });
  });
});