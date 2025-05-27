// src/app/api/contacts/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const apiKey = process.env.GHL_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Missing API key' }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const q     = searchParams.get('q')     ?? '';
  const page  = Number(searchParams.get('page')  ?? '1');
  const limit = Number(searchParams.get('limit') ?? '100');  // HL max = 100

  try {
    const hlRes = await fetch(
      `https://rest.gohighlevel.com/v1/contacts?` +
      `query=${encodeURIComponent(q)}` +
      `&page=${page}&limit=${limit}` +
      `&fields=firstName,lastName,email`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );

    const body = await hlRes.text();
    if (!hlRes.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch contacts', status: hlRes.status, body },
        { status: hlRes.status }
      );
    }

    const data = JSON.parse(body);          // { contacts: [...], meta: {...} }

    const contacts = (data.contacts ?? []).map((c: any) => ({
      id:    c.id,
      name:  `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim(),
      email: c.email ?? '',
    }));

    return NextResponse.json({
      contacts,
      meta: {
        page,
        limit,
        total: data.meta?.total ?? contacts.length,
        hasMore: contacts.length === limit,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: 'Server error', details: err }, { status: 500 });
  }
}