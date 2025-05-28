import type React from 'react';
import EditContactClient from './EditContactClient';
import { Contact } from '@prisma/client';

async function fetchContact(id: string): Promise<Contact | null> {
  const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/contacts/${id}`, { cache: 'no-store' });
  if (!response.ok) return null;
  return response.json();
}

export default async function EditContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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