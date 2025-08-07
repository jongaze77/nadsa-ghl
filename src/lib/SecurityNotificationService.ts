import { prisma } from '@/lib/prisma';
import { EmailService } from '@/lib/EmailService';

export interface SecurityEventData {
  eventType: 'failed_login' | 'successful_login_after_failures' | 'new_ip_login' | 'suspicious_pattern';
  userId?: number;
  username: string;
  ipAddress: string;
  userAgent?: string;
  context?: Record<string, any>;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface NotificationConfig {
  enabled: boolean;
  emailNotifications: boolean;
  throttleMinutes: number;
  severityThreshold: 'low' | 'medium' | 'high' | 'critical';
}

export class SecurityNotificationService {
  private static config: NotificationConfig = {
    enabled: process.env.SECURITY_NOTIFICATIONS_ENABLED !== 'false',
    emailNotifications: process.env.SECURITY_EMAIL_NOTIFICATIONS !== 'false',
    throttleMinutes: parseInt(process.env.SECURITY_NOTIFICATION_THROTTLE_MINUTES || '60'),
    severityThreshold: (process.env.SECURITY_NOTIFICATION_SEVERITY_THRESHOLD as any) || 'medium'
  };

  private static severityLevels = {
    'low': 1,
    'medium': 2,
    'high': 3,
    'critical': 4
  };

  static async logSecurityEvent(data: SecurityEventData): Promise<string> {
    try {
      const event = await prisma.securityEvent.create({
        data: {
          eventType: data.eventType,
          userId: data.userId,
          username: data.username,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          context: data.context,
          severity: data.severity,
          notificationSent: false
        }
      });

      // Check if notification should be sent
      if (this.shouldSendNotification(data.severity)) {
        await this.processNotification(event.id, data);
      }

      return event.id;
    } catch (error) {
      console.error('Failed to log security event:', error);
      // Don't throw - security logging should not break auth flow
      return '';
    }
  }

  static async detectFailedLogin(username: string, ipAddress: string, userAgent?: string): Promise<void> {
    await this.logSecurityEvent({
      eventType: 'failed_login',
      username,
      ipAddress,
      userAgent,
      severity: 'medium',
      context: {
        timestamp: new Date().toISOString(),
        attemptType: 'credential_failure'
      }
    });
  }

  static async detectSuccessfulLoginAfterFailures(userId: number, username: string, ipAddress: string, userAgent?: string): Promise<void> {
    // Check if there were recent failed attempts
    const recentFailures = await prisma.securityEvent.count({
      where: {
        username,
        eventType: 'failed_login',
        timestamp: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      }
    });

    if (recentFailures > 0) {
      await this.logSecurityEvent({
        eventType: 'successful_login_after_failures',
        userId,
        username,
        ipAddress,
        userAgent,
        severity: recentFailures > 5 ? 'high' : 'medium',
        context: {
          recentFailures,
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  static async detectNewIpLogin(userId: number, username: string, ipAddress: string, userAgent?: string): Promise<void> {
    // Check if this IP has been used before for successful logins
    const previousLogins = await prisma.securityEvent.count({
      where: {
        userId,
        ipAddress,
        eventType: {
          in: ['successful_login_after_failures', 'new_ip_login']
        }
      }
    });

    if (previousLogins === 0) {
      await this.logSecurityEvent({
        eventType: 'new_ip_login',
        userId,
        username,
        ipAddress,
        userAgent,
        severity: 'medium',
        context: {
          timestamp: new Date().toISOString(),
          firstTimeIp: true
        }
      });
    }
  }

  private static shouldSendNotification(severity: string): boolean {
    if (!this.config.enabled) return false;
    
    const eventLevel = this.severityLevels[severity as keyof typeof this.severityLevels];
    const thresholdLevel = this.severityLevels[this.config.severityThreshold];
    
    return eventLevel >= thresholdLevel;
  }

  private static async processNotification(eventId: string, data: SecurityEventData): Promise<void> {
    try {
      // Check throttling - don't send notifications for same event type within throttle window
      const recentNotifications = await prisma.securityEvent.count({
        where: {
          eventType: data.eventType,
          username: data.username,
          notificationSent: true,
          timestamp: {
            gte: new Date(Date.now() - this.config.throttleMinutes * 60 * 1000)
          }
        }
      });

      if (recentNotifications > 0) {
        return; // Skip notification due to throttling
      }

      // Mark as notification sent
      await prisma.securityEvent.update({
        where: { id: eventId },
        data: { notificationSent: true }
      });

      // Send email notification if enabled
      if (this.config.emailNotifications) {
        const emailSent = await EmailService.sendSecurityNotification({
          to: [], // Will use default admin emails
          subject: this.generateNotificationSubject(data.eventType, data.severity),
          eventType: data.eventType,
          username: data.username,
          ipAddress: data.ipAddress,
          timestamp: new Date().toISOString(),
          severity: data.severity,
          context: data.context
        });
        
        if (!emailSent) {
          console.warn(`Failed to send email notification for event ${eventId}`);
        }
      }
      
      console.log(`Security notification processed for event ${eventId}: ${data.eventType} - ${data.severity}`);
      
    } catch (error) {
      console.error('Failed to process security notification:', error);
    }
  }

  static async getSecurityEvents(options: {
    limit?: number;
    offset?: number;
    userId?: number;
    eventType?: string;
    severity?: string;
    startDate?: Date;
    endDate?: Date;
  } = {}): Promise<any[]> {
    const {
      limit = 50,
      offset = 0,
      userId,
      eventType,
      severity,
      startDate,
      endDate
    } = options;

    const where: any = {};
    
    if (userId) where.userId = userId;
    if (eventType) where.eventType = eventType;
    if (severity) where.severity = severity;
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = startDate;
      if (endDate) where.timestamp.lte = endDate;
    }

    return await prisma.securityEvent.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: limit,
      skip: offset,
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
  }

  static async getSecurityEventStats(timeframe: 'day' | 'week' | 'month' = 'day'): Promise<Record<string, number>> {
    const timeframeDays = timeframe === 'day' ? 1 : timeframe === 'week' ? 7 : 30;
    const startDate = new Date(Date.now() - timeframeDays * 24 * 60 * 60 * 1000);

    const events = await prisma.securityEvent.groupBy({
      by: ['eventType'],
      where: {
        timestamp: { gte: startDate }
      },
      _count: true
    });

    const stats: Record<string, number> = {};
    events.forEach(event => {
      stats[event.eventType] = event._count;
    });

    return stats;
  }

  private static generateNotificationSubject(eventType: string, severity: string): string {
    const severityPrefix = severity === 'critical' ? '🚨 CRITICAL' : 
                          severity === 'high' ? '⚠️ HIGH' :
                          severity === 'medium' ? '🔔 MEDIUM' : '📝 LOW';
    
    const eventMap: Record<string, string> = {
      'failed_login': 'Failed Login Attempt',
      'successful_login_after_failures': 'Login After Failed Attempts',
      'new_ip_login': 'New IP Address Login',
      'suspicious_pattern': 'Suspicious Activity'
    };
    
    const eventName = eventMap[eventType] || 'Security Event';
    
    return `${severityPrefix} Security Alert: ${eventName}`;
  }
}