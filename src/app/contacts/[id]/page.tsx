import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import ContactDetailsClient from './client';

export default async function ContactPage({ params }: { params: { id: string } }) {
  const session = await getServerSession();
  
  if (!session) {
    redirect('/login');
  }

  return <ContactDetailsClient contactId={params.id} />;
} 