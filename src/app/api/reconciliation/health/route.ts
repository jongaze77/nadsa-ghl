import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { ReconciliationService } from '@/lib/ReconciliationService';

export const dynamic = 'force-dynamic';
export const runtime = "nodejs";

interface HealthResponse {
  success: boolean;
  services: {
    database: boolean;
    ghl: boolean;
    wordpress: boolean;
  };
  timestamp: string;
  errors?: string[];
}

export async function GET(req: NextRequest): Promise<NextResponse<HealthResponse>> {
  try {
    // Verify authentication
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json(
        { 
          success: false, 
          services: { database: false, ghl: false, wordpress: false },
          timestamp: new Date().toISOString(),
          errors: ['Unauthorized']
        },
        { status: 401 }
      );
    }

    // Check if user has admin role
    if (session.user.role !== 'admin') {
      return NextResponse.json(
        { 
          success: false, 
          services: { database: false, ghl: false, wordpress: false },
          timestamp: new Date().toISOString(),
          errors: ['Forbidden: Admin access required']
        },
        { status: 403 }
      );
    }

    console.log('[Health API] Running health check for reconciliation services');

    // Create reconciliation service instance
    const reconciliationService = new ReconciliationService();

    // Run health checks
    const healthStatus = await reconciliationService.healthCheck();

    const allHealthy = healthStatus.database && healthStatus.ghl && healthStatus.wordpress;
    const errors: string[] = [];

    if (!healthStatus.database) {
      errors.push('Database connection failed');
    }
    if (!healthStatus.ghl) {
      errors.push('GHL API connection failed or not configured');
    }
    if (!healthStatus.wordpress) {
      errors.push('WordPress API connection failed or not configured');
    }

    console.log('[Health API] Health check completed:', {
      database: healthStatus.database,
      ghl: healthStatus.ghl,
      wordpress: healthStatus.wordpress,
      allHealthy,
    });

    return NextResponse.json({
      success: allHealthy,
      services: healthStatus,
      timestamp: new Date().toISOString(),
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (error) {
    console.error('[Health API] Health check error:', error);
    return NextResponse.json(
      { 
        success: false,
        services: { database: false, ghl: false, wordpress: false },
        timestamp: new Date().toISOString(),
        errors: ['Health check service error']
      },
      { status: 500 }
    );
  }
}