// src/app/api/contact/[id]/notes/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { fetchWithRetry, getApiKey, getLocationId } from '@/lib/ghl-api';

// Tell Next.js this route is always dynamic
export const dynamic = 'force-dynamic';

interface GHLNote {
  id: string;
  body: string;
  dateAdded: string;
  userId: string;
  userName?: string;
  contactId: string;
}

interface GHLNotesResponse {
  notes: GHLNote[];
  count: number;
  totalCount: number;
}

// GET /api/contact/[id]/notes - Fetch contact notes from GHL
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: contactId } = await params;
    if (!contactId) {
      return NextResponse.json({ error: 'Contact ID is required' }, { status: 400 });
    }

    const apiKey = getApiKey();
    const locationId = getLocationId();
    
    if (!apiKey || !locationId) {
      console.error('Missing GHL API configuration');
      return NextResponse.json({ error: 'API configuration error' }, { status: 500 });
    }

    // Fetch notes from GHL API with retry logic
    const response = await fetchWithRetry(
      `https://rest.gohighlevel.com/v1/contacts/${contactId}/notes`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.error(`GHL notes fetch failed: ${response.status} ${response.statusText}`);
      if (response.status === 404) {
        return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
      }
      throw new Error(`GHL API error: ${response.status}`);
    }

    const data: GHLNotesResponse = await response.json();
    
    // Transform notes for frontend consumption
    const transformedNotes = (data.notes || []).map(note => ({
      id: note.id,
      content: note.body,
      createdAt: note.dateAdded,
      userId: note.userId,
      userName: note.userName || 'Unknown User',
      contactId: note.contactId,
    }));

    return NextResponse.json({
      notes: transformedNotes,
      count: data.count || 0,
      totalCount: data.totalCount || 0,
    });

  } catch (error) {
    console.error('Error fetching contact notes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch contact notes' },
      { status: 500 }
    );
  }
}

// POST /api/contact/[id]/notes - Add new note to GHL contact
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: contactId } = await params;
    if (!contactId) {
      return NextResponse.json({ error: 'Contact ID is required' }, { status: 400 });
    }

    const body = await request.json();
    const { content } = body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json({ error: 'Note content is required' }, { status: 400 });
    }

    if (content.length > 5000) {
      return NextResponse.json({ error: 'Note content too long (max 5000 characters)' }, { status: 400 });
    }

    const apiKey = getApiKey();
    const locationId = getLocationId();
    
    if (!apiKey || !locationId) {
      console.error('Missing GHL API configuration');
      return NextResponse.json({ error: 'API configuration error' }, { status: 500 });
    }

    // Create note in GHL
    const notePayload = {
      body: content.trim(),
    };

    const response = await fetchWithRetry(
      `https://rest.gohighlevel.com/v1/contacts/${contactId}/notes`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(notePayload),
      }
    );

    if (!response.ok) {
      console.error(`GHL note creation failed: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error('GHL error response:', errorText);
      
      if (response.status === 404) {
        return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
      }
      throw new Error(`GHL API error: ${response.status}`);
    }

    const createdNote = await response.json();
    
    // Transform the created note for frontend
    const transformedNote = {
      id: createdNote.id,
      content: createdNote.body,
      createdAt: createdNote.dateAdded || new Date().toISOString(),
      userId: createdNote.userId,
      userName: session.user?.name || session.user?.email || 'Current User',
      contactId: createdNote.contactId || contactId,
    };

    return NextResponse.json({
      success: true,
      note: transformedNote,
    });

  } catch (error) {
    console.error('Error creating contact note:', error);
    return NextResponse.json(
      { error: 'Failed to create contact note' },
      { status: 500 }
    );
  }
} 