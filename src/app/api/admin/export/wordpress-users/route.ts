// src/app/api/admin/export/wordpress-users/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { 
  getExportPreview, 
  generateWordPressUsersCSV 
} from '@/lib/export-service';

/**
 * GET /api/admin/export/wordpress-users
 * 
 * Query parameters:
 * - preview=true: Returns preview data (count and criteria)
 * - preview=false or omitted: Returns CSV file download
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check admin role
    if (session.user?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const isPreview = searchParams.get('preview') === 'true';

    if (isPreview) {
      // Return export preview
      try {
        const preview = await getExportPreview();
        
        return NextResponse.json(preview, { status: 200 });
      } catch (error) {
        console.error('Export preview error:', error);
        
        return NextResponse.json(
          { error: 'Failed to generate export preview' },
          { status: 500 }
        );
      }
    } else {
      // Generate and return CSV file
      try {
        const csvData = await generateWordPressUsersCSV();
        
        if (!csvData || csvData.trim() === 'user_login,user_email,role,first_name,last_name') {
          return NextResponse.json(
            { error: 'No data available for export' },
            { status: 404 }
          );
        }

        // Generate filename with current date
        const today = new Date();
        const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD format
        const filename = `wordpress-users-export-${dateStr}.csv`;

        // Return CSV file as download
        return new NextResponse(csvData, {
          status: 200,
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        });
      } catch (error) {
        console.error('CSV generation error:', error);
        
        return NextResponse.json(
          { error: 'Failed to generate CSV export' },
          { status: 500 }
        );
      }
    }
  } catch (error) {
    console.error('API route error:', error);
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Only GET method is supported
export async function POST() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}

export async function PUT() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}