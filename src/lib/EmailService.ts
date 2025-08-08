import nodemailer from 'nodemailer';

export interface EmailNotificationData {
  to: string[];
  subject: string;
  eventType: string;
  username: string;
  ipAddress: string;
  timestamp: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  context?: Record<string, any>;
}

export interface EmailConfig {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  fromAddress: string;
  fromName: string;
  adminEmails: string[];
}

export class EmailService {
  private static config: EmailConfig = EmailService.loadConfig();
  private static transporter: nodemailer.Transporter | null = null;

  private static loadConfig(): EmailConfig {
    return {
      enabled: process.env.EMAIL_NOTIFICATIONS_ENABLED === 'true',
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      username: process.env.SMTP_USERNAME || '',
      password: process.env.SMTP_PASSWORD || '',
      fromAddress: process.env.EMAIL_FROM_ADDRESS || 'noreply@localhost',
      fromName: process.env.EMAIL_FROM_NAME || 'Security System',
      adminEmails: (process.env.ADMIN_EMAIL_ADDRESSES || '').split(',').map(email => email.trim()).filter(email => email)
    };
  }

  // For testing purposes only - allows configuration reload
  // This method enables test suites to override environment variables
  // and refresh the static configuration during test execution
  // Production code should never call this method
  static _refreshConfigForTesting(): void {
    this.config = this.loadConfig();
    this.transporter = null; // Reset transporter to use new config
  }

  private static getTransporter(): nodemailer.Transporter | null {
    if (!this.config.enabled || !this.config.host) {
      return null;
    }

    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: this.config.host,
        port: this.config.port,
        secure: this.config.secure,
        auth: this.config.username ? {
          user: this.config.username,
          pass: this.config.password
        } : undefined
      });
    }

    return this.transporter;
  }

  static async sendSecurityNotification(data: EmailNotificationData): Promise<boolean> {
    try {
      const transporter = this.getTransporter();
      if (!transporter || this.config.adminEmails.length === 0) {
        console.warn('Email notifications disabled or no admin emails configured');
        return false;
      }

      const recipients = data.to.length > 0 ? data.to : this.config.adminEmails;
      const htmlContent = this.generateSecurityEmailHtml(data);
      const textContent = this.generateSecurityEmailText(data);

      const mailOptions = {
        from: `"${this.config.fromName}" <${this.config.fromAddress}>`,
        to: recipients.join(', '),
        subject: data.subject,
        text: textContent,
        html: htmlContent
      };

      const result = await transporter.sendMail(mailOptions);
      console.log('Security notification sent successfully:', result.messageId);
      return true;
    } catch (error) {
      console.error('Failed to send security notification:', error);
      return false;
    }
  }

  private static generateSecurityEmailHtml(data: EmailNotificationData): string {
    const severityColor = this.getSeverityColor(data.severity);
    const eventTypeDisplay = this.formatEventType(data.eventType);
    
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Security Alert</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: ${severityColor}; color: white; padding: 15px; text-align: center; }
        .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
        .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
        .detail-row { margin: 10px 0; }
        .label { font-weight: bold; display: inline-block; width: 120px; }
        .severity-${data.severity} { color: ${severityColor}; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>🚨 Security Alert</h2>
            <p>A security event has been detected</p>
        </div>
        
        <div class="content">
            <div class="detail-row">
                <span class="label">Event Type:</span>
                <span>${eventTypeDisplay}</span>
            </div>
            <div class="detail-row">
                <span class="label">Severity:</span>
                <span class="severity-${data.severity}">${data.severity.toUpperCase()}</span>
            </div>
            <div class="detail-row">
                <span class="label">Username:</span>
                <span>${data.username}</span>
            </div>
            <div class="detail-row">
                <span class="label">IP Address:</span>
                <span>${data.ipAddress}</span>
            </div>
            <div class="detail-row">
                <span class="label">Timestamp:</span>
                <span>${new Date(data.timestamp).toLocaleString()}</span>
            </div>
            ${data.context ? `
            <div class="detail-row">
                <span class="label">Additional Info:</span>
                <div style="margin-left: 120px; font-size: 11px; color: #666;">
                    ${Object.entries(data.context).map(([key, value]) => 
                        `<div>${key}: ${JSON.stringify(value)}</div>`
                    ).join('')}
                </div>
            </div>
            ` : ''}
        </div>
        
        <div class="footer">
            <p>This is an automated security notification from your application.</p>
            <p>Please review your security dashboard for more details.</p>
        </div>
    </div>
</body>
</html>`;
  }

  private static generateSecurityEmailText(data: EmailNotificationData): string {
    const eventTypeDisplay = this.formatEventType(data.eventType);
    
    let text = `SECURITY ALERT

A security event has been detected:

Event Type: ${eventTypeDisplay}
Severity: ${data.severity.toUpperCase()}
Username: ${data.username}
IP Address: ${data.ipAddress}
Timestamp: ${new Date(data.timestamp).toLocaleString()}
`;

    if (data.context) {
      text += '\nAdditional Information:\n';
      Object.entries(data.context).forEach(([key, value]) => {
        text += `  ${key}: ${JSON.stringify(value)}\n`;
      });
    }

    text += '\n---\nThis is an automated security notification from your application.\nPlease review your security dashboard for more details.';
    
    return text;
  }

  private static formatEventType(eventType: string): string {
    const eventTypeMap: Record<string, string> = {
      'failed_login': 'Failed Login Attempt',
      'successful_login_after_failures': 'Successful Login After Previous Failures',
      'new_ip_login': 'Login from New IP Address',
      'suspicious_pattern': 'Suspicious Activity Pattern'
    };
    
    return eventTypeMap[eventType] || eventType;
  }

  private static getSeverityColor(severity: string): string {
    const colorMap: Record<string, string> = {
      'low': '#28a745',
      'medium': '#ffc107', 
      'high': '#fd7e14',
      'critical': '#dc3545'
    };
    
    return colorMap[severity] || '#6c757d';
  }

  static async testEmailConfiguration(): Promise<{ success: boolean; error?: string }> {
    try {
      const transporter = this.getTransporter();
      if (!transporter) {
        return { success: false, error: 'Email service not configured' };
      }

      await transporter.verify();
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  static getConfiguration(): Partial<EmailConfig> {
    return {
      enabled: this.config.enabled,
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      fromAddress: this.config.fromAddress,
      fromName: this.config.fromName,
      adminEmails: this.config.adminEmails
    };
  }
}