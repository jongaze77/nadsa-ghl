import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getMailmergeExportPreview, generateMailmergeCSV } from '@/lib/export-service';

export async function GET(request: NextRequest) {
  try {
    // Verify authentication and admin role
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Check if this is a preview request
    const searchParams = request.nextUrl.searchParams;
    const isPreview = searchParams.get('preview') === 'true';
    
    if (isPreview) {
      // Return preview data with contact count
      const previewData = await getMailmergeExportPreview();
      
      console.log(`Mailmerge export preview: ${previewData.count} contacts match criteria`);
      
      return NextResponse.json(previewData, { status: 200 });
    }
    
    // Generate full CSV export
    console.log('Starting mailmerge CSV export generation...');
    
    const csvData = await generateMailmergeCSV();
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    const filename = `mailmerge-export-${timestamp}.csv`;
    
    // Get preview data for logging
    const previewData = await getMailmergeExportPreview();
    console.log(`Mailmerge CSV export completed: ${previewData.count} contacts exported to ${filename}`);
    
    // Return CSV file download response
    return new NextResponse(csvData, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    
  } catch (error) {
    console.error('Mailmerge export API error:', error);
    
    // Return appropriate error response
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: errorMessage }, 
      { status: 500 }
    );
  }
}