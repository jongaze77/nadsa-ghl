import React from 'react';
import ContactDetailsClient from './client';

export default async function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ContactDetailsClient contactId={id} />;
}