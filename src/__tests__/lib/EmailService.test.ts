import { EmailService, EmailNotificationData } from '@/lib/EmailService';
import nodemailer from 'nodemailer';

// Mock nodemailer
jest.mock('nodemailer');

// Mock console methods
const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

// Mock environment variables
const originalEnv = process.env;

describe('EmailService', () => {
  const mockTransporter = {
    sendMail: jest.fn(),
    verify: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    consoleSpy.mockClear();
    consoleLogSpy.mockClear();
    consoleWarnSpy.mockClear();
    
    (nodemailer.createTransport as jest.Mock).mockReturnValue(mockTransporter);
    
    // Set up test environment variables
    process.env = {
      ...originalEnv,
      EMAIL_NOTIFICATIONS_ENABLED: 'true',
      SMTP_HOST: 'test.smtp.com',
      SMTP_PORT: '587',
      SMTP_SECURE: 'false',
      SMTP_USERNAME: 'testuser',
      SMTP_PASSWORD: 'testpass',
      EMAIL_FROM_ADDRESS: 'test@example.com',
      EMAIL_FROM_NAME: 'Test System',
      ADMIN_EMAIL_ADDRESSES: 'admin1@example.com,admin2@example.com',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  afterAll(() => {
    consoleSpy.mockRestore();
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe('sendSecurityNotification', () => {
    const mockNotificationData: EmailNotificationData = {
      to: ['admin@example.com'],
      subject: 'Test Security Alert',
      eventType: 'failed_login',
      username: 'testuser',
      ipAddress: '192.168.1.1',
      timestamp: '2024-01-01T10:00:00Z',
      severity: 'high',
      context: { test: 'data' }
    };

    it('should send email notification successfully', async () => {
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-message-id' });

      const result = await EmailService.sendSecurityNotification(mockNotificationData);

      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: '"Test System" <test@example.com>',
        to: 'admin@example.com',
        subject: 'Test Security Alert',
        text: expect.stringContaining('SECURITY ALERT'),
        html: expect.stringContaining('Security Alert')
      });
      expect(consoleLogSpy).toHaveBeenCalledWith('Security notification sent successfully:', 'test-message-id');
    });

    it('should use admin emails when no recipients specified', async () => {
      const dataWithNoTo = { ...mockNotificationData, to: [] };
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-message-id' });

      await EmailService.sendSecurityNotification(dataWithNoTo);

      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: '"Test System" <test@example.com>',
        to: 'admin1@example.com, admin2@example.com',
        subject: 'Test Security Alert',
        text: expect.any(String),
        html: expect.any(String)
      });
    });

    it('should handle email sending failure', async () => {
      mockTransporter.sendMail.mockRejectedValue(new Error('SMTP Error'));

      const result = await EmailService.sendSecurityNotification(mockNotificationData);

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('Failed to send security notification:', expect.any(Error));
    });

    it('should return false when email is disabled', async () => {
      process.env.EMAIL_NOTIFICATIONS_ENABLED = 'false';

      const result = await EmailService.sendSecurityNotification(mockNotificationData);

      expect(result).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith('Email notifications disabled or no admin emails configured');
      expect(mockTransporter.sendMail).not.toHaveBeenCalled();
    });

    it('should return false when no admin emails configured', async () => {
      process.env.ADMIN_EMAIL_ADDRESSES = '';
      const dataWithNoTo = { ...mockNotificationData, to: [] };

      const result = await EmailService.sendSecurityNotification(dataWithNoTo);

      expect(result).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith('Email notifications disabled or no admin emails configured');
    });

    it('should generate correct HTML content with severity colors', async () => {
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'test' });

      const testData: EmailNotificationData = {
        to: ['admin@example.com'],
        subject: 'Test Security Alert',
        eventType: 'failed_login',
        username: 'testuser',
        ipAddress: '192.168.1.1',
        timestamp: '2024-01-01T10:00:00Z',
        severity: 'critical',
        context: { test: 'data' }
      };
      await EmailService.sendSecurityNotification(testData);

      const mailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(mailCall.html).toContain('#dc3545'); // Critical severity color
      expect(mailCall.html).toContain('Failed Login Attempt'); // Formatted event type
    });

    it('should generate correct text content', async () => {
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'test' });

      await EmailService.sendSecurityNotification(mockNotificationData);

      const mailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(mailCall.text).toContain('SECURITY ALERT');
      expect(mailCall.text).toContain('Event Type: Failed Login Attempt');
      expect(mailCall.text).toContain('Severity: HIGH');
      expect(mailCall.text).toContain('Username: testuser');
      expect(mailCall.text).toContain('IP Address: 192.168.1.1');
    });

    it('should include context in email when provided', async () => {
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'test' });

      const testData: EmailNotificationData = {
        to: ['admin@example.com'],
        subject: 'Test Security Alert',
        eventType: 'failed_login',
        username: 'testuser',
        ipAddress: '192.168.1.1',
        timestamp: '2024-01-01T10:00:00Z',
        severity: 'high',
        context: { failureCount: 5, lockoutTime: 900 }
      };
      await EmailService.sendSecurityNotification(testData);

      const mailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(mailCall.html).toContain('failureCount');
      expect(mailCall.html).toContain('lockoutTime');
      expect(mailCall.text).toContain('failureCount');
      expect(mailCall.text).toContain('lockoutTime');
    });
  });

  describe('testEmailConfiguration', () => {
    it('should verify email configuration successfully', async () => {
      mockTransporter.verify.mockResolvedValue(true);

      const result = await EmailService.testEmailConfiguration();

      expect(result).toEqual({ success: true });
      expect(mockTransporter.verify).toHaveBeenCalled();
    });

    it('should handle verification failure', async () => {
      mockTransporter.verify.mockRejectedValue(new Error('SMTP connection failed'));

      const result = await EmailService.testEmailConfiguration();

      expect(result).toEqual({
        success: false,
        error: 'SMTP connection failed'
      });
    });

    it('should return error when email service not configured', async () => {
      process.env.EMAIL_NOTIFICATIONS_ENABLED = 'false';

      const result = await EmailService.testEmailConfiguration();

      expect(result).toEqual({
        success: false,
        error: 'Email service not configured'
      });
    });

    it('should handle unknown error types', async () => {
      mockTransporter.verify.mockRejectedValue('String error');

      const result = await EmailService.testEmailConfiguration();

      expect(result).toEqual({
        success: false,
        error: 'Unknown error'
      });
    });
  });

  describe('getConfiguration', () => {
    it('should return partial configuration without sensitive data', () => {
      const config = EmailService.getConfiguration();

      expect(config).toEqual({
        enabled: true,
        host: 'test.smtp.com',
        port: 587,
        secure: false,
        fromAddress: 'test@example.com',
        fromName: 'Test System',
        adminEmails: ['admin1@example.com', 'admin2@example.com']
      });

      // Should not expose sensitive credentials
      expect(config).not.toHaveProperty('username');
      expect(config).not.toHaveProperty('password');
    });

    it('should handle missing admin emails', () => {
      process.env.ADMIN_EMAIL_ADDRESSES = '';

      const config = EmailService.getConfiguration();

      expect(config.adminEmails).toEqual([]);
    });

    it('should filter out empty email addresses', () => {
      process.env.ADMIN_EMAIL_ADDRESSES = 'admin1@example.com, , admin2@example.com,';

      const config = EmailService.getConfiguration();

      expect(config.adminEmails).toEqual(['admin1@example.com', 'admin2@example.com']);
    });
  });

  describe('email formatting helpers', () => {
    it('should format different event types correctly', async () => {
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'test' });

      const eventTypes = [
        { type: 'failed_login', expected: 'Failed Login Attempt' },
        { type: 'successful_login_after_failures', expected: 'Successful Login After Previous Failures' },
        { type: 'new_ip_login', expected: 'Login from New IP Address' },
        { type: 'suspicious_pattern', expected: 'Suspicious Activity Pattern' },
        { type: 'unknown_event', expected: 'unknown_event' }
      ];

      for (const { type, expected } of eventTypes) {
        mockTransporter.sendMail.mockClear();
        
        const baseData: EmailNotificationData = {
          to: ['admin@example.com'],
          subject: 'Test Security Alert',
          eventType: 'failed_login',
          username: 'testuser',
          ipAddress: '192.168.1.1',
          timestamp: '2024-01-01T10:00:00Z',
          severity: 'high',
          context: { test: 'data' }
        };
        const testData: EmailNotificationData = {
          ...baseData,
          eventType: type
        };
        await EmailService.sendSecurityNotification(testData);

        const mailCall = mockTransporter.sendMail.mock.calls[0][0];
        expect(mailCall.html).toContain(expected);
        expect(mailCall.text).toContain(expected);
      }
    });

    it('should use correct colors for different severity levels', async () => {
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'test' });

      const severities = [
        { level: 'low', color: '#28a745' },
        { level: 'medium', color: '#ffc107' },
        { level: 'high', color: '#fd7e14' },
        { level: 'critical', color: '#dc3545' }
      ];

      for (const { level, color } of severities) {
        mockTransporter.sendMail.mockClear();
        
        const baseData: EmailNotificationData = {
          to: ['admin@example.com'],
          subject: 'Test Security Alert',
          eventType: 'failed_login',
          username: 'testuser',
          ipAddress: '192.168.1.1',
          timestamp: '2024-01-01T10:00:00Z',
          severity: 'high',
          context: { test: 'data' }
        };
        const testData: EmailNotificationData = {
          ...baseData,
          severity: level as any
        };
        await EmailService.sendSecurityNotification(testData);

        const mailCall = mockTransporter.sendMail.mock.calls[0][0];
        expect(mailCall.html).toContain(color);
      }
    });
  });

  describe('transporter configuration', () => {
    it('should create transporter with correct configuration', async () => {
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'test' });

      const testData: EmailNotificationData = {
        to: ['admin@example.com'],
        subject: 'Test Security Alert',
        eventType: 'failed_login',
        username: 'testuser',
        ipAddress: '192.168.1.1',
        timestamp: '2024-01-01T10:00:00Z',
        severity: 'high'
      };
      await EmailService.sendSecurityNotification(testData);

      expect(nodemailer.createTransport).toHaveBeenCalledWith({
        host: 'test.smtp.com',
        port: 587,
        secure: false,
        auth: {
          user: 'testuser',
          pass: 'testpass'
        }
      });
    });

    it('should create transporter without auth when no credentials provided', async () => {
      process.env.SMTP_USERNAME = '';
      process.env.SMTP_PASSWORD = '';
      
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'test' });

      const testData: EmailNotificationData = {
        to: ['admin@example.com'],
        subject: 'Test Security Alert',
        eventType: 'failed_login',
        username: 'testuser',
        ipAddress: '192.168.1.1',
        timestamp: '2024-01-01T10:00:00Z',
        severity: 'high'
      };
      await EmailService.sendSecurityNotification(testData);

      expect(nodemailer.createTransport).toHaveBeenCalledWith({
        host: 'test.smtp.com',
        port: 587,
        secure: false,
        auth: undefined
      });
    });
  });
});