'use client';

import React, { useState } from 'react';
import { PersistedPaymentData } from './types';

interface Contact {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  name?: string;
  membershipType?: string;
}

interface CreateContactFormProps {
  selectedPayment: PersistedPaymentData | null;
  onContactCreated?: (contact: Contact) => void;
  onCancel?: () => void;
}

// Membership types for dropdown
const MEMBERSHIP_TYPES = [
  'Full',
  'Associate',
  'None',
  'Newsletter Only',
  'Ex Member',
];

export default function CreateContactForm({ 
  selectedPayment, 
  onContactCreated, 
  onCancel 
}: CreateContactFormProps) {
  const [form, setForm] = useState(() => {
    // Pre-populate form with payment data if available
    const initialForm = {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      membershipType: '',
    };

    if (selectedPayment) {
      // Try to extract name from customer_name
      if (selectedPayment.customer_name) {
        const nameParts = selectedPayment.customer_name.trim().split(' ');
        if (nameParts.length >= 2) {
          initialForm.firstName = nameParts[0];
          initialForm.lastName = nameParts.slice(1).join(' ');
        } else if (nameParts.length === 1) {
          initialForm.firstName = nameParts[0];
        }
      }

      // Use customer email if available
      if (selectedPayment.customer_email) {
        initialForm.email = selectedPayment.customer_email;
      }
    }

    return initialForm;
  });

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Simple required fields check
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) {
      setError('First name, last name, and email are required.');
      return;
    }

    setSaving(true);

    try {
      // Check for existing email first
      const searchRes = await fetch(`/api/contacts?search=${encodeURIComponent(form.email.trim())}&limit=1`);
      const searchData = await searchRes.json();
      if (searchData.contacts && searchData.contacts.some((c: any) => c.email?.toLowerCase() === form.email.trim().toLowerCase())) {
        setError('A contact with this email already exists.');
        setSaving(false);
        return;
      }

      // Create contact
      const res = await fetch('/api/contacts/new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        setError(data.error || 'Failed to create contact.');
        return;
      }

      // Notify parent component
      if (onContactCreated) {
        onContactCreated({
          id: data.id,
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          name: data.name,
          membershipType: data.membershipType
        });
      }
      
    } catch (err: any) {
      setError(err.message || 'Failed to create contact.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h4 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-2">
          Create New Contact
        </h4>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Create a new contact record for this payment. Information from the payment has been pre-filled where available.
        </p>
      </div>

      {/* Payment Context */}
      {selectedPayment && (
        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
          <h5 className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-1">
            Payment Context
          </h5>
          <div className="text-xs text-blue-700 dark:text-blue-400 space-y-1">
            <div>
              <span className="font-medium">Amount:</span> {new Intl.NumberFormat('en-GB', {
                style: 'currency',
                currency: 'GBP'
              }).format(selectedPayment.amount)}
            </div>
            <div>
              <span className="font-medium">Date:</span> {new Date(selectedPayment.paymentDate).toLocaleDateString('en-GB')}
            </div>
            {selectedPayment.customer_name && (
              <div>
                <span className="font-medium">Customer Name:</span> {selectedPayment.customer_name}
              </div>
            )}
            {selectedPayment.customer_email && (
              <div>
                <span className="font-medium">Customer Email:</span> {selectedPayment.customer_email}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="firstName">
              First Name *
            </label>
            <input
              name="firstName"
              id="firstName"
              type="text"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={form.firstName}
              onChange={handleChange}
              required
              disabled={saving}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="lastName">
              Last Name *
            </label>
            <input
              name="lastName"
              id="lastName"
              type="text"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={form.lastName}
              onChange={handleChange}
              required
              disabled={saving}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="email">
            Email *
          </label>
          <input
            name="email"
            id="email"
            type="email"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={form.email}
            onChange={handleChange}
            required
            disabled={saving}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="phone">
            Phone
          </label>
          <input
            name="phone"
            id="phone"
            type="tel"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={form.phone}
            onChange={handleChange}
            disabled={saving}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="membershipType">
            Membership Type
          </label>
          <select
            name="membershipType"
            id="membershipType"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={form.membershipType}
            onChange={handleChange}
            disabled={saving}
          >
            <option value="">-- Select --</option>
            {MEMBERSHIP_TYPES.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200 dark:border-red-800">
            <div className="flex items-center space-x-2">
              <span className="text-red-400 text-sm">⚠️</span>
              <p className="text-sm text-red-700 dark:text-red-400">
                {error}
              </p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className={`flex-1 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md transition-colors ${
              saving 
                ? 'opacity-60 cursor-not-allowed' 
                : 'hover:bg-green-700 focus:ring-2 focus:ring-green-500'
            }`}
          >
            {saving ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Creating...
              </div>
            ) : (
              'Create Contact'
            )}
          </button>
          
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-md hover:bg-gray-400 dark:hover:bg-gray-500 focus:ring-2 focus:ring-gray-500 transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
}