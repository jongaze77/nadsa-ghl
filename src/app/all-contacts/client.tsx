'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import MembershipTypeFilterPanel, { type MembershipType } from '@/components/MembershipTypeFilterPanel';
import { FIELD_MAP } from '@/lib/ghl-api';
import FullContactEditForm from '@/components/FullContactEditForm';

// Utility functions
function fuzzyMatch(str: string, pattern: string): boolean {
  pattern = pattern.toLowerCase();
  str = str.toLowerCase();
  let patternIdx = 0;
  for (let i = 0; i < str.length && patternIdx < pattern.length; i++) {
    if (pattern[patternIdx] === str[i]) patternIdx++;
  }
  return patternIdx === pattern.length;
}

function truncate(value: any, max = 18) {
  if (typeof value !== "string") return value;
  return value.length > max ? value.slice(0, max) + "…" : value;
}

// Custom hook for membership type filter with localStorage persistence
function useLocalStorageMembershipTypeFilter() {
  const [selectedTypes, setSelectedTypes] = useState<MembershipType[]>(() => {
    if (typeof window === 'undefined') return [];
    const saved = localStorage.getItem('selectedMembershipTypes');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('selectedMembershipTypes', JSON.stringify(selectedTypes));
  }, [selectedTypes]);

  return [selectedTypes, setSelectedTypes] as const;
}

// Helper function to flatten custom fields
function flattenCustomFields(contact: any) {
  const flat: Record<string, any> = {};
  const cf = contact.customFields || contact.customField;

  if (!cf) return flat;

  if (typeof cf === 'string') {
    try {
      const parsed = JSON.parse(cf);
      if (Array.isArray(parsed)) {
        parsed.forEach((item: any) => {
          const key = FIELD_MAP[item.id];
          if (key) flat[key] = item.value;
        });
      } else {
        Object.entries(parsed).forEach(([id, value]) => {
          const key = FIELD_MAP[id];
          if (key) flat[key] = value;
        });
      }
    } catch (e) {
      console.error('Failed to parse custom fields:', e);
    }
    return flat;
  }

  if (Array.isArray(cf)) {
    cf.forEach((item: any) => {
      const key = FIELD_MAP[item.id];
      if (key) flat[key] = item.value;
    });
    return flat;
  }

  if (typeof cf === 'object') {
    Object.entries(cf).forEach(([id, value]) => {
      const key = FIELD_MAP[id];
      if (key) flat[key] = value;
    });
    return flat;
  }

  return flat;
}

type SortState = {
  column: string;
  direction: 'asc' | 'desc';
};

// Column definitions
const COLUMNS = [
  { key: 'lastName', label: 'Last Name' },
  { key: 'firstName', label: 'First Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'address1', label: 'Address' },
  { key: 'postalCode', label: 'Postcode' },
  { key: 'membershipType', label: 'Membership Type' },
  { key: 'renewal_date', label: 'Renewal Date' },
];

function getSortFn(column: string, direction: 'asc' | 'desc') {
  return (a: any, b: any) => {
    const aVal = a[column] || '';
    const bVal = b[column] || '';
    return direction === 'asc'
      ? aVal.localeCompare(bVal)
      : bVal.localeCompare(aVal);
  };
}

// EditContactModal component
function EditContactModal({ contact, onClose }: { contact: any; onClose: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (payload: any) => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/contacts/${contact.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error('Failed to update contact');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6">
      <FullContactEditForm
        contact={contact}
        saving={saving}
        error={error}
        onSave={handleSave}
        onCancel={onClose}
      />
    </div>
  );
}

export default function ContactsClient() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedContact, setSelectedContact] = useState<any | null>(null);
  const [sort, setSort] = useState<SortState>({ column: 'lastName', direction: 'asc' });
  const [selectedMembershipTypes, setSelectedMembershipTypes] = useLocalStorageMembershipTypeFilter();

  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated') {
      router.push('/login');
      return;
    }
    fetchContacts();
  }, [status, router]);

  async function fetchContacts() {
    setLoading(true);
    try {
      let page = 1, hasMore = true, all: any[] = [];
      while (hasMore && page <= 20) {
        const res = await fetch(`/api/contacts?page=${page}&limit=100`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        all = all.concat(data.contacts || []);
        hasMore = data.pagination && data.pagination.page < data.pagination.totalPages;
        page++;
      }
      setContacts(all);
    } catch (err) {
      setContacts([]);
    } finally {
      setLoading(false);
    }
  }

  // Compose filtered & sorted list
  const filteredContacts = useMemo(() => {
    let result = contacts.map(c => ({
      ...c,
      ...flattenCustomFields(c),
    }));

    // Membership filter
    if (selectedMembershipTypes.length > 0) {
      result = result.filter(c =>
        selectedMembershipTypes.some(
          t =>
            (c.membershipType || '').toLowerCase() === t.toLowerCase()
        )
      );
    }
    // Search filter
    if (search.trim()) {
      result = result.filter(
        c =>
          fuzzyMatch(c.firstName || '', search) ||
          fuzzyMatch(c.lastName || '', search) ||
          fuzzyMatch(c.email || '', search) ||
          fuzzyMatch(c.phone || '', search)
      );
    }
    // Sorting
    if (sort.column) {
      result = [...result].sort(getSortFn(sort.column, sort.direction));
    }
    return result;
  }, [contacts, search, selectedMembershipTypes, sort]);

  // Table scroll: always show scrollbar above fold
  const scrollContainerStyle: React.CSSProperties = {
    overflowX: 'auto',
    paddingBottom: 8,
    marginBottom: 0,
    WebkitOverflowScrolling: 'touch',
  };
  const tableStyle: React.CSSProperties = {
    minWidth: 1000,
  };

  function handleHeaderClick(column: string) {
    setSort(prev => {
      if (prev.column === column) {
        return { column, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { column, direction: 'asc' };
    });
  }

  function handleRowClick(contact: any, event: React.MouseEvent) {
    // CTRL/cmd-click opens edit in new tab
    if (event.ctrlKey || event.metaKey) {
      window.open(`/contacts/${contact.id}`, '_blank');
      return;
    }
    setSelectedContact(contact);
  }

  // For modal background
  function Modal({ children, onClose }: { children: React.ReactNode, onClose: () => void }) {
    // Prevent background scroll when modal is open
    useEffect(() => {
      const original = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = original;
      };
    }, []);
  
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
        <div
          className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto relative"
          onClick={e => e.stopPropagation()}
        >
          <button
            className="absolute top-2 right-2 text-2xl text-gray-400 hover:text-gray-600"
            onClick={onClose}
            aria-label="Close"
          >&times;</button>
          {children}
        </div>
      </div>
    );
  }

  if (status === 'loading') {
    return <div className="p-4">Loading session...</div>;
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 flex flex-col items-center">
      <div className="w-full max-w-6xl flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">All Contacts</h1>
        <div>DEBUG: I am here</div>
        <Link
          href="/contacts/new"
          className="px-4 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-400"
        >
          Add New Member
        </Link>
      </div>
      <div className="w-full max-w-6xl mb-4 flex flex-wrap gap-4 items-end justify-between">
        <div>
          <MembershipTypeFilterPanel
            selected={selectedMembershipTypes}
            onChange={setSelectedMembershipTypes}
          />
        </div>
        <input
          type="text"
          className="px-4 py-2 border rounded-lg"
          placeholder="Search by name, email, or phone"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>
      <div style={scrollContainerStyle} className="w-full max-w-6xl border-t border-b border-gray-300 bg-white shadow">
        {/* Always show horizontal scrollbar */}
        <div style={{ overflowX: 'scroll', minHeight: 10 }}>
          <table style={tableStyle} className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-100 sticky top-0 z-10">
              <tr>
                {COLUMNS.map(col => (
                  <th
                    key={col.key}
                    onClick={() => handleHeaderClick(col.key)}
                    className="px-4 py-2 text-left font-semibold cursor-pointer select-none whitespace-nowrap"
                  >
                    {col.label}
                    {sort.column === col.key ? (
                      <span className="ml-1">
                        {sort.direction === 'asc' ? '▲' : '▼'}
                      </span>
                    ) : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={COLUMNS.length} className="text-center py-8">
                    Loading...
                  </td>
                </tr>
              ) : filteredContacts.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length} className="text-center py-8 text-gray-600">
                    No contacts found.
                  </td>
                </tr>
              ) : (
                filteredContacts.map(contact => (
                  <tr
                    key={contact.id}
                    className="hover:bg-blue-50 cursor-pointer"
                    onClick={e => handleRowClick(contact, e)}
                    tabIndex={0}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleRowClick(contact, e as any);
                    }}
                  >
                    <td className="px-4 py-2 whitespace-nowrap" title={contact.lastName}>{truncate(contact.lastName)}</td>
                    <td className="px-4 py-2 whitespace-nowrap" title={contact.firstName}>{truncate(contact.firstName)}</td>
                    <td className="px-4 py-2 whitespace-nowrap" title={contact.email}>{truncate(contact.email)}</td>
                    <td className="px-4 py-2 whitespace-nowrap" title={contact.phone}>{truncate(contact.phone)}</td>
                    <td className="px-4 py-2 whitespace-nowrap" title={contact.address1}>{truncate(contact.address1)}</td>
                    <td className="px-4 py-2 whitespace-nowrap" title={contact.postalCode}>{truncate(contact.postalCode)}</td>
                    <td className="px-4 py-2 whitespace-nowrap" title={contact.membershipType}>{truncate(contact.membershipType)}</td>
                    <td className="px-4 py-2 whitespace-nowrap" title={contact.renewal_date}>{truncate(contact.renewal_date)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      {/* Modal for inline edit */}
      {selectedContact && (
        <Modal onClose={() => setSelectedContact(null)}>
          <EditContactModal contact={selectedContact} onClose={() => setSelectedContact(null)} />
        </Modal>
      )}
    </main>
  );
} 