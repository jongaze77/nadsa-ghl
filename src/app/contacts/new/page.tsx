'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// Membership types for dropdown
const MEMBERSHIP_TYPES = [
  'Full',
  'Associate',
  'None',
  'Newsletter Only',
  'Ex Member',
];

export default function NewContactPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    membershipType: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

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

    // Check for existing email
    try {
      const res = await fetch(`/api/contacts?search=${encodeURIComponent(form.email.trim())}&limit=1`);
      const data = await res.json();
      if (data.contacts && data.contacts.some((c: any) => c.email?.toLowerCase() === form.email.trim().toLowerCase())) {
        setError('A contact with this email already exists.');
        setSaving(false);
        return;
      }
    } catch {
      // On search fail, allow creation (optimistic)
    }

    // Create contact
    try {
      const res = await fetch('/api/contacts/new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to create contact.');
        setSaving(false);
        return;
      }
      // Instead of redirecting to /all-contacts, go to /contacts/[id]
      // The API should return the contact with its GHL id
      router.replace(`/contacts/${data.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create contact.');
    } finally {
      setSaving(false);
    }
  };

  if (status === 'loading') return <div className="p-4">Loading...</div>;

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-lg">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Add New Member</h1>
          <Link href="/all-contacts" className="text-blue-700 hover:underline">Back to Contacts</Link>
        </div>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block font-semibold mb-1" htmlFor="firstName">First Name *</label>
            <input
              name="firstName"
              id="firstName"
              className="w-full p-3 border-2 border-black rounded-lg"
              value={form.firstName}
              onChange={handleChange}
              required
              disabled={saving}
            />
          </div>
          <div>
            <label className="block font-semibold mb-1" htmlFor="lastName">Last Name *</label>
            <input
              name="lastName"
              id="lastName"
              className="w-full p-3 border-2 border-black rounded-lg"
              value={form.lastName}
              onChange={handleChange}
              required
              disabled={saving}
            />
          </div>
          <div>
            <label className="block font-semibold mb-1" htmlFor="email">Email *</label>
            <input
              name="email"
              id="email"
              type="email"
              className="w-full p-3 border-2 border-black rounded-lg"
              value={form.email}
              onChange={handleChange}
              required
              disabled={saving}
            />
          </div>
          <div>
            <label className="block font-semibold mb-1" htmlFor="phone">Phone</label>
            <input
              name="phone"
              id="phone"
              className="w-full p-3 border-2 border-black rounded-lg"
              value={form.phone}
              onChange={handleChange}
              disabled={saving}
            />
          </div>
          <div>
            <label className="block font-semibold mb-1" htmlFor="membershipType">Membership Type</label>
            <select
              name="membershipType"
              id="membershipType"
              className="w-full p-3 border-2 border-black rounded-lg"
              value={form.membershipType}
              onChange={handleChange}
              disabled={saving}
            >
              <option value="">-- Select --</option>
              {MEMBERSHIP_TYPES.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            <small className="text-gray-500">Optional</small>
          </div>
          <button
            type="submit"
            className={`w-full py-3 bg-blue-700 text-white rounded-lg font-bold text-lg ${saving ? 'opacity-60' : ''}`}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Add Member'}
          </button>
          {error && <div className="text-red-700 mt-2">{error}</div>}
        </form>
      </div>
    </main>
  );
}