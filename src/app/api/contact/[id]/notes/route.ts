import { NextRequest, NextResponse } from 'next/server';
import { getApiKey, getLocationId } from '@/lib/ghl-api';

// Tell Next.js this route is always dynamic
export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const GHL_API_KEY = getApiKey();
  const GHL_LOCATION_ID = getLocationId();

  if (!GHL_API_KEY || !GHL_LOCATION_ID) {
    return NextResponse.json(
      { error: 'Missing API key or location ID' },
      { status: 500 }
    );
  }

  try {
    const res = await fetch(
      `https://rest.gohighlevel.com/v1/contacts/${id}/notes`,
      {
        headers: {
          'Authorization': `Bearer ${GHL_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!res.ok) {
      const error = await res.json();
      return NextResponse.json(
        { error: error.message || 'Failed to fetch notes' },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json({ notes: data.notes || [] });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch notes' },
      { status: 500 }
    );
  }
} 