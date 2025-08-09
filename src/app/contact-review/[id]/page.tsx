'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Contact } from '@prisma/client';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import ContactReviewForm from '@/components/ContactPopOut/ContactReviewForm';

export default function ContactReviewPage() {
  const params = useParams();
  const contactId = params?.id as string;
  
  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!contactId) {
      setError('Contact ID is required');
      setLoading(false);
      return;
    }

    fetchContact();
  }, [contactId]);

  const fetchContact = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/contacts/${contactId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch contact details');
      }

      const data = await response.json();
      setContact(data);
    } catch (err) {
      console.error('Error fetching contact:', err);
      setError(err instanceof Error ? err.message : 'Failed to load contact details');
    } finally {
      setLoading(false);
    }
  };

  const handleContactUpdate = (updatedContact: Contact) => {
    setContact(updatedContact);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading contact details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
            <span className="text-2xl">⚠️</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Error Loading Contact
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {error}
          </p>
          <button
            onClick={() => window.close()}
            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md transition-colors"
          >
            Close Window
          </button>
        </div>
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
            <span className="text-2xl">👤</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Contact Not Found
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            The requested contact could not be found.
          </p>
          <button
            onClick={() => window.close()}
            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md transition-colors"
          >
            Close Window
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                Contact Review
              </h1>
              <p className="mt-2 text-gray-600 dark:text-gray-400">
                Review and edit contact details for {contact.firstName} {contact.lastName}
              </p>
            </div>
            <button
              onClick={() => window.close()}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md transition-colors flex items-center gap-2"
            >
              <span>✕</span>
              Close
            </button>
          </div>
        </div>

        <ContactReviewForm 
          contact={contact} 
          onContactUpdate={handleContactUpdate}
        />
      </div>
    </div>
  );
}