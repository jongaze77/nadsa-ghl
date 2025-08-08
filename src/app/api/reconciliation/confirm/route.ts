import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { ParsedPaymentData } from '@/lib/CsvParsingService';
import { Decimal } from '@prisma/client/runtime/library';

export const dynamic = 'force-dynamic';
export const runtime = "nodejs";

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
      // Start database transaction
      const result = await prisma.$transaction(async (tx) => {
        // Check if transaction already exists
        const existingReconciliation = await tx.reconciliationLog.findUnique({
          where: { transactionFingerprint: paymentData.transactionFingerprint },
        });

        if (existingReconciliation) {
          throw new Error('Transaction has already been reconciled');
        }

        // Verify contact exists
        const contact = await tx.contact.findUnique({
          where: { id: contactId },
        });

        if (!contact) {
          throw new Error('Contact not found');
        }

        // Get user ID from session
        const user = await tx.user.findUnique({
          where: { username: session.user.name || '' },
        });

        if (!user) {
          throw new Error('User not found');
        }

        // Create reconciliation log entry
        const reconciliationLog = await tx.reconciliationLog.create({
          data: {
            transactionFingerprint: paymentData.transactionFingerprint,
            paymentDate: paymentDate,
            amount: new Decimal(paymentData.amount),
            source: paymentData.source || 'BANK_CSV',
            transactionRef: paymentData.transactionRef || paymentData.transactionFingerprint,
            reconciledByUserId: user.id,
            contactId: contactId,
            metadata: {
              confidence: confidence,
              reasoning: reasoning,
              description: paymentData.description,
              hashedAccountIdentifier: paymentData.hashedAccountIdentifier,
              reconciledAt: new Date().toISOString(),
            },
          },
        });

        // Create or update payment source if hashedAccountIdentifier exists
        if (paymentData.hashedAccountIdentifier) {
          await tx.paymentSource.upsert({
            where: { hashedIdentifier: paymentData.hashedAccountIdentifier },
            update: {
              contactId: contactId,
            },
            create: {
              hashedIdentifier: paymentData.hashedAccountIdentifier,
              sourceType: paymentData.source === 'STRIPE_REPORT' ? 'stripe_source' : 'bank_account',
              contactId: contactId,
            },
          });
        }

        return reconciliationLog;
      });

      // TODO: In future story, integrate with ReconciliationService for GHL/WordPress updates
      // This will be implemented in Story 1.8: GHL and WordPress update services

      return NextResponse.json({
        success: true,
        reconciliationLogId: result.id,
        message: 'Match confirmed and reconciliation logged successfully',
      });

    } catch (dbError) {
      console.error('Database transaction error:', dbError);
      
      if (dbError instanceof Error) {
        if (dbError.message.includes('already been reconciled')) {
          return NextResponse.json(
            { success: false, message: 'This transaction has already been reconciled' },
            { status: 409 }
          );
        }
        if (dbError.message.includes('Contact not found')) {
          return NextResponse.json(
            { success: false, message: 'Contact not found' },
            { status: 404 }
          );
        }
        if (dbError.message.includes('User not found')) {
          return NextResponse.json(
            { success: false, message: 'User session invalid' },
            { status: 401 }
          );
        }
      }

      return NextResponse.json(
        { success: false, message: 'Failed to confirm match' },
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