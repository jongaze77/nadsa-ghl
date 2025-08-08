import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { CsvParsingService } from '@/lib/CsvParsingService';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = "nodejs";

interface UploadResponse {
  success: boolean;
  data?: any[];
  errors?: string[];
  processed?: number;
  skipped?: number;
  message?: string;
}

export async function POST(req: NextRequest): Promise<NextResponse<UploadResponse>> {
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

    // Parse multipart form data
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const fileType = formData.get('type') as string; // 'lloyds' or 'stripe'

    if (!file) {
      return NextResponse.json(
        { success: false, message: 'No file provided' },
        { status: 400 }
      );
    }

    if (!fileType || !['lloyds', 'stripe'].includes(fileType)) {
      return NextResponse.json(
        { success: false, message: 'Invalid file type. Must be "lloyds" or "stripe"' },
        { status: 400 }
      );
    }

    // Validate file format
    if (!file.name.toLowerCase().endsWith('.csv')) {
      return NextResponse.json(
        { success: false, message: 'Invalid file format. Only CSV files are accepted' },
        { status: 400 }
      );
    }

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, message: 'File too large. Maximum size is 10MB' },
        { status: 400 }
      );
    }

    // Read file content
    const fileContent = await file.text();
    if (!fileContent.trim()) {
      return NextResponse.json(
        { success: false, message: 'File is empty' },
        { status: 400 }
      );
    }

    // Get user from database for ID
    const user = await prisma.user.findUnique({
      where: { username: session.user.name! },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 401 }
      );
    }

    // Process CSV using CsvParsingService
    const csvParser = new CsvParsingService();
    let result;

    try {
      if (fileType === 'lloyds') {
        result = await csvParser.parseLloydsBankCsv(fileContent);
      } else {
        result = await csvParser.parseStripeCsv(fileContent);
      }

      if (!result.success) {
        return NextResponse.json(
          {
            success: false,
            message: 'CSV parsing failed',
            errors: result.errors,
            processed: result.processed,
            skipped: result.skipped,
          },
          { status: 400 }
        );
      }

      // Persist parsed payment data to database
      let persistedCount = 0;
      let alreadyExistsCount = 0;
      const persistErrors: string[] = [];

      if (result.data && result.data.length > 0) {
        for (const paymentData of result.data) {
          try {
            // Check if payment already exists in PendingPayment
            const existingPending = await prisma.pendingPayment.findUnique({
              where: { transactionFingerprint: paymentData.transactionFingerprint },
            });

            if (existingPending) {
              alreadyExistsCount++;
              continue;
            }

            // Prepare metadata with new customer fields
            const metadata: any = {};
            if (paymentData.customer_name) metadata.customer_name = paymentData.customer_name;
            if (paymentData.customer_email) metadata.customer_email = paymentData.customer_email;
            if (paymentData.card_address_line1) metadata.card_address_line1 = paymentData.card_address_line1;
            if (paymentData.card_address_postal_code) metadata.card_address_postal_code = paymentData.card_address_postal_code;

            // Create PendingPayment record
            await prisma.pendingPayment.create({
              data: {
                transactionFingerprint: paymentData.transactionFingerprint,
                paymentDate: paymentData.paymentDate,
                amount: paymentData.amount,
                source: paymentData.source,
                transactionRef: paymentData.transactionRef,
                description: paymentData.description,
                hashedAccountIdentifier: paymentData.hashedAccountIdentifier,
                uploadedByUserId: user.id,
                status: 'pending',
                metadata: Object.keys(metadata).length > 0 ? metadata : null,
              },
            });

            persistedCount++;
          } catch (error) {
            console.error('Error persisting payment data:', error);
            persistErrors.push(
              `Failed to persist payment ${paymentData.transactionFingerprint}: ${
                error instanceof Error ? error.message : 'Unknown error'
              }`
            );
          }
        }
      }

      return NextResponse.json({
        success: true,
        data: result.data,
        processed: persistedCount,
        skipped: result.skipped + alreadyExistsCount,
        message: `Successfully processed and persisted ${persistedCount} payments${
          result.skipped + alreadyExistsCount > 0 
            ? `, skipped ${result.skipped + alreadyExistsCount} (${result.skipped} parsing errors + ${alreadyExistsCount} already exists)` 
            : ''
        }${persistErrors.length > 0 ? `. ${persistErrors.length} persistence errors.` : ''}`,
        errors: persistErrors.length > 0 ? persistErrors : undefined,
      });

    } catch (error) {
      console.error('CSV parsing error:', error);
      return NextResponse.json(
        {
          success: false,
          message: 'Failed to process CSV file',
          errors: [error instanceof Error ? error.message : 'Unknown error'],
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Upload endpoint error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}