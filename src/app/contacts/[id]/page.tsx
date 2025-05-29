import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import ContactDetailsClient from './client';
import React from 'react';

export default async function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  const { id } = await params;
  
  if (!session) {
    redirect('/login');
  }

  return <ContactDetailsClient contactId={id} />;
} 