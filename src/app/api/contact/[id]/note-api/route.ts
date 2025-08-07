import { NextRequest, NextResponse } from 'next/server';
import { getApiKey, getLocationId } from '@/lib/ghl-api';

// Tell Next.js this route is always dynamic
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = req.nextUrl;
  const page = Number(searchParams.get('page') ?? '1');
  const limit = Number(searchParams.get('limit') ?? '10');

  const apiKey = getApiKey();
  if (!apiKey) {
    return NextResponse.json({ error: 'Missing API key' }, { status: 500 });
  }

  try {
    const res = await fetch(
      `https://rest.gohighlevel.com/v1/contacts/${id}/notes?page=${page}&limit=${limit}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
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
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch notes' },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const apiKey = getApiKey();
  if (!apiKey) {
    return NextResponse.json({ error: 'Missing API key' }, { status: 500 });
  }

  const { body, userId, noteId } = await req.json();

  try {
    const url = noteId
      ? `https://rest.gohighlevel.com/v1/contacts/${id}/notes/${noteId}`
      : `https://rest.gohighlevel.com/v1/contacts/${id}/notes/`;

    const method = noteId ? 'PUT' : 'POST';

    const res   = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ body, userId }),
    });

    const text  = await res.text();
    if (!res.ok) {
      return NextResponse.json(
        { error: 'Failed to update/create note', status: res.status, body: text },
        { status: res.status }
      );
    }

    return NextResponse.json(JSON.parse(text));
  } catch (err) {
    return NextResponse.json({ error: 'Server error', details: err }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const apiKey = getApiKey();
  const locationId = getLocationId();
  
  if (!apiKey || !locationId) {
    return NextResponse.json(
      { error: 'Missing API key or location ID' },
      { status: 500 }
    );
  }

  try {
    const body = await req.json();
    const res = await fetch(
      `https://rest.gohighlevel.com/v1/contacts/${id}/notes`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ body: body.body }),
      }
    );

    if (!res.ok) {
      const error = await res.json();
      return NextResponse.json(
        { error: error.message || 'Failed to create note' },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to create note' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return NextResponse.json({ error: 'Not implemented' }, { status: 501 });
}