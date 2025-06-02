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
  }

  // Prepare formData from contact
  const formData = {
    firstName: contact.firstName || '',
    lastName: contact.lastName || '',
    email: contact.email || '',
    phone: contact.phone || '',
    membershipType: contact.membershipType || '',
    companyName: contact.companyName || '',
    address1: contact.address1 || '',
    address2: contact.address2 || '',
    city: contact.city || '',
    state: contact.state || '',
    postalCode: contact.postalCode || '',
    country: contact.country || '',
    website: contact.website || '',
  };

  return <EditContactClient id={id} contact={contact} formData={formData} />;
} 