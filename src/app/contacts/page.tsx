'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const MEMBERSHIP_TYPE_ID = "gH97LlNC9Y4PlkKVlY8V";

function normalizeMembershipType(mt: string | null | undefined): string {
  if (!mt) return '';
  return mt.trim().toLowerCase().replace(/member$/i, '').trim();
}

function isMember(mt: string | null | undefined): boolean {
  const normal = normalizeMembershipType(mt);
  return (
    normal.startsWith('full') ||
    normal.startsWith('associate') ||
    normal.startsWith('newsletter') ||
    normal.startsWith('ex')
  );
}

function fuzzyMatch(str: string, query: string) {
  return str.toLowerCase().includes(query.toLowerCase());
}

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

type SortField = 'firstName' | 'lastName' | 'email' | 'membershipType';
type SortDirection = 'asc' | 'desc';

export default function ContactsList() {
  const { data: session } = useSession();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [showMembersOnly, setShowMembersOnly] = useState(false);
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('lastName');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  useEffect(() => {
    if (!session) {
      router.push('/login');
      return;
    }
    loadContacts();
  }, [session, router]);

  async function loadContacts() {
    setLoading(true);
    setError(null);
    try {
      const contacts = await fetchAllContactsFromAPI();
      const trimmed = contacts.map((c: any) => {
        let membershipType = c.membershipType;
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
        
        return {
          id: c.id,
          firstName: c.firstName,
          lastName: c.lastName,
          email: c.email,
          contactName: c.name,
          membershipType: membershipType
        };
      });
      setContacts(trimmed);
    } catch (err: any) {
      setError(err.message || 'Failed to load contacts');
    } finally {
      setLoading(false);
    }
  }

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredContacts = contacts
    .filter(c => {
      if (showMembersOnly && !isMember(c.membershipType)) return false;
      if (!search) return true;
      return (
        fuzzyMatch(c.firstName || '', search) ||
        fuzzyMatch(c.lastName || '', search) ||
        fuzzyMatch(c.contactName || '', search) ||
        fuzzyMatch(c.email || '', search)
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
    <main className="bg-white min-h-screen p-6">
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

        <div className="mb-6 flex gap-4 items-center">
          <input
            type="text"
            className="flex-1 p-3 border-2 border-black rounded-lg text-xl focus:outline-none focus:ring-4 focus:ring-blue-400"
            placeholder="Search contacts..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
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

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th 
                  className="p-3 text-left cursor-pointer hover:bg-gray-200"
                  onClick={() => handleSort('lastName')}
                >
                  Last Name {sortField === 'lastName' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th 
                  className="p-3 text-left cursor-pointer hover:bg-gray-200"
                  onClick={() => handleSort('firstName')}
                >
                  First Name {sortField === 'firstName' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th 
                  className="p-3 text-left cursor-pointer hover:bg-gray-200"
                  onClick={() => handleSort('email')}
                >
                  Email {sortField === 'email' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th 
                  className="p-3 text-left cursor-pointer hover:bg-gray-200"
                  onClick={() => handleSort('membershipType')}
                >
                  Membership Type {sortField === 'membershipType' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th className="p-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredContacts.map(contact => (
                <tr key={contact.id} className="border-b hover:bg-gray-50">
                  <td className="p-3">{contact.lastName || ''}</td>
                  <td className="p-3">{contact.firstName || ''}</td>
                  <td className="p-3">{contact.email || ''}</td>
                  <td className="p-3">{contact.membershipType || ''}</td>
                  <td className="p-3">
                    <Link
                      href={`/contacts/${contact.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-400"
                    >
                      View Details
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
} 