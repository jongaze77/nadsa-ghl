'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

<<<<<<< HEAD
const MEMBERSHIP_TYPE_ID = "gH97LlNC9Y4PlkKVlY8V";
=======
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Contact } from '@prisma/client';
import MembershipTypeFilterPanel, { MembershipType } from "@/components/MembershipTypeFilterPanel";
>>>>>>> 9cfeb25c75d49bc817945a2c3825691dc80655d5

function normalizeMembershipType(mt: string | null | undefined): string {
  if (!mt) return '';
  return mt.trim().toLowerCase().replace(/member$/i, '').trim();
}

function isMember(mt: string | null | undefined): boolean {
  if (!mt) return false;
  const type = mt.trim().toUpperCase();
  return ['F', 'A'].includes(type);
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

type SortField = 'firstName' | 'lastName' | 'email' | 'membershipType' | 'phone' | 'address1' | 'postalCode' | 'renewalDate';
type SortDirection = 'asc' | 'desc';

function truncateText(text: string | null | undefined, maxLength = 15): string {
  if (!text) return '';
  return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
}

export default function ContactsList() {
  const { data: session } = useSession();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [showMembersOnly, setShowMembersOnly] = useState(false);
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
<<<<<<< HEAD
  const [sortField, setSortField] = useState<SortField>('lastName');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
=======
  const [pagination, setPagination] = useState<ContactsResponse['pagination']>({
    total: 0,
    page: 1,
    limit: 100,
    totalPages: 0,
  });
  const [search, setSearch] = useState('');
  const [selectedMembershipTypes, setSelectedMembershipTypes] = useState<MembershipType[]>([]);
>>>>>>> 9cfeb25c75d49bc817945a2c3825691dc80655d5

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
<<<<<<< HEAD
      const contacts = await fetchAllContactsFromAPI();
      const trimmed = contacts.map((c: any) => {
        let membershipType = c.membershipType;
        let renewalDate = null;
        
        if (c.customFields) {
          if (typeof c.customFields === 'object' && !Array.isArray(c.customFields)) {
            membershipType = c.customFields[MEMBERSHIP_TYPE_ID];
            renewalDate = c.customFields['cWMPNiNAfReHOumOhBB2']; // Renewal date field ID
          } else if (Array.isArray(c.customFields)) {
            const membershipField = c.customFields.find((cf: any) => cf.id === MEMBERSHIP_TYPE_ID);
            const renewalField = c.customFields.find((cf: any) => cf.id === 'cWMPNiNAfReHOumOhBB2');
            if (membershipField) {
              membershipType = membershipField.value;
            }
            if (renewalField) {
              renewalDate = renewalField.value;
            }
          }
        }
=======
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(search && { search }),
        ...(selectedMembershipTypes.length > 0 && { membershipTypes: selectedMembershipTypes.join(',') }),
      });
>>>>>>> 9cfeb25c75d49bc817945a2c3825691dc80655d5

        // Convert membership type to initial
        let membershipInitial = '';
        if (membershipType) {
          const type = membershipType.trim().toLowerCase();
          if (type.startsWith('full')) membershipInitial = 'F';
          else if (type.startsWith('associate')) membershipInitial = 'A';
          else if (type.startsWith('newsletter')) membershipInitial = 'N';
          else if (type.startsWith('ex')) membershipInitial = 'E';
        }
        
        return {
          id: c.id,
          firstName: c.firstName,
          lastName: c.lastName,
          email: c.email,
          phone: c.phone,
          address1: c.address1,
          postalCode: c.postalCode,
          membershipType: membershipInitial,
          renewalDate: renewalDate
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

<<<<<<< HEAD
  const filteredContacts = contacts
    .filter(c => {
      if (showMembersOnly && !isMember(c.membershipType)) return false;
      if (!search) return true;
      return (
        fuzzyMatch(c.firstName || '', search) ||
        fuzzyMatch(c.lastName || '', search) ||
        fuzzyMatch(c.email || '', search)
      );
    })
    .sort((a, b) => {
      if (sortField === 'renewalDate') {
        // Handle empty dates
        if (!a[sortField] && !b[sortField]) return 0;
        if (!a[sortField]) return 1;
        if (!b[sortField]) return -1;
        
        // Compare dates
        const dateA = new Date(a[sortField]).getTime();
        const dateB = new Date(b[sortField]).getTime();
        return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
      }
      
      // Default string comparison for other fields
      const aValue = a[sortField] || '';
      const bValue = b[sortField] || '';
      const comparison = aValue.localeCompare(bValue, 'en', { sensitivity: 'base' });
      return sortDirection === 'asc' ? comparison : -comparison;
    });
=======
  useEffect(() => {
    fetchContacts();
  }, [pagination.page, search, selectedMembershipTypes, fetchContacts]);
>>>>>>> 9cfeb25c75d49bc817945a2c3825691dc80655d5

  if (!session) return null;
  if (loading) return <div className="p-4">Loading...</div>;
  if (error) return <div className="p-4 text-red-500">{error}</div>;

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Fixed header */}
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

<<<<<<< HEAD
          <div className="mb-6 space-y-4 md:space-y-0 md:flex md:items-center md:justify-between">
            <div className="flex-1 min-w-0 md:max-w-sm">
              <div className="relative rounded-md shadow-sm">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search contacts..."
                  className="block w-full rounded-md border-0 py-1.5 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                />
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <label className="inline-flex items-center">
                <input
                  type="checkbox"
                  checked={showMembersOnly}
                  onChange={(e) => setShowMembersOnly(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                />
                <span className="ml-2 text-sm text-gray-700">Show Members Only</span>
              </label>
            </div>
          </div>
        </div>
=======
      {/* Filters */}
      <div className="mb-6">
        <form onSubmit={handleSearch} className="flex gap-4 mb-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search contacts..."
            className="flex-1 px-4 py-2 border rounded-lg"
          />
          <MembershipTypeFilterPanel
            selected={selectedMembershipTypes}
            onChange={setSelectedMembershipTypes}
          />
          <button
            type="submit"
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Search
          </button>
        </form>
>>>>>>> 9cfeb25c75d49bc817945a2c3825691dc80655d5
      </div>

      {/* Table container */}
      <div className="flex-1 relative">
        <div className="absolute inset-0 overflow-auto">
          <div className="min-w-full inline-block align-middle">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th
                    scope="col"
                    className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
                  >
                    <button
                      onClick={() => handleSort('lastName')}
                      className="group inline-flex items-center"
                    >
                      Last Name
                      <span className="ml-2 flex-none rounded text-gray-400 group-hover:visible group-focus:visible">
                        {sortField === 'lastName' ? (
                          sortDirection === 'asc' ? '↑' : '↓'
                        ) : (
                          <span className="invisible group-hover:visible group-focus:visible">↕</span>
                        )}
                      </span>
                    </button>
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
                  >
                    <button
                      onClick={() => handleSort('firstName')}
                      className="group inline-flex items-center"
                    >
                      First Name
                      <span className="ml-2 flex-none rounded text-gray-400 group-hover:visible group-focus:visible">
                        {sortField === 'firstName' ? (
                          sortDirection === 'asc' ? '↑' : '↓'
                        ) : (
                          <span className="invisible group-hover:visible group-focus:visible">↕</span>
                        )}
                      </span>
                    </button>
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
                  >
                    <button
                      onClick={() => handleSort('email')}
                      className="group inline-flex items-center"
                    >
                      Email
                      <span className="ml-2 flex-none rounded text-gray-400 group-hover:visible group-focus:visible">
                        {sortField === 'email' ? (
                          sortDirection === 'asc' ? '↑' : '↓'
                        ) : (
                          <span className="invisible group-hover:visible group-focus:visible">↕</span>
                        )}
                      </span>
                    </button>
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
                  >
                    <button
                      onClick={() => handleSort('phone')}
                      className="group inline-flex items-center"
                    >
                      Phone
                      <span className="ml-2 flex-none rounded text-gray-400 group-hover:visible group-focus:visible">
                        {sortField === 'phone' ? (
                          sortDirection === 'asc' ? '↑' : '↓'
                        ) : (
                          <span className="invisible group-hover:visible group-focus:visible">↕</span>
                        )}
                      </span>
                    </button>
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
                  >
                    <button
                      onClick={() => handleSort('address1')}
                      className="group inline-flex items-center"
                    >
                      Address
                      <span className="ml-2 flex-none rounded text-gray-400 group-hover:visible group-focus:visible">
                        {sortField === 'address1' ? (
                          sortDirection === 'asc' ? '↑' : '↓'
                        ) : (
                          <span className="invisible group-hover:visible group-focus:visible">↕</span>
                        )}
                      </span>
                    </button>
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
                  >
                    <button
                      onClick={() => handleSort('postalCode')}
                      className="group inline-flex items-center"
                    >
                      Postcode
                      <span className="ml-2 flex-none rounded text-gray-400 group-hover:visible group-focus:visible">
                        {sortField === 'postalCode' ? (
                          sortDirection === 'asc' ? '↑' : '↓'
                        ) : (
                          <span className="invisible group-hover:visible group-focus:visible">↕</span>
                        )}
                      </span>
                    </button>
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
                  >
                    <button
                      onClick={() => handleSort('membershipType')}
                      className="group inline-flex items-center"
                    >
                      Type
                      <span className="ml-2 flex-none rounded text-gray-400 group-hover:visible group-focus:visible">
                        {sortField === 'membershipType' ? (
                          sortDirection === 'asc' ? '↑' : '↓'
                        ) : (
                          <span className="invisible group-hover:visible group-focus:visible">↕</span>
                        )}
                      </span>
                    </button>
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
                  >
                    <button
                      onClick={() => handleSort('renewalDate')}
                      className="group inline-flex items-center"
                    >
                      Renewal Date
                      <span className="ml-2 flex-none rounded text-gray-400 group-hover:visible group-focus:visible">
                        {sortField === 'renewalDate' ? (
                          sortDirection === 'asc' ? '↑' : '↓'
                        ) : (
                          <span className="invisible group-hover:visible group-focus:visible">↕</span>
                        )}
                      </span>
                    </button>
                  </th>
                  <th scope="col" className="relative px-3 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredContacts.map((contact) => (
                  <tr key={contact.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                      {truncateText(contact.lastName)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                      {truncateText(contact.firstName)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                      {truncateText(contact.email)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                      {truncateText(contact.phone)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                      {truncateText(contact.address1)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                      {truncateText(contact.postalCode)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                      {getMembershipTypeInitial(contact.membershipType)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                      {contact.renewalDate ? new Date(contact.renewalDate).toLocaleDateString() : ''}
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

      {/* Mobile card view */}
      <div className="md:hidden p-6 space-y-4">
        {filteredContacts.map((contact) => (
          <div key={contact.id} className="bg-white p-4 rounded-lg shadow border border-gray-200">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="text-lg font-semibold">
                  {truncateText(contact.firstName)} {truncateText(contact.lastName)}
                </h3>
                <p className="text-sm text-gray-600">{truncateText(contact.email)}</p>
              </div>
              <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                {getMembershipTypeInitial(contact.membershipType)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-500">Phone:</span>
                <p>{truncateText(contact.phone) || '-'}</p>
              </div>
              <div>
                <span className="text-gray-500">Address:</span>
                <p>{truncateText(contact.address1) || '-'}</p>
              </div>
              <div>
                <span className="text-gray-500">Postcode:</span>
                <p>{truncateText(contact.postalCode) || '-'}</p>
              </div>
              <div>
                <span className="text-gray-500">Renewal:</span>
                <p>{contact.renewalDate ? new Date(contact.renewalDate).toLocaleDateString() : '-'}</p>
              </div>
            </div>
            <div className="mt-3 text-right">
              <Link
                href={`/contacts/${contact.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 rounded-md hover:bg-blue-100"
              >
                View
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function getMembershipTypeInitial(mt: string | null | undefined): string {
  if (!mt) return '';
  const type = mt.trim().toUpperCase();
  if (type === 'F') return 'Full';
  if (type === 'A') return 'Associate';
  if (type === 'N') return 'Newsletter';
  if (type === 'E') return 'Ex';
  return '';
} 