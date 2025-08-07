import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { SecurityNotificationService } from '@/lib/SecurityNotificationService';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.role || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const timeframe = (searchParams.get('timeframe') as 'day' | 'week' | 'month') || 'day';

    const stats = await SecurityNotificationService.getSecurityEventStats(timeframe);

    return NextResponse.json({ stats, timeframe });
  } catch (error) {
    console.error('Error fetching security stats:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}