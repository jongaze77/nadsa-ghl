import { NextRequest, NextResponse } from 'next/server';
import { getApiKey } from '@/lib/ghl-api';
import { PUT as contactsPUT } from '@/app/api/contacts/[id]/route';

// Tell Next.js this route is always dynamic
export const dynamic = 'force-dynamic';

/* ─ helpers ────────────────────────────────────────────── */
function auth(): HeadersInit {
  const key = getApiKey();
  if (!key) throw new Error('Missing API key');
  return {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
}

async function forward(res: Response) {
  const txt = await res.text();
  if (!txt) return NextResponse.json({}, { status: res.status });
  try {
    return NextResponse.json(JSON.parse(txt), { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Non-JSON from GHL', body: txt }, { status: 500 });
  }
}

/* ─ GET /api/contact/[id] ──────────────────────────────── */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const key = getApiKey();

  const hlRes = await fetch(
    `https://rest.gohighlevel.com/v1/contacts/${id}?include_custom_fields=true`,
    { headers: auth() }
  );

  /* ↳  GHL returns `{ contact: { …fields… } }` */

  const text = await hlRes.text();

  /* propagate non-OK responses as-is */
  if (!hlRes.ok) {
    return NextResponse.json(
      { error: 'Failed to fetch contact', status: hlRes.status, body: text },
      { status: hlRes.status },
    );
  }

  /* empty body ⇒ return an empty object so the client won't crash */
  if (!text) return NextResponse.json({});

  /* normal success path */
  const data = JSON.parse(text);          // { contact: { ... } }
  return NextResponse.json(data.contact ?? data);
}

/* ─ PUT /api/contact/[id] ──────────────────────────────── */
export { contactsPUT as PUT };