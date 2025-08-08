import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { CsvParsingService } from '@/lib/CsvParsingService';

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

      return NextResponse.json({
        success: true,
        data: result.data,
        processed: result.processed,
        skipped: result.skipped,
        message: `Successfully processed ${result.processed} payments${result.skipped > 0 ? `, skipped ${result.skipped}` : ''}`,
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