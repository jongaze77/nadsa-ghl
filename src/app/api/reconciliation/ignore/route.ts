import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = "nodejs";

interface IgnoreRequest {
  transactionFingerprint: string;
  ignored: boolean; // true to ignore, false to unignore
}

interface IgnoreResponse {
  success: boolean;
  message?: string;
}

export async function POST(req: NextRequest): Promise<NextResponse<IgnoreResponse>> {
  try {
    // Verify authentication
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user has admin role
    if (session.user.role !== 'admin') {
      return NextResponse.json(
        { success: false, message: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    // Parse request body
    const body: IgnoreRequest = await req.json();
    
    if (!body.transactionFingerprint) {
      return NextResponse.json(
        { success: false, message: 'Transaction fingerprint is required' },
        { status: 400 }
      );
    }

    const { transactionFingerprint, ignored } = body;
    const newStatus = ignored ? 'ignored' : 'pending';

    // Update payment status
    const updatedPayment = await prisma.pendingPayment.update({
      where: { transactionFingerprint },
      data: { status: newStatus },
    });

    const actionText = ignored ? 'ignored' : 'unignored';
    return NextResponse.json({
      success: true,
      message: `Payment ${actionText} successfully`,
    });

  } catch (error) {
    console.error('Ignore endpoint error:', error);
    
    if (error instanceof Error && error.message.includes('Record to update not found')) {
      return NextResponse.json(
        { success: false, message: 'Payment not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}