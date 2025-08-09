'use client';

import React, { useState, useEffect, useCallback } from 'react';

interface Contact {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  name?: string;
  membershipType?: string;
}

interface ManualContactSearchProps {
  onContactSelected?: (contact: Contact) => void;
  onCreateNewContact?: () => void;
}

export default function ManualContactSearch({ 
  onContactSelected, 
  onCreateNewContact 
}: ManualContactSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Contact[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Debounced search function
  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);
    setError(null);
    setHasSearched(true);

    try {
      const response = await fetch(`/api/contacts?search=${encodeURIComponent(query.trim())}&limit=20`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to search contacts');
      }

      setSearchResults(data.contacts || []);
    } catch (error) {
      console.error('Search error:', error);
      setError(error instanceof Error ? error.message : 'Search failed');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Debounce the search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      performSearch(searchQuery);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, performSearch]);

  const handleContactSelect = (contact: Contact) => {
    if (onContactSelected) {
      onContactSelected(contact);
    }
  };

  const formatContactName = (contact: Contact): string => {
    if (contact.firstName && contact.lastName) {
      return `${contact.firstName} ${contact.lastName}`;
    }
    if (contact.name) {
      return contact.name;
    }
    return contact.email || 'Unknown Contact';
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h4 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-2">
          Manual Contact Search
        </h4>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Search for contacts by name, email, or other details when automatic matching doesn&apos;t find the right match.
        </p>
      </div>

      {/* Search Input */}
      <div className="relative">
        <div className="relative">
          <input
            type="text"
            placeholder="Search contacts by name, email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={isSearching}
          />
          {isSearching && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200 dark:border-red-800">
          <div className="flex items-center space-x-2">
            <span className="text-red-400 text-sm">⚠️</span>
            <p className="text-sm text-red-700 dark:text-red-400">
              {error}
            </p>
          </div>
        </div>
      )}

      {/* Search Results */}
      {hasSearched && !isSearching && (
        <div className="space-y-3">
          {searchResults.length === 0 ? (
            <div className="text-center py-6">
              <div className="w-12 h-12 mx-auto mb-3 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                <span className="text-lg">🔍</span>
              </div>
              <p className="text-gray-500 dark:text-gray-400 mb-3">
                No contacts found matching &quot;{searchQuery}&quot;
              </p>
              {onCreateNewContact && (
                <button
                  onClick={onCreateNewContact}
                  className="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 focus:ring-2 focus:ring-green-500 transition-colors"
                >
                  <span className="mr-2">➕</span>
                  Create New Contact
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Found {searchResults.length} contact{searchResults.length !== 1 ? 's' : ''}
                </p>
                {onCreateNewContact && (
                  <button
                    onClick={onCreateNewContact}
                    className="inline-flex items-center px-3 py-1 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 focus:ring-2 focus:ring-green-500 transition-colors"
                  >
                    <span className="mr-1 text-xs">➕</span>
                    New Contact
                  </button>
                )}
              </div>
              
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {searchResults.map((contact) => (
                  <div
                    key={contact.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-white dark:bg-gray-800 hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h5 className="font-medium text-gray-900 dark:text-gray-100">
                          {formatContactName(contact)}
                        </h5>
                        <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1 mt-1">
                          {contact.email && (
                            <div>
                              <span className="font-medium">Email:</span> {contact.email}
                            </div>
                          )}
                          {contact.membershipType && (
                            <div>
                              <span className="font-medium">Membership:</span> {contact.membershipType}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => {
                            const url = `/contact-review/${contact.id}`;
                            window.open(url, '_blank', 'width=1200,height=800,scrollbars=yes,resizable=yes');
                          }}
                          className="px-3 py-1 text-sm font-medium rounded-md transition-colors bg-blue-600 text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500"
                        >
                          View
                        </button>
                        <button
                          onClick={() => handleContactSelect(contact)}
                          className="px-3 py-1 text-sm font-medium rounded-md transition-colors bg-green-600 text-white hover:bg-green-700 focus:ring-2 focus:ring-green-500"
                        >
                          Select
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* No Search Yet */}
      {!hasSearched && !isSearching && !searchQuery && (
        <div className="text-center py-6">
          <div className="w-12 h-12 mx-auto mb-3 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
            <span className="text-lg">🔍</span>
          </div>
          <p className="text-gray-500 dark:text-gray-400">
            Start typing to search for contacts
          </p>
        </div>
      )}
    </div>
  );
}