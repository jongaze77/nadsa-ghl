// src/app/contacts/page.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import MembershipTypeFilterPanel, { MembershipType } from "@/components/MembershipTypeFilterPanel";
import { useLocalStorageMembershipTypeFilter } from "@/lib/useLocalStorageMembershipTypeFilter";

function fuzzyMatch(str: string, query: string) {
  return str.toLowerCase().includes(query.toLowerCase());
}

export default function ContactsList() {
  const { data: session } = useSession();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState('lastName');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [selectedMembershipTypes, setSelectedMembershipTypes] = useLocalStorageMembershipTypeFilter();

  useEffect(() => {
    if (!session) {
      router.push('/login');
      return;
    }
    loadContacts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, router]);

  async function loadContacts() {
    setLoading(true);
    setError(null);
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
    } catch (err: any) {
      setError(err.message || 'Failed to load contacts');
    } finally {
      setLoading(false);
    }
  }

  function handleSort(field: string) {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }

  const filteredContacts = contacts
    .filter(c => {
      if (selectedMembershipTypes.length > 0 && c.membershipType) {
        return selectedMembershipTypes.some(
          t => (c.membershipType || '').toLowerCase() === t.toLowerCase()
        );
      }
      return true;
    })
    .filter(c => {
      if (!search) return true;
      return (
        fuzzyMatch(c.firstName || '', search) ||
        fuzzyMatch(c.lastName || '', search) ||
        fuzzyMatch(c.email || '', search) ||
        fuzzyMatch(c.phone || '', search)
      );
    })
    .sort((a, b) => {
      const aValue = a[sortField] || '';
      const bValue = b[sortField] || '';
      const comparison = aValue.localeCompare(bValue, 'en', { sensitivity: 'base' });
      return sortDirection === 'asc' ? comparison : -comparison;
    });

  if (!session) return null;
  if (loading) return <div className="p-4">Loading...</div>;
  if (error) return <div className="p-4 text-red-500">{error}</div>;

  return (
    <div className="h-screen flex flex-col bg-white">
      <div className="flex-none p-6 bg-white border-b">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-4xl font-bold" style={{ letterSpacing: 2 }}>Contacts List</h1>
            <Link
              href="/"
              className="px-4 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-400"
            >
              Back to Home
            </Link>
          </div>
          <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search contacts..."
              className="block w-full md:w-1/3 rounded-md border-0 py-1.5 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
            />
            <MembershipTypeFilterPanel
              selected={selectedMembershipTypes}
              onChange={setSelectedMembershipTypes}
            />
          </div>
        </div>
      </div>
      <div className="flex-1 relative">
        <div className="absolute inset-0 overflow-auto">
          <div className="min-w-full inline-block align-middle">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th
                    className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
                  >
                    <button onClick={() => handleSort('lastName')}>Last Name</button>
                  </th>
                  <th
                    className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
                  >
                    <button onClick={() => handleSort('firstName')}>First Name</button>
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    <button onClick={() => handleSort('email')}>Email</button>
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    <button onClick={() => handleSort('phone')}>Phone</button>
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    <button onClick={() => handleSort('address1')}>Address</button>
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    <button onClick={() => handleSort('postalCode')}>Postcode</button>
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    <button onClick={() => handleSort('membershipType')}>Type</button>
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredContacts.map((contact) => (
                  <tr key={contact.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                      {contact.lastName}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                      {contact.firstName}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                      {contact.email}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                      {contact.phone}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                      {contact.address1}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                      {contact.postalCode}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                      {contact.membershipType}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-right text-sm font-medium">
                      <Link
                        href={`/contacts/${contact.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-900"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}