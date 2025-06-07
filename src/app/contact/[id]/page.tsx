'use client'

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const MEMBERSHIP_TYPE_ID = "gH97LlNC9Y4PlkKVlY8V";

const standardFields = [
  { key: 'firstName', label: 'First Name', type: 'text' },
  { key: 'lastName', label: 'Last Name', type: 'text' },
  { key: 'address1', label: 'Address 1', type: 'text' },
  { key: 'city', label: 'City', type: 'text' },
  { key: 'postalCode', label: 'Postcode', type: 'text' },
  { key: 'phone', label: 'Telephone', type: 'text' },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'source', label: 'Contact Source', type: 'text' },
];

const customFields = [
  { key: 'membership_start_date', label: 'Membership Start Date', type: 'date' },
  { key: 'membership_type', label: 'Membership Type', type: 'select', options: ['Full', 'Associate', 'None', 'Newsletter Only', 'Ex Member'] },
  { key: 'single_or_double_membership', label: 'Single or Double Membership', type: 'select', options: ['Single', 'Double'] },
  { key: 'standing_order', label: 'Standing Order', type: 'radio', options: ['Yes', 'No'] },
  { key: 'renewal_date', label: 'Renewal Date', type: 'date' },
  { key: 'renewal_reminder', label: 'Renewal Reminder', type: 'select', options: ['No', 'Membership Secretary', 'Member', 'Both'] },
  { key: 'marketing_email_consent', label: 'Marketing and Email Consent', type: 'select', options: ['Yes', 'No'] },
  { key: 'gift_aid', label: 'Gift Aid', type: 'radio', options: ['Yes', 'No'] },
  { key: 'title', label: 'Title', type: 'text' },
  { key: 'address2', label: 'Address 2', type: 'text' },
  { key: 'address3', label: 'Address 3', type: 'text' },
];

const FIELD_MAP: Record<string, string> = {
  gH97LlNC9Y4PlkKVlY8V: 'membership_type',
  hJQPtsVDFBxI1USEN83v: 'single_or_double_membership',
  w52V1FONYrhH0LUqDjBs: 'membership_start_date',
  cWMPNiNAfReHOumOhBB2: 'renewal_date',
  ojKOz9HxslwVJaBMqcAF: 'renewal_reminder',
  vJKGn7dzbGmmLUfzp0KY: 'standing_order',
  ABzFclt09Z30eBalbPKH: 'gift_aid',
  YvpMtidXnXFqJnii5sqH: 'marketing_email_consent',
  xNIBnbcu4NJ008JLUWGF: 'title',
  PEyv7RkguJ3IwYQdQlkR: 'address2',
  dTKWIDeFBg9MI1MQ65vi: 'address3',
};

function flattenCustomFields(contact: any) {
  const flat: Record<string, any> = {};
  const cf = contact.customField;

  if (!cf) return flat;

  if (!Array.isArray(cf)) {
    Object.entries(cf).forEach(([id, value]) => {
      const key = FIELD_MAP[id];
      if (key) flat[key] = value;
    });
    return flat;
  }

  cf.forEach((item: any) => {
    const key = FIELD_MAP[item.id];
    if (key) flat[key] = item.value;
  });

  return flat;
}

const fieldOrder = [
  { key: 'firstName',  type: 'standard' },
  { key: 'lastName',   type: 'standard' },
  { key: 'title',      type: 'custom'   },
  { key: 'address1',   type: 'standard' },
  { key: 'address2',   type: 'custom'   },
  { key: 'address3',   type: 'custom'   },
  { key: 'city',       type: 'standard' },
  { key: 'postalCode', type: 'standard' },
  { key: 'phone',      type: 'standard' },
  { key: 'email',      type: 'standard' },
  { key: 'source',     type: 'standard' },
  { key: 'membership_start_date', type: 'custom' },
  { key: 'membership_type', type: 'custom' },
  { key: 'single_or_double_membership', type: 'custom' },
  { key: 'standing_order', type: 'custom' },
  { key: 'renewal_date', type: 'custom' },
  { key: 'renewal_reminder', type: 'custom' },
  { key: 'marketing_email_consent', type: 'custom' },
  { key: 'gift_aid', type: 'custom' },
  { key: 'notes', type: 'notes' },
];

function buildPayload(form: any) {
  const out: any = {};

  standardFields.forEach(f => {
    if (form[f.key] !== undefined && form[f.key] !== '') out[f.key] = form[f.key];
  });

  const cf: Record<string, any> = {};
  Object.entries(FIELD_MAP).forEach(([id, key]) => {
    if (form[key] !== undefined && form[key] !== '') cf[id] = form[key];
  });
  if (Object.keys(cf).length) out.customField = cf;

  return out;
}

export default function ContactPage({ params }: any) {
  const { data: session } = useSession();
  const router = useRouter();
  const [form, setForm] = useState<any>({});
  const [note, setNote] = useState('');
  const [notes, setNotes] = useState<Array<{ id: string; body: string; createdAt: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string|null>(null);
  const [saveOk, setSaveOk] = useState(false);

  useEffect(() => {
    if (!session) {
      router.push('/login');
      return;
    }
    loadContact();
  }, [session, router, params.id]);

  async function loadContact() {
    setLoading(true);
    setError(null);
    try {
      const [contactRes, notesRes] = await Promise.all([
        fetch(`/api/contact/${params.id}`),
        fetch(`/api/contact/${params.id}/notes`)
      ]);

      if (!contactRes.ok) throw new Error('Failed to fetch contact');
      if (!notesRes.ok) throw new Error('Failed to fetch notes');

      const contact = await contactRes.json();
      const notesData = await notesRes.json();

      setForm({ ...contact, ...flattenCustomFields(contact) });
      setNotes(notesData?.notes || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load contact');
    } finally {
      setLoading(false);
    }
  }

  const handleUpdate = async () => {
    if (!params.id) return;

    setSaving(true);
    setSaveError(null);
    setSaveOk(false);

    try {
      const res = await fetch(`/api/contacts/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(form)),
      });

      if (!res.ok) {
        throw new Error('Failed to update contact');
      }

      setSaveOk(true);
    } catch (error) {
      console.error('Error updating contact:', error);
      setSaveError('Failed to update contact');
    } finally {
      setSaving(false);
    }
  };

  if (!session) return null;
  if (loading) return <div className="p-4">Loading...</div>;
  if (error) return <div className="p-4 text-red-500">{error}</div>;

  return (
    <main className="bg-white min-h-screen p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold" style={{ letterSpacing: 2 }}>Contact Details</h1>
          <Link 
            href="/all-contacts"
            className="px-4 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-400"
          >
            Back to Contacts
          </Link>
        </div>

        <form className="bg-gray-100 p-6 rounded-lg border-2 border-black mb-8" style={{ fontSize: '1.25rem' }}>
          {fieldOrder.map(field => {
            if (field.type === 'standard') {
              const f = standardFields.find(sf => sf.key === field.key);
              if (!f) return null;
              return (
                <div className="mb-4" key={f.key}>
                  <label className="block font-semibold mb-1" htmlFor={f.key}>{f.label}</label>
                  <input
                    id={f.key}
                    type={f.type}
                    className="w-full p-3 border-2 border-black rounded-lg focus:outline-none focus:ring-4 focus:ring-blue-400"
                    value={form[f.key] || ''}
                    onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                    aria-label={f.label}
                    disabled={loading}
                  />
                </div>
              );
            }
            if (field.type === 'custom') {
              const f = customFields.find(cf => cf.key === field.key);
              if (!f) return null;
              return (
                <div className="mb-4" key={f.key}>
                  <label className="block font-semibold mb-1" htmlFor={f.key}>{f.label}</label>
                  {f.type === 'text' || f.type === 'date' ? (
                    <input
                      id={f.key}
                      type={f.type}
                      className="w-full p-3 border-2 border-black rounded-lg focus:outline-none focus:ring-4 focus:ring-blue-400"
                      value={form[f.key] || ''}
                      onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                      aria-label={f.label}
                      disabled={loading}
                    />
                  ) : f.type === 'select' ? (
                    <select
                      id={f.key}
                      className="w-full p-3 border-2 border-black rounded-lg focus:outline-none focus:ring-4 focus:ring-blue-400"
                      value={form[f.key] || ''}
                      onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                      aria-label={f.label}
                      disabled={loading}
                    >
                      <option value="">-- Select --</option>
                      {f.options?.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : f.type === 'radio' ? (
                    <div className="flex gap-6">
                      {f.options?.map(opt => (
                        <label key={opt} className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={f.key}
                            value={opt}
                            checked={form[f.key] === opt}
                            onChange={() => setForm({ ...form, [f.key]: opt })}
                            aria-label={opt}
                            disabled={loading}
                          />
                          {opt}
                        </label>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            }
            if (field.type === 'notes') {
              return (
                <div className="mb-6" key="notes">
                  <label className="block font-semibold mb-1" htmlFor="note">Add New Note</label>
                  <textarea
                    id="note"
                    className="w-full p-3 border-2 border-black rounded-lg focus:outline-none focus:ring-4 focus:ring-blue-400 text-xl mb-4"
                    rows={4}
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    aria-label="New note"
                    disabled={loading}
                    placeholder="Type your new note here..."
                  />
                  
                  <div className="mt-6">
                    <h3 className="text-xl font-semibold mb-2">Previous Notes</h3>
                    <div className="max-h-96 overflow-y-auto border-2 border-black rounded-lg p-4">
                      {notes.length === 0 ? (
                        <p className="text-gray-600 italic">No previous notes</p>
                      ) : (
                        <div className="space-y-4">
                          {notes.map((note) => (
                            <div key={note.id} className="border-b border-gray-300 pb-4 last:border-0">
                              <p className="whitespace-pre-wrap">{note.body}</p>
                              <p className="text-sm text-gray-600 mt-1">
                                {new Date(note.createdAt).toLocaleString()}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            }
            return null;
          })}
          <button
            type="button"
            onClick={handleUpdate}
            className={`w-full py-4 rounded-lg text-2xl font-bold focus:outline-none
                        focus:ring-4 focus:ring-blue-400
                        ${loading || saving
                           ? 'bg-gray-400 cursor-not-allowed'
                           : 'bg-blue-700 text-white hover:bg-blue-800'}`}
            disabled={loading || saving}
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          {saveError && <div className="text-red-700 mt-2">{saveError}</div>}
          {saveOk     && <div className="text-green-700 mt-2">Saved!</div>}
        </form>
      </div>
    </main>
  );
} 