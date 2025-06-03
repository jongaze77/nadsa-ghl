'use client'

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  fuzzyMatch,
  sortContacts
} from '@/lib/contact-filter';
import MembershipTypeFilterPanel from "@/components/MembershipTypeFilterPanel";
import { useLocalStorageMembershipTypeFilter } from "@/lib/useLocalStorageMembershipTypeFilter";
import FullContactEditForm from '@/components/FullContactEditForm';

const MEMBERSHIP_TYPE_ID = "gH97LlNC9Y4PlkKVlY8V";

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

async function fetchAllContactsFromAPI(query = ''): Promise<any[]> {
  let allContacts: any[] = [];
  let page = 1;
  let hasMore = true;
  const limit = 100;
  const seenIds = new Set();

  while (page <= 20) {
    const res = await fetch(`/api/contacts?search=${encodeURIComponent(query)}&page=${page}&limit=${limit}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    const contacts = data.contacts || [];
    // Filter out duplicates
    const newContacts = contacts.filter((c: any) => !seenIds.has(c.id));
    newContacts.forEach((c: any) => seenIds.add(c.id));
    allContacts = allContacts.concat(newContacts);
    const { page: currentPage, totalPages } = data.pagination;
    hasMore = currentPage < totalPages;
    if (!hasMore) break;
    page++;
  }
  return allContacts;
}

export const dynamic = 'force-dynamic';

export default function Home() {
  const { data: session } = useSession();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [selectedMembershipTypes, setSelectedMembershipTypes] = useLocalStorageMembershipTypeFilter();
  const [allContacts, setAllContacts] = useState<any[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<any[]>([]);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [contactsError, setContactsError] = useState<string | null>(null);

  // Dropdown selection (trimmed contact object)
  const [selectedContact, setSelectedContact] = useState<any>(null);
  // Full contact record for the form
  const [fullContact, setFullContact] = useState<any | null>(null);

  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);

  // Fetch all contacts for dropdown/search
  useEffect(() => {
    if (!session) {
      router.push('/login');
      return;
    }
    async function fetchAllContacts() {
      setContactsLoading(true);
      setContactsError(null);
      try {
        const contacts = await fetchAllContactsFromAPI();
        // Only keep minimal info for the dropdown/search/filter
        const trimmed = contacts.map((c: any) => ({
          id: c.id,
          firstName: c.firstName,
          lastName: c.lastName,
          email: c.email,
          contactName: c.name,
          membershipType: c.membershipType
        }));
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

  // Filter contacts for dropdown/search
  useEffect(() => {
    let filtered = allContacts;
    if (selectedMembershipTypes.length > 0) {
      filtered = filtered.filter((c) => {
        const mt = (c.membershipType || "").trim().toLowerCase();
        return selectedMembershipTypes.some(sel =>
          mt === sel.toLowerCase()
        );
      });
    }
    if (search.trim()) {
      filtered = filtered.filter(c =>
        fuzzyMatch(c.firstName || '', search) ||
        fuzzyMatch(c.lastName || '', search) ||
        fuzzyMatch(c.contactName || '', search) ||
        fuzzyMatch(c.email || '', search)
      );
    }
    setFilteredContacts(filtered);
  }, [search, allContacts, selectedMembershipTypes]);

  // Fetch full contact record when selection changes
  useEffect(() => {
    if (!selectedContact) {
      setFullContact(null);
      setSaveOk(false);
      setSaveError(null);
      setDetailsError(null);
      return;
    }
    setDetailsLoading(true);
    setDetailsError(null);
    setSaveOk(false);
    setSaveError(null);
    fetch(`/api/contact/${selectedContact.id}`)
      .then(async r => {
        if (!r.ok) throw new Error((await r.json()).error ?? 'Failed to fetch contact');
        return r.json();
      })
      .then((contact) => {
        setFullContact(contact);
      })
      .catch(err => setDetailsError(err.message))
      .finally(() => setDetailsLoading(false));
  }, [selectedContact]);

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
          <MembershipTypeFilterPanel
            selected={selectedMembershipTypes}
            onChange={setSelectedMembershipTypes}
          />
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
              setSelectedContact(contact || null);
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
      {selectedContact && fullContact && (
        <FullContactEditForm
          contact={fullContact}
          saving={detailsLoading || saving}
          error={saveError}
          onSave={async (payload) => {
            setSaving(true);
            setSaveError(null);
            try {
              const res = await fetch(`/api/contacts/${selectedContact.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
              });
              if (!res.ok) throw new Error('Failed to update contact');
              const updatedContact = await res.json();

              // Update allContacts with the updated record (for dropdown/filter)
              setAllContacts((prev) =>
                prev.map((c) => (c.id === updatedContact.id ? {
                  ...c,
                  // Only update the fields we keep in the list
                  firstName: updatedContact.firstName,
                  lastName: updatedContact.lastName,
                  email: updatedContact.email,
                  contactName: updatedContact.name,
                  membershipType: updatedContact.membershipType
                } : c))
              );
              // Update local fullContact for the form
              setFullContact(updatedContact);

              setSaveOk(true);
            } catch (error) {
              setSaveError('Failed to update contact');
            } finally {
              setSaving(false);
            }
          }}
        />
      )}
    </main>
  );
}