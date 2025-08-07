import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { EmailService } from '@/lib/EmailService';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.role || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const emailConfig = EmailService.getConfiguration();
    
    return NextResponse.json({ 
      email: emailConfig,
      securityNotifications: {
        enabled: process.env.SECURITY_NOTIFICATIONS_ENABLED !== 'false',
        throttleMinutes: parseInt(process.env.SECURITY_NOTIFICATION_THROTTLE_MINUTES || '60'),
        severityThreshold: process.env.SECURITY_NOTIFICATION_SEVERITY_THRESHOLD || 'medium'
      }
    });
  } catch (error) {
    console.error('Error fetching security config:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.role || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { action } = await request.json();
    
    if (action === 'test-email') {
      const result = await EmailService.testEmailConfiguration();
      return NextResponse.json(result);
    }
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error in security config action:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}