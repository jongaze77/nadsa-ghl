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

// Column definitions with fixed widths
const COLUMNS = [
  { key: 'lastName', label: 'Last Name', width: 'w-24' },
  { key: 'firstName', label: 'First Name', width: 'w-24' },
  { key: 'email', label: 'Email', width: 'w-48' },
  { key: 'phone', label: 'Phone', width: 'w-28' },
  { key: 'address1', label: 'Address', width: 'w-44' },
  { key: 'postalCode', label: 'Postcode', width: 'w-20' },
  { key: 'membershipType', label: 'Type', width: 'w-24' },
  { key: 'renewal_date', label: 'Renewal Date', width: 'w-28' },
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

function getMembershipTypeDisplay(membershipType: string | null | undefined) {
  if (!membershipType) return null;
  
  const type = membershipType.toLowerCase().trim();
  
  switch (type) {
    case 'full':
      return {
        abbreviation: 'F',
        label: 'Full',
        className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
      };
    case 'associate':
      return {
        abbreviation: 'A', 
        label: 'Associate',
        className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
      };
    case 'none':
      return {
        abbreviation: 'N',
        label: 'None', 
        className: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
      };
    case 'newsletter only':
      return {
        abbreviation: 'NL',
        label: 'Newsletter Only',
        className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
      };
    case 'ex member':
      return {
        abbreviation: 'EX',
        label: 'Ex Member',
        className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
      };
    default:
      return {
        abbreviation: type.substring(0, 2).toUpperCase(),
        label: membershipType,
        className: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300'
      };
  }
}

// EditContactModal component
function EditContactModal({
  contact,
  onClose,
  onSaved,
}: {
  contact: any;
  onClose: () => void;
  onSaved: (updatedContact: any) => void;
}) {
  const [fullContact, setFullContact] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch latest data from API (which syncs with GHL) when modal opens
  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/contacts/${contact.id}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch latest contact');
        return res.json();
      })
      .then(data => setFullContact(data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [contact.id]);

  const handleSave = async (payload: any) => {
    console.log('🔵 [CLIENT] handleSave called with payload:', payload);
    console.log('🔵 [CLIENT] Contact ID:', contact.id);
    console.log('🔵 [CLIENT] Current saving state:', saving);
    
    setSaving(true);
    setError(null);
    
    try {
      console.log('🔵 [CLIENT] Making PUT request to:', `/api/contacts/${contact.id}`);
      const response = await fetch(`/api/contacts/${contact.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      console.log('🔵 [CLIENT] API response status:', response.status, 'ok:', response.ok);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [CLIENT] API error response:', errorText);
        throw new Error(`Failed to update contact: ${response.status}`);
      }
      
      const updated = await response.json();
      console.log('✅ [CLIENT] Contact updated successfully:', updated);
      
      console.log('🔵 [CLIENT] Calling onSaved with updated contact');
      onSaved(updated);
      
      console.log('🔵 [CLIENT] Closing modal');
      onClose();
      
    } catch (err) {
      console.error('❌ [CLIENT] Error in handleSave:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      console.log('🔵 [CLIENT] Setting saving to false');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400">Loading latest contact data...</p>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-red-400 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-300">Error loading contact</h3>
              <p className="mt-1 text-sm text-red-700 dark:text-red-400">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <FullContactEditForm
      contact={fullContact}
      saving={saving}
      error={error}
      onSave={handleSave}
      onCancel={onClose}
    />
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
      <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/50 backdrop-blur-sm p-2 sm:p-4" onClick={onClose}>
        <div
          className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-5xl h-full sm:h-auto sm:max-h-[95vh] overflow-hidden relative border border-gray-200 dark:border-gray-700 flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-4 flex items-center justify-between rounded-t-xl flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  Edit Contact
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Update contact information and membership details
                </p>
              </div>
            </div>
            <button
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              onClick={onClose}
              aria-label="Close modal"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Modal Content */}
          <div className="flex-1 overflow-hidden">
            {children}
          </div>
        </div>
      </div>
    );
  }

  // Add this handler:
  const handleContactSaved = (updatedContact: any) => {
    setContacts(prev =>
      prev.map(c => c.id === updatedContact.id ? { ...c, ...updatedContact } : c)
    );
  };

  if (status === 'loading') {
    return <div className="p-4">Loading session...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">All Contacts</h1>
              <p className="mt-2 text-gray-600 dark:text-gray-400">
                Manage and view all contact information
              </p>
            </div>
            
            <Link
              href="/contacts/new"
              className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <span className="mr-2">+</span>
              Add New Contact
            </Link>
          </div>
        </div>

        {/* Filters and Search Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div className="flex-1">
              <MembershipTypeFilterPanel
                selected={selectedMembershipTypes}
                onChange={setSelectedMembershipTypes}
              />
            </div>
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  className="w-full sm:w-80 pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="Search by name, email, or phone..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
                {search && (
                  <button
                    type="button"
                    aria-label="Clear search"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    onClick={() => setSearch('')}
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              
              {/* Results count */}
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {filteredContacts.length} contact{filteredContacts.length !== 1 ? 's' : ''}
                {selectedMembershipTypes.length > 0 || search.trim() ? ' (filtered)' : ''}
              </div>
            </div>
          </div>
        </div>

        {/* Table Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 table-fixed" style={{minWidth: '1200px'}}>
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  {COLUMNS.map(col => (
                    <th
                      key={col.key}
                      onClick={() => handleHeaderClick(col.key)}
                      className={`px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors select-none ${col.width}`}
                    >
                      <div className="flex items-center space-x-1">
                        <span>{col.label}</span>
                        {sort.column === col.key ? (
                          <svg className={`w-4 h-4 transform ${sort.direction === 'desc' ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4 text-gray-300 dark:text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {loading ? (
                  <tr>
                    <td colSpan={COLUMNS.length} className="px-3 py-12 text-center">
                      <div className="flex flex-col items-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
                        <p className="text-gray-500 dark:text-gray-400">Loading contacts...</p>
                      </div>
                    </td>
                  </tr>
                ) : filteredContacts.length === 0 ? (
                  <tr>
                    <td colSpan={COLUMNS.length} className="px-3 py-12 text-center">
                      <div className="flex flex-col items-center">
                        <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                          No contacts found
                        </h3>
                        <p className="text-gray-500 dark:text-gray-400 mb-6">
                          {search.trim() || selectedMembershipTypes.length > 0 
                            ? 'Try adjusting your filters or search terms.'
                            : 'Get started by adding your first contact.'
                          }
                        </p>
                        {(!search.trim() && selectedMembershipTypes.length === 0) && (
                          <Link
                            href="/contacts/new"
                            className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                          >
                            <span className="mr-2">+</span>
                            Add First Contact
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredContacts.map((contact, index) => (
                    <tr
                      key={contact.id}
                      className={`hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors ${
                        index % 2 === 0 ? '' : 'bg-gray-50/25 dark:bg-gray-700/25'
                      }`}
                      onClick={e => handleRowClick(contact, e)}
                      tabIndex={0}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleRowClick(contact, e as any);
                      }}
                    >
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 font-medium w-24" title={contact.lastName}>
                        {truncate(contact.lastName)}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 w-24" title={contact.firstName}>
                        {truncate(contact.firstName)}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 w-48" title={contact.email}>
                        {contact.email ? (
                          <a 
                            href={`mailto:${contact.email}`} 
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                            onClick={e => e.stopPropagation()}
                          >
                            {truncate(contact.email)}
                          </a>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 w-28" title={contact.phone}>
                        {contact.phone ? (
                          <a 
                            href={`tel:${contact.phone}`} 
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                            onClick={e => e.stopPropagation()}
                          >
                            {truncate(contact.phone)}
                          </a>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 w-44" title={contact.address1}>
                        {truncate(contact.address1) || <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 w-20" title={contact.postalCode}>
                        {truncate(contact.postalCode) || <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm w-24" title={contact.membershipType}>
                        {(() => {
                          const membershipDisplay = getMembershipTypeDisplay(contact.membershipType);
                          return membershipDisplay ? (
                            <span className={`inline-flex items-center justify-center w-8 h-6 rounded text-xs font-bold ${membershipDisplay.className}`} title={membershipDisplay.label}>
                              {membershipDisplay.abbreviation}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          );
                        })()}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 w-28" title={contact.renewal_date}>
                        {contact.renewal_date ? truncate(contact.renewal_date) : <span className="text-gray-400">—</span>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>
            Tip: Click on a contact to edit, or Ctrl/Cmd+click to open in a new tab
          </p>
        </div>
      </div>

      {/* Modal for inline edit */}
      {selectedContact && (
        <Modal onClose={() => setSelectedContact(null)}>
          <EditContactModal
            contact={selectedContact}
            onClose={() => setSelectedContact(null)}
            onSaved={handleContactSaved}
          />
        </Modal>
      )}
    </div>
  );
} 