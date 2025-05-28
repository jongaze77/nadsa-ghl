'use client'

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

const MEMBERSHIP_TYPE_ID = "gH97LlNC9Y4PlkKVlY8V"; // Custom field ID for Membership Type

const standardFields = [
  { key: 'firstName', label: 'First Name', type: 'text' },
  { key: 'lastName', label: 'Last Name', type: 'text' },
  { key: 'address1', label: 'Address 1', type: 'text' },
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

// map GHL field-id  -> your form key
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
  // ... add the rest as needed ...
};

function flattenCustomFields(contact: any) {
  const flat: Record<string, any> = {};
  const cf = contact.customField;

  if (!cf) return flat;

  /* 1. object { id: value } */
  if (!Array.isArray(cf)) {
    Object.entries(cf).forEach(([id, value]) => {
      const key = FIELD_MAP[id];
      if (key) flat[key] = value;
    });
    return flat;
  }

  /* 2. array [{ id, value }] */
  cf.forEach((item: any) => {
    const key = FIELD_MAP[item.id];
    if (key) flat[key] = item.value;
  });

  return flat;
}

function fuzzyMatch(str: string, query: string) {
  return str.toLowerCase().includes(query.toLowerCase());
}

function sortContacts(a: any, b: any) {
  // use lastName → firstName; fall back to contactName; finally to email
  return  (a.lastName  || '').localeCompare(b.lastName  || '', 'en', {sensitivity:'base'}) ||
          (a.firstName || '').localeCompare(b.firstName || '', 'en', {sensitivity:'base'}) ||
          (a.contactName||'').localeCompare(b.contactName||'', 'en', {sensitivity:'base'}) ||
          (a.email      || '').localeCompare(b.email      || '', 'en', {sensitivity:'base'});
}

async function fetchAllContactsFromAPI(query = ''): Promise<any[]> {
  let allContacts: any[] = [];
  let page = 1;
  let hasMore = true;
  const limit = 100;
  const seenIds = new Set();

  while (hasMore && page <= 20) {
    const res = await fetch(`/api/contacts?search=${encodeURIComponent(query)}&page=${page}&limit=${limit}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    const contacts = data.contacts || [];
    console.log(`Fetched page ${page}, got ${contacts.length} contacts`);
    // Filter out duplicates
    const newContacts = contacts.filter((c: any) => !seenIds.has(c.id));
    newContacts.forEach((c: any) => seenIds.add(c.id));
    allContacts = allContacts.concat(newContacts);
    hasMore = data.pagination?.hasMore && newContacts.length > 0;
    page++;
  }
  console.log(`Total contacts fetched: ${allContacts.length}`);
  return allContacts;
}

const fieldOrder = [
  { key: 'firstName', type: 'standard' },
  { key: 'lastName', type: 'standard' },
  { key: 'title', type: 'custom' },
  { key: 'address1', type: 'standard' },
  { key: 'address2', type: 'custom' },
  { key: 'address3', type: 'custom' },
  { key: 'postalCode', type: 'standard' },
  { key: 'phone', type: 'standard' },
  { key: 'email', type: 'standard' },
  { key: 'source', type: 'standard' },
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

// Tell Next.js this page is always dynamic
export const dynamic = 'force-dynamic';

export default function Home() {
  const { data: session } = useSession();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [showMembersOnly, setShowMembersOnly] = useState(false);
  const [allContacts, setAllContacts] = useState<any[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<any[]>([]);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [contactsError, setContactsError] = useState<string | null>(null);
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [form, setForm] = useState<any>({});
  const [note, setNote] = useState('');
  const [notes, setNotes] = useState<Array<{ id: string; body: string; createdAt: string }>>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string|null>(null);
  const [saveOk, setSaveOk] = useState(false);

  useEffect(() => {
    if (!session) {
      router.push('/login');
      return;
    }
    async function fetchAllContacts() {
      setContactsLoading(true);
      setContactsError(null);
      try {
        /* 1. just fetch the paginated list */
        const contacts = await fetchAllContactsFromAPI();

        /* 2. keep in state ONLY what the list needs (id, names, email) */
        const trimmed = contacts.map((c: any) => {
          // Log the full contact object to see its structure
          console.log('Full contact object:', JSON.stringify(c, null, 2));
          
          // Try different ways to access the membership type
          let membershipType = c.membershipType; // First try direct field
          
          // If not found, try custom fields
          if (!membershipType && c.customFields) {
            if (typeof c.customFields === 'object' && !Array.isArray(c.customFields)) {
              membershipType = c.customFields[MEMBERSHIP_TYPE_ID];
            } else if (Array.isArray(c.customFields)) {
              const membershipField = c.customFields.find((cf: any) => cf.id === MEMBERSHIP_TYPE_ID);
              if (membershipField) {
                membershipType = membershipField.value;
              }
            }
          }
          
          console.log('Contact:', c.firstName, c.lastName, 'Membership Type:', membershipType);
          
          return {
            id: c.id,
            firstName: c.firstName,
            lastName: c.lastName,
            email: c.email,
            contactName: c.name,
            membershipType: membershipType
          };
        });

        /* 3. sort Surname → First name once */
        trimmed.sort(sortContacts);

        setAllContacts(trimmed);
      } catch (err: any) {
        setContactsError(err.message || 'Failed to load contacts');
      } finally {
        setContactsLoading(false);
      }
    }
    fetchAllContacts();
  }, [session, router]);

  // Client-side fuzzy search and filter
  useEffect(() => {
    let filtered = allContacts;

    // Apply member filter first
    if (showMembersOnly) {
      console.log('Filtering members. Total contacts:', allContacts.length);
      filtered = filtered.filter(c => {
        const membershipType = c.membershipType;
        const isMember = membershipType && ['Full', 'Associate', 'Newsletter Only', 'Ex Member'].includes(membershipType);
        console.log('Contact:', c.firstName, c.lastName, 'Membership Type:', membershipType, 'Is Member:', isMember);
        return isMember;
      });
      console.log('After member filter:', filtered.length, 'contacts');
    }

    // Then apply search filter
    if (search.trim()) {
      filtered = filtered.filter(c =>
        fuzzyMatch(c.firstName || '', search) ||
        fuzzyMatch(c.lastName || '', search) ||
        fuzzyMatch(c.contactName || '', search) ||
        fuzzyMatch(c.email || '', search)
      );
    }

    setFilteredContacts(filtered);
  }, [search, allContacts, showMembersOnly]);

  // Fetch contact details and note when selectedContact changes
  useEffect(() => {
    if (!selectedContact) {
      setForm({});
      setNote('');
      setNotes([]);
      setSaveOk(false);
      setSaveError(null);
      return;
    }
    setDetailsLoading(true);
    setDetailsError(null);
    setSaveOk(false);      // reset Saved! message
    setSaveError(null);    // reset error message
    Promise.all([
      fetch(`/api/contact/${selectedContact.id}`).then(async r => {
        if (!r.ok) throw new Error((await r.json()).error ?? 'Failed to fetch contact');
        return r.json();
      }),
      fetch(`/api/contact/${selectedContact.id}/notes`).then(async r => {
        if (!r.ok) throw new Error((await r.json()).error ?? 'Failed to fetch notes');
        return r.json();
      }),
    ])
      .then(([contact, notesData]) => {
        if (contact.error) throw new Error(contact.error);
        // Merge custom fields into form state
        setForm({ ...contact, ...flattenCustomFields(contact) });
        setNotes(notesData?.notes || []);
      })
      .catch(err => setDetailsError(err.message))
      .finally(() => setDetailsLoading(false));
  }, [selectedContact]);

  function buildPayload(form: any) {
    const out: any = {};

    // 1. standard fields
    standardFields.forEach(f => {
      if (form[f.key] !== undefined && form[f.key] !== '') out[f.key] = form[f.key];
    });

    // 2. custom fields as object { id: value }
    const cf: Record<string, any> = {};
    Object.entries(FIELD_MAP).forEach(([id, key]) => {
      if (form[key] !== undefined && form[key] !== '') cf[id] = form[key];
    });
    if (Object.keys(cf).length) out.customField = cf;

    return out;
  }

  async function safeJson(res: Response) {
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }
  
  async function handleUpdate() {
    if (!selectedContact) return;
  
    setSaving(true); setSaveError(null); setSaveOk(false);
  
    try {
      /* 1 – contact */
      const payload = buildPayload(form);
      const res = await fetch(`/api/contact/${selectedContact.id}`, {
        method : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify(payload),
      });
  
      if (!res.ok) {
        const errBody = await safeJson(res);
        throw new Error(errBody?.error || `HTTP ${res.status}`);
      }
  
      /* 2 – note (only if there's a new note) */
      if (note.trim()) {
        const noteRes = await fetch(`/api/contact/${selectedContact.id}/note`, {
          method : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body   : JSON.stringify({ body: note }),
        });
        
        if (!noteRes.ok) {
          const errBody = await safeJson(noteRes);
          throw new Error(errBody?.error || `HTTP ${noteRes.status}`);
        }

        // Refresh notes after adding new one
        const notesRes = await fetch(`/api/contact/${selectedContact.id}/notes`);
        if (notesRes.ok) {
          const notesData = await notesRes.json();
          setNotes(notesData.notes || []);
        }
        setNote(''); // Clear the note input
      }
  
      setSaveOk(true);
    } catch (err: any) {
      setSaveError(err.message || 'Unknown error');
    } finally {
      setSaving(false);
    }
  }
  
  if (!session) return null;
  if (contactsLoading) return <div className="p-4">Loading...</div>;
  if (contactsError) return <div className="p-4 text-red-500">{contactsError}</div>;

  return (
    <main className="bg-white min-h-screen p-6 flex flex-col items-center text-black">
      <div className="w-full max-w-2xl mb-4">
        <h1 className="text-4xl font-bold" style={{ letterSpacing: 2 }}>GHL Client Manager</h1>
      </div>
      <div className="w-full max-w-2xl mb-8">
        <div className="flex justify-between items-center mb-4">
          <label htmlFor="search" className="block text-lg font-semibold">Search Contacts</label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showMembersOnly}
              onChange={e => setShowMembersOnly(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-lg font-semibold">Show Members Only</span>
          </label>
        </div>
        <input
          id="search"
          type="text"
          className="w-full p-3 border-2 border-black rounded-lg text-xl mb-4 focus:outline-none focus:ring-4 focus:ring-blue-400"
          placeholder="Type a name or email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          aria-label="Search contacts"
          disabled={contactsLoading}
        />
        {contactsLoading && <div className="text-lg text-blue-700 mb-2">Loading all contacts and membership info...</div>}
        {contactsError && <div className="text-lg text-red-700 mb-2">{contactsError}</div>}
        <div className="mb-6">
          <label className="block text-lg font-semibold mb-2">Select Contact</label>
          <select
            className="w-full p-3 border-2 border-black rounded-lg text-xl focus:outline-none focus:ring-4 focus:ring-blue-400"
            value={selectedContact?.id || ''}
            onChange={e => {
              const contact = filteredContacts.find(c => c.id === e.target.value);
              setSelectedContact(contact);
            }}
            aria-label="Select contact"
            disabled={contactsLoading}
          >
            <option value="">-- Select --</option>
            {filteredContacts.map(c => (
              <option key={c.id} value={c.id}>
                {`${c.lastName ?? ''}, ${c.firstName ?? ''}`.replace(/^, |, $/g, '') || c.contactName}
                {c.email ? ` (${c.email})` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>
      {selectedContact && (
        <form className="w-full max-w-2xl bg-gray-100 p-6 rounded-lg border-2 border-black mb-8" style={{ fontSize: '1.25rem' }}>
          <h2 className="text-2xl font-bold mb-4">Edit Contact Details</h2>
          {detailsLoading && <div className="text-lg text-blue-700 mb-2">Loading details...</div>}
          {detailsError && <div className="text-lg text-red-700 mb-2">{detailsError}</div>}
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
                    disabled={detailsLoading}
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
                      disabled={detailsLoading}
                    />
                  ) : f.type === 'select' ? (
                    <select
                      id={f.key}
                      className="w-full p-3 border-2 border-black rounded-lg focus:outline-none focus:ring-4 focus:ring-blue-400"
                      value={form[f.key] || ''}
                      onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                      aria-label={f.label}
                      disabled={detailsLoading}
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
                            disabled={detailsLoading}
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
                    disabled={detailsLoading}
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
                        ${detailsLoading || saving
                           ? 'bg-gray-400 cursor-not-allowed'
                           : 'bg-blue-700 text-white hover:bg-blue-800'}`}
            disabled={detailsLoading || saving}
          >
            {saving ? 'Saving…' : 'Update Contact'}
          </button>
          {saveError && <div className="text-red-700 mt-2">{saveError}</div>}
          {saveOk     && <div className="text-green-700 mt-2">Saved!</div>}
        </form>
      )}
    </main>
  );
}
