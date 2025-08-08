import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = "nodejs";

interface PaymentData {
  id: string;
  transactionFingerprint: string;
  paymentDate: string; // ISO string for JSON serialization
  amount: number;
  source: string;
  transactionRef: string;
  description?: string;
  hashedAccountIdentifier?: string;
  status: string;
  uploadedAt: string; // ISO string for JSON serialization
  // New customer fields from metadata
  customer_name?: string;
  customer_email?: string;
  card_address_line1?: string;
  card_address_postal_code?: string;
}

interface PaymentsResponse {
  success: boolean;
  payments?: PaymentData[];
  total?: number;
  page?: number;
  limit?: number;
  message?: string;
}

export async function GET(req: NextRequest): Promise<NextResponse<PaymentsResponse>> {
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

    // Parse query parameters
    const { searchParams } = req.nextUrl;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const status = searchParams.get('status') || undefined;
    const source = searchParams.get('source') || undefined;
    const amount = searchParams.get('amount') ? parseFloat(searchParams.get('amount')!) : undefined;
    const amountExact = searchParams.get('amountExact') === 'true';
    const textSearch = searchParams.get('textSearch') || undefined;
    const dateFrom = searchParams.get('dateFrom') || undefined;
    const dateTo = searchParams.get('dateTo') || undefined;
    const showAll = searchParams.get('showAll') === 'true';

    // Validate pagination parameters
    if (page < 1 || limit < 1 || limit > 100) {
      return NextResponse.json(
        { success: false, message: 'Invalid pagination parameters. Page must be >= 1, limit must be 1-100.' },
        { status: 400 }
      );
    }

    // Build where clause
    const where: any = {};
    const AND: any[] = [];
    
    if (status && ['pending', 'processing', 'matched', 'confirmed', 'ignored'].includes(status)) {
      where.status = status;
    } else if (!showAll && !status) {
      // By default, exclude matched, confirmed, and ignored payments
      where.status = {
        in: ['pending', 'processing']
      };
    }
    if (source && ['BANK_CSV', 'STRIPE_REPORT'].includes(source)) {
      where.source = source;
    }
    
    // Amount filtering
    if (amount !== undefined && amount > 0) {
      if (amountExact) {
        where.amount = amount;
      } else {
        // Allow for small rounding differences
        where.amount = {
          gte: amount - 0.01,
          lte: amount + 0.01
        };
      }
    }
    
    // Date range filtering
    if (dateFrom) {
      AND.push({
        paymentDate: {
          gte: new Date(dateFrom + 'T00:00:00.000Z')
        }
      });
    }
    if (dateTo) {
      AND.push({
        paymentDate: {
          lte: new Date(dateTo + 'T23:59:59.999Z')
        }
      });
    }
    
    // Text search in customer fields (metadata) and description
    if (textSearch && textSearch.trim()) {
      const searchTerm = textSearch.trim();
      AND.push({
        OR: [
          {
            description: {
              contains: searchTerm,
              mode: 'insensitive' as any
            }
          },
          {
            metadata: {
              path: ['customer_name'],
              string_contains: searchTerm
            }
          },
          {
            metadata: {
              path: ['customer_email'],
              string_contains: searchTerm
            }
          },
          {
            metadata: {
              path: ['card_address_line1'],
              string_contains: searchTerm
            }
          },
          {
            metadata: {
              path: ['card_address_postal_code'],
              string_contains: searchTerm
            }
          }
        ]
      });
    }
    
    // Apply AND conditions if any
    if (AND.length > 0) {
      where.AND = AND;
    }

    // Get total count for pagination
    const total = await prisma.pendingPayment.count({ where });

    // Fetch payments with pagination
    const pendingPayments = await prisma.pendingPayment.findMany({
      where,
      orderBy: [
        { uploadedAt: 'desc' },
        { paymentDate: 'desc' }
      ],
      skip: (page - 1) * limit,
      take: limit,
      include: {
        uploadedBy: {
          select: {
            username: true
          }
        }
      }
    });

    // Transform data for response (convert Decimal to number, Date to ISO string)
    const payments: PaymentData[] = pendingPayments.map(payment => {
      const metadata = payment.metadata as any;
      return {
        id: payment.id,
        transactionFingerprint: payment.transactionFingerprint,
        paymentDate: payment.paymentDate.toISOString(),
        amount: parseFloat(payment.amount.toString()),
        source: payment.source,
        transactionRef: payment.transactionRef,
        description: payment.description || undefined,
        hashedAccountIdentifier: payment.hashedAccountIdentifier || undefined,
        status: payment.status,
        uploadedAt: payment.uploadedAt.toISOString(),
        // Extract customer fields from metadata
        customer_name: metadata?.customer_name || undefined,
        customer_email: metadata?.customer_email || undefined,
        card_address_line1: metadata?.card_address_line1 || undefined,
        card_address_postal_code: metadata?.card_address_postal_code || undefined,
      };
    });


    return NextResponse.json({
      success: true,
      payments,
      total,
      page,
      limit,
      message: `Found ${payments.length} payments (${total} total)`
    });

  } catch (error) {
    console.error('Payments endpoint error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}