import { NextRequest, NextResponse } from 'next/server';

// Tell Next.js this route is always dynamic
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const apiKey = process.env.GHL_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: 'Missing API key' }, { status: 500 });
  }

  try {
    const res = await fetch('https://rest.gohighlevel.com/v1/custom-fields/', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });
    const text = await res.text();
    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch custom fields', status: res.status, body: text }, { status: res.status });
    }
    try {
      const data = JSON.parse(text);
      return NextResponse.json(data);
    } catch (parseError) {
      return NextResponse.json({ error: 'Failed to parse response', body: text }, { status: 500 });
    }
  } catch (error) {
    return NextResponse.json({ error: 'Server error', details: error }, { status: 500 });
  }
} 