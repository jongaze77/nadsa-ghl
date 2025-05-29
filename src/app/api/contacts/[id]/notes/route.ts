import { NextRequest, NextResponse } from 'next/server';
import { getApiKey } from '@/lib/ghl-api';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

// Helper function for reliable server-side logging
function log(message: string) {
  process.stdout.write(message + '\n');
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: contactId } = await params;
    log(`\n🔵 ===== FETCHING NOTES FOR CONTACT ${contactId} =====`);

    // Check session
    const session = await getServerSession(authOptions);
    if (!session) {
      log('❌ No session found');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    log(`👤 User: ${session.user?.name}`);

    const apiKey = getApiKey();
    if (!apiKey) {
      throw new Error('Missing API key');
    }

    const res = await fetch(`https://rest.gohighlevel.com/v1/contacts/${contactId}/notes`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      const error = await res.json();
      log(`❌ Failed to fetch notes: ${error.message || 'Unknown error'}`);
      throw new Error(error.message || 'Failed to fetch notes');
    }

    const data = await res.json();
    log(`✅ Notes fetched successfully: ${JSON.stringify(data, null, 2)}`);
    log('\n🔵 ===== NOTES FETCH COMPLETED =====\n');

    return NextResponse.json(data);
  } catch (error) {
    log('\n❌ ===== ERROR IN NOTES FETCH =====');
    log(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch notes' },
      { status: 500 }
    );
  }
} 