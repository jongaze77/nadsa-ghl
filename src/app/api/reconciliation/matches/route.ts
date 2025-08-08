import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { MatchingService } from '@/lib/MatchingService';
import type { ParsedPaymentData } from '@/lib/CsvParsingService';

export const dynamic = 'force-dynamic';
export const runtime = "nodejs";

interface MatchesRequest {
  paymentData: ParsedPaymentData;
}

interface MatchesResponse {
  success: boolean;
  suggestions?: any[];
  totalMatches?: number;
  processingTimeMs?: number;
  message?: string;
}

export async function POST(req: NextRequest): Promise<NextResponse<MatchesResponse>> {
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
    const body: MatchesRequest = await req.json();
    
    if (!body.paymentData) {
      return NextResponse.json(
        { success: false, message: 'Payment data is required' },
        { status: 400 }
      );
    }

    // Validate payment data structure
    const { paymentData } = body;
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

    // Ensure paymentDate is a Date object for the service
    const normalizedPaymentData: ParsedPaymentData = {
      ...paymentData,
      paymentDate: paymentDate,
    };

    // Use MatchingService to find suggestions
    const matchingService = new MatchingService();
    const matchResult = await matchingService.findMatches(normalizedPaymentData);

    return NextResponse.json({
      success: true,
      suggestions: matchResult.suggestions,
      totalMatches: matchResult.totalMatches,
      processingTimeMs: matchResult.processingTimeMs,
      message: `Found ${matchResult.suggestions.length} match suggestions`,
    });

  } catch (error) {
    console.error('Matches endpoint error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest): Promise<NextResponse<MatchesResponse>> {
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

    // Extract query parameters for GET request
    const { searchParams } = req.nextUrl;
    const transactionFingerprint = searchParams.get('transactionFingerprint');
    const amount = searchParams.get('amount');
    const paymentDate = searchParams.get('paymentDate');
    const source = searchParams.get('source') as 'BANK_CSV' | 'STRIPE_REPORT';
    const description = searchParams.get('description');

    if (!transactionFingerprint || !amount || !paymentDate) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Missing required parameters: transactionFingerprint, amount, paymentDate' 
        },
        { status: 400 }
      );
    }

    // Validate and convert parameters
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return NextResponse.json(
        { success: false, message: 'Amount must be a positive number' },
        { status: 400 }
      );
    }

    const paymentDateObj = new Date(paymentDate);
    if (isNaN(paymentDateObj.getTime())) {
      return NextResponse.json(
        { success: false, message: 'Invalid payment date format' },
        { status: 400 }
      );
    }

    if (source && !['BANK_CSV', 'STRIPE_REPORT'].includes(source)) {
      return NextResponse.json(
        { success: false, message: 'Source must be "BANK_CSV" or "STRIPE_REPORT"' },
        { status: 400 }
      );
    }

    // Construct payment data from query parameters
    const paymentData: ParsedPaymentData = {
      transactionFingerprint,
      amount: amountNum,
      paymentDate: paymentDateObj,
      source: source || 'BANK_CSV',
      transactionRef: transactionFingerprint,
      description: description || undefined,
    };

    // Use MatchingService to find suggestions
    const matchingService = new MatchingService();
    const matchResult = await matchingService.findMatches(paymentData);

    return NextResponse.json({
      success: true,
      suggestions: matchResult.suggestions,
      totalMatches: matchResult.totalMatches,
      processingTimeMs: matchResult.processingTimeMs,
      message: `Found ${matchResult.suggestions.length} match suggestions`,
    });

  } catch (error) {
    console.error('Matches GET endpoint error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}