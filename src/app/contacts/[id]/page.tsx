import React from 'react';
import ContactDetailsClient from './client';

export default function ContactPage({ params }: { params: { id: string } }) {
  return <ContactDetailsClient contactId={params.id} />;
} 