import { NextResponse } from 'next/server';

// Tell Next.js this route is always dynamic
export const dynamic = 'force-dynamic';

const GHL_API_KEY = process.env.GHL_API_KEY;
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  if (!GHL_API_KEY || !GHL_LOCATION_ID) {
    return NextResponse.json(
      { error: 'Missing API key or location ID' },
      { status: 500 }
    );
  }

  try {
    const res = await fetch(
      `https://rest.gohighlevel.com/v1/contacts/${params.id}/notes`,
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