import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { ReconciliationService } from '@/lib/ReconciliationService';
import { prisma } from '@/lib/prisma';
import type { ParsedPaymentData } from '@/lib/CsvParsingService';

export const dynamic = 'force-dynamic';
export const runtime = "nodejs";

/**
 * Helper function to get user by username
 */
async function getUserByUsername(username: string) {
  return await prisma.user.findUnique({
    where: { username },
  });
}

interface ConfirmRequest {
  paymentData: ParsedPaymentData;
  contactId: string;
  confidence: number;
  reasoning?: any;
}

interface ConfirmResponse {
  success: boolean;
  reconciliationLogId?: string;
  message?: string;
  ghlUpdateResult?: any;
  wordpressUpdateResult?: any;
  errors?: string[];
}

export async function POST(req: NextRequest): Promise<NextResponse<ConfirmResponse>> {
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
    const body: ConfirmRequest = await req.json();
    
    if (!body.paymentData || !body.contactId) {
      return NextResponse.json(
        { success: false, message: 'Payment data and contact ID are required' },
        { status: 400 }
      );
    }

    const { paymentData, contactId, confidence, reasoning } = body;

    // Validate payment data structure
    if (!paymentData.transactionFingerprint || !paymentData.amount || !paymentData.paymentDate) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Invalid payment data. Required fields: transactionFingerprint, amount, paymentDate' 
        },
        { status: 400 }
      );
    }

    // Validate amount is positive number
    if (typeof paymentData.amount !== 'number' || paymentData.amount <= 0) {
      return NextResponse.json(
        { success: false, message: 'Amount must be a positive number' },
        { status: 400 }
      );
    }

    // Validate paymentDate
    const paymentDate = new Date(paymentData.paymentDate);
    if (isNaN(paymentDate.getTime())) {
      return NextResponse.json(
        { success: false, message: 'Invalid payment date format' },
        { status: 400 }
      );
    }

    // Validate contactId format
    if (typeof contactId !== 'string' || contactId.trim().length === 0) {
      return NextResponse.json(
        { success: false, message: 'Invalid contact ID' },
        { status: 400 }
      );
    }

    try {
      // Get user ID from session
      const user = session.user?.name ? await getUserByUsername(session.user.name) : null;
      
      if (!user) {
        return NextResponse.json(
          { success: false, message: 'User session invalid' },
          { status: 401 }
        );
      }

      // Create reconciliation service instance
      const reconciliationService = new ReconciliationService();

      console.log(`[Confirm API] Starting reconciliation for contact ${contactId}`);

      // Use ReconciliationService to handle the complete reconciliation
      const result = await reconciliationService.confirmMatch({
        paymentData,
        contactId,
        confidence,
        reasoning,
        reconciledByUserId: user.id,
      });

      if (result.success) {
        console.log(`[Confirm API] Reconciliation completed successfully`);
        return NextResponse.json({
          success: true,
          reconciliationLogId: result.reconciliationLogId,
          message: 'Match confirmed and reconciliation completed successfully',
          ghlUpdateResult: result.ghlUpdateResult,
          wordpressUpdateResult: result.wordpressUpdateResult,
          errors: result.errors,
        });
      } else {
        console.error(`[Confirm API] Reconciliation failed:`, result.errors);
        return NextResponse.json(
          { 
            success: false, 
            message: 'Reconciliation failed', 
            errors: result.errors,
            reconciliationLogId: result.reconciliationLogId,
          },
          { status: result.rollbackPerformed ? 500 : 422 }
        );
      }

    } catch (reconciliationError) {
      console.error('Reconciliation service error:', reconciliationError);
      
      return NextResponse.json(
        { success: false, message: 'Internal reconciliation service error' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Confirm endpoint error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}