import { NextRequest, NextResponse } from 'next/server';

// Tell Next.js this route is always dynamic
export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const apiKey = process.env.GHL_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Missing API key' }, { status: 500 });
  }

  try {
    const res = await fetch(`https://rest.gohighlevel.com/v1/contacts/${id}/notes/`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    const text = await res.text();
    if (!res.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch notes', status: res.status, body: text },
        { status: res.status }
      );
    }

    const { notes = [] } = JSON.parse(text);
    return NextResponse.json({ note: notes[0] ?? null });
  } catch (err) {
    return NextResponse.json({ error: 'Server error', details: err }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const apiKey = process.env.GHL_API_KEY;
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

const GHL_API_KEY = process.env.GHL_API_KEY;
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;

export async function POST(
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
    const body = await request.json();
    const res = await fetch(
      `https://rest.gohighlevel.com/v1/contacts/${params.id}/notes`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GHL_API_KEY}`,
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