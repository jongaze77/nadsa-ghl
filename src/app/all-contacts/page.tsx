'use client';

import React, { useEffect, useState, useMemo } from 'react';
import MembershipTypeFilterPanel, { MembershipType } from '@/components/MembershipTypeFilterPanel';
import { useLocalStorageMembershipTypeFilter } from '@/lib/useLocalStorageMembershipTypeFilter';
import { fuzzyMatch } from '@/lib/contact-filter';
import EditContactClient from '../contacts/[id]/EditContactClient';
import { Contact } from '@prisma/client';
import ContactEditForm from "@/components/ContactEditForm";


// Column definitions
const COLUMNS = [
  { key: 'lastName', label: 'Last Name' },
  { key: 'firstName', label: 'First Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'address1', label: 'Address Line 1' },
  { key: 'postalCode', label: 'Postcode' },
  { key: 'membershipType', label: 'Membership Type' },
  { key: 'renewal_date', label: 'Renewal Date' },
];

type SortState = {
  column: string;
  direction: 'asc' | 'desc';
};

function getSortFn(column: string, direction: 'asc' | 'desc') {
  return (a: any, b: any) => {
    const av = (a[column] || '').toLowerCase();
    const bv = (b[column] || '').toLowerCase();
    if (av === bv) return 0;
    if (av > bv) return direction === 'asc' ? 1 : -1;
    return direction === 'asc' ? -1 : 1;
  };
}

function flattenCustomFields(contact: any) {
  // Extract renewal_date from customFields { id: value } or [{id, value}]
  let renewal_date = '';
  if (contact.customFields && typeof contact.customFields === 'object') {
    if (Array.isArray(contact.customFields)) {
      const match = contact.customFields.find(
        (f: any) => f.id === 'cWMPNiNAfReHOumOhBB2'
      );
      if (match) renewal_date = match.value || '';
    } else if ('cWMPNiNAfReHOumOhBB2' in contact.customFields) {
      renewal_date = contact.customFields['cWMPNiNAfReHOumOhBB2'] || '';
    }
  }
  return { renewal_date };
}

export default function AllContactsPage() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedContact, setSelectedContact] = useState<any | null>(null);
  const [sort, setSort] = useState<SortState>({ column: 'lastName', direction: 'asc' });
  const [selectedMembershipTypes, setSelectedMembershipTypes] = useLocalStorageMembershipTypeFilter();

  // Fetch all contacts
  useEffect(() => {
    async function fetchAll() {
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
    fetchAll();
  }, []);

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
  // See: https://stackoverflow.com/a/68425620/4056252
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

  return (
    <main className="min-h-screen bg-gray-50 p-4 flex flex-col items-center">
      <h1 className="text-3xl font-bold mb-6">All Contacts</h1>
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
                    <td className="px-4 py-2 whitespace-nowrap">{contact.lastName}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{contact.firstName}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{contact.email}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{contact.phone}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{contact.address1}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{contact.postalCode}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{contact.membershipType}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{contact.renewal_date}</td>
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

// Modal content for edit form
function EditContactModal({
  contact,
  onClose,
}: {
  contact: any;
  onClose: () => void;
}) {
  const [formData, setFormData] = useState({
    firstName: contact.firstName || '',
    lastName: contact.lastName || '',
    email: contact.email || '',
    phone: contact.phone || '',
    membershipType: contact.membershipType || '',
    companyName: contact.companyName || '',
    address1: contact.address1 || '',
    address2: contact.address2 || '',
    city: contact.city || '',
    state: contact.state || '',
    postalCode: contact.postalCode || '',
    country: contact.country || '',
    website: contact.website || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/contacts/${contact.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
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
    <div>
      <h2 className="text-xl font-bold mb-2">Edit Contact</h2>
      <ContactEditForm
        form={formData}
        setForm={setFormData}
        saving={saving}
        error={error}
        onSave={handleSave}
        onCancel={onClose}
      />
    </div>
  );
}