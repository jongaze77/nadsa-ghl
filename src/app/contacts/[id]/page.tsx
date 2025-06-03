import React from 'react';
import ContactDetailsClient from './client';

export default async function ContactPage({ params }: { params: { id: string } }) {
  return <ContactDetailsClient contactId={params.id} />;
} 