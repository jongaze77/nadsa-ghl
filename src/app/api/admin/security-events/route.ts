import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { SecurityNotificationService } from '@/lib/SecurityNotificationService';
import { EmailService } from '@/lib/EmailService';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.role || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const userId = searchParams.get('userId') ? parseInt(searchParams.get('userId')!) : undefined;
    const eventType = searchParams.get('eventType') || undefined;
    const severity = searchParams.get('severity') || undefined;
    const startDate = searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : undefined;
    const endDate = searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : undefined;

    const events = await SecurityNotificationService.getSecurityEvents({
      limit,
      offset,
      userId,
      eventType,
      severity,
      startDate,
      endDate
    });

    return NextResponse.json({ events });
  } catch (error) {
    console.error('Error fetching security events:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}