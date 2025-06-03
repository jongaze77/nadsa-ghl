<<<<<<< HEAD
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import ContactDetailsClient from './client';
import React from 'react';

export default async function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  const { id } = await params;
  
  if (!session) {
    redirect('/login');
=======
import type React from 'react';
import { Contact } from '@prisma/client';
import { headers } from 'next/headers';
import EditContactClient from './EditContactClient';

async function fetchContact(id: string): Promise<Contact | null> {
  let apiUrl: string;
  // If running on the server, reconstruct the absolute URL
  if (typeof window === 'undefined') {
    const h = await headers();
    const host = h.get('host');
    const protocol =
      h.get('x-forwarded-proto') ||
      (process.env.NODE_ENV === 'production' ? 'https' : 'http');
    apiUrl = `${protocol}://${host}/api/contacts/${id}`;
  } else {
    // On the client, use relative URL
    apiUrl = `/api/contacts/${id}`;
  }
  const response = await fetch(apiUrl, { cache: 'no-store' });
  if (!response.ok) return null;
  return response.json();
}

export default async function EditContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Defensive: Check id
  if (!id || typeof id !== 'string') {
    return <div className="text-center py-8">No contact ID specified</div>;
  }
  const contact = await fetchContact(id);

  if (!contact) {
    return <div className="text-center py-8">Contact not found</div>;
>>>>>>> 9cfeb25c75d49bc817945a2c3825691dc80655d5
  }

  return <ContactDetailsClient contactId={id} />;
} 