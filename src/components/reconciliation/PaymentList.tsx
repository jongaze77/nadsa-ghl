'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { PersistedPaymentData, PaymentListState, PaymentsResponse } from './types';

// Debounce hook for search input
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

interface PaymentListProps {
  onPaymentSelect?: (payment: PersistedPaymentData) => void;
  onFindMatches?: (payment: PersistedPaymentData) => void;
  selectedPayment?: PersistedPaymentData | null;
}

export default function PaymentList({ onPaymentSelect, onFindMatches, selectedPayment }: PaymentListProps) {
  const [state, setState] = useState<PaymentListState>({
    payments: [],
    loading: false,
    error: null,
    selectedPayment: selectedPayment || null,
    filters: {
      status: undefined, // No specific status filter
      source: undefined,
      showAll: false, // Default to hiding confirmed/ignored payments (shows pending/processing/matched)
    },
    pagination: {
      page: 1,
      limit: 25,
      total: 0,
    }
  });

  // Debounced search term to avoid excessive API calls
  const debouncedTextSearch = useDebounce(state.filters.textSearch || '', 300);

  // Fetch payments from API
  const fetchPayments = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const params = new URLSearchParams({
        page: state.pagination.page.toString(),
        limit: state.pagination.limit.toString(),
      });

      if (state.filters.status) {
        params.append('status', state.filters.status);
      }
      if (state.filters.source) {
        params.append('source', state.filters.source);
      }
      if (state.filters.amount) {
        params.append('amount', state.filters.amount.toString());
        params.append('amountExact', state.filters.amountExact ? 'true' : 'false');
      }
      if (debouncedTextSearch && debouncedTextSearch.trim()) {
        params.append('textSearch', debouncedTextSearch.trim());
      }
      if (state.filters.dateFrom) {
        params.append('dateFrom', state.filters.dateFrom);
      }
      if (state.filters.dateTo) {
        params.append('dateTo', state.filters.dateTo);
      }
      if (state.filters.showAll) {
        params.append('showAll', 'true');
      }

      const response = await fetch(`/api/reconciliation/payments?${params.toString()}`);
      const data: PaymentsResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch payments');
      }

      if (data.success && data.payments) {
        setState(prev => ({
          ...prev,
          payments: data.payments!,
          loading: false,
          pagination: {
            ...prev.pagination,
            total: data.total || 0
          }
        }));
      } else {
        throw new Error(data.message || 'Invalid response format');
      }
    } catch (error) {
      console.error('Error fetching payments:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }));
    }
  }, [state.pagination.page, state.pagination.limit, state.filters.status, state.filters.source, state.filters.amount, state.filters.amountExact, debouncedTextSearch, state.filters.dateFrom, state.filters.dateTo, state.filters.showAll]);

  // Effect to fetch payments on mount and when filters change
  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  // Handle payment selection (just highlight, don't trigger matching)
  const handlePaymentSelect = (payment: PersistedPaymentData) => {
    setState(prev => ({ ...prev, selectedPayment: payment }));
    if (onPaymentSelect) {
      onPaymentSelect(payment);
    }
  };

  // Handle find matches action
  const handleFindMatches = (payment: PersistedPaymentData) => {
    if (onFindMatches) {
      onFindMatches(payment);
    }
  };

  // Handle filter changes
  const handleFilterChange = (filterType: 'status' | 'source' | 'textSearch' | 'dateFrom' | 'dateTo', value: string) => {
    setState(prev => ({
      ...prev,
      filters: {
        ...prev.filters,
        [filterType]: value || undefined
      },
      pagination: {
        ...prev.pagination,
        page: 1 // Reset to first page when filtering
      }
    }));
  };

  // Handle amount filter changes
  const handleAmountFilterChange = (amount: number | undefined, exact: boolean = false) => {
    setState(prev => ({
      ...prev,
      filters: {
        ...prev.filters,
        amount,
        amountExact: exact
      },
      pagination: {
        ...prev.pagination,
        page: 1 // Reset to first page when filtering
      }
    }));
  };

  // Handle clear all filters
  const handleClearFilters = () => {
    setState(prev => ({
      ...prev,
      filters: {
        status: undefined, // Clear status filter
        source: undefined,
        amount: undefined,
        amountExact: false,
        textSearch: undefined,
        dateFrom: undefined,
        dateTo: undefined,
        showAll: false // Reset to default
      },
      pagination: {
        ...prev.pagination,
        page: 1
      }
    }));
  };

  // Handle page change
  const handlePageChange = (newPage: number) => {
    setState(prev => ({
      ...prev,
      pagination: {
        ...prev.pagination,
        page: newPage
      }
    }));
  };

  // Handle ignore/unignore payment
  const handleIgnorePayment = async (payment: PersistedPaymentData, ignore: boolean) => {
    try {
      const response = await fetch('/api/reconciliation/ignore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactionFingerprint: payment.transactionFingerprint,
          ignored: ignore,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to update payment status');
      }

      // Refresh the payment list to reflect the status change
      await fetchPayments();
    } catch (error) {
      console.error('Error updating payment status:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to update payment status'
      }));
    }
  };

  // Format currency
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount);
  };

  // Format date
  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  // Get status badge color
  const getStatusBadgeColor = (status: string): string => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'processing':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'matched':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'confirmed':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
      case 'ignored':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  // Get source badge color
  const getSourceBadgeColor = (source: string): string => {
    switch (source) {
      case 'BANK_CSV':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      case 'STRIPE_REPORT':
        return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  const totalPages = Math.ceil(state.pagination.total / state.pagination.limit);

  return (
    <div className="space-y-6">
      {/* Header and Filters */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Payment Processing
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Review and process uploaded payment transactions
          </p>
        </div>

        {/* Filters */}
        <div className="space-y-4">
          {/* First row: Status, Source, Amount filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div>
              <label htmlFor="status-filter" className="sr-only">Filter by status</label>
              <select
                id="status-filter"
                value={state.filters.status || ''}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="matched">Matched</option>
                <option value="confirmed">Confirmed</option>
                <option value="ignored">Ignored</option>
              </select>
            </div>

            <div>
              <label htmlFor="source-filter" className="sr-only">Filter by source</label>
              <select
                id="source-filter"
                value={state.filters.source || ''}
                onChange={(e) => handleFilterChange('source', e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Sources</option>
                <option value="BANK_CSV">Bank CSV</option>
                <option value="STRIPE_REPORT">Stripe Report</option>
              </select>
            </div>

            {/* Amount Filter */}
            <div className="flex gap-2">
              <div>
                <label htmlFor="amount-filter" className="sr-only">Filter by amount</label>
                <select
                  id="amount-filter"
                  value={state.filters.amount || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '') {
                      handleAmountFilterChange(undefined, false);
                    } else if (value === 'custom') {
                      // Keep current amount if switching to custom
                      handleAmountFilterChange(state.filters.amount || undefined, false);
                    } else {
                      handleAmountFilterChange(parseFloat(value), true);
                    }
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Amounts</option>
                  <option value="10">£10</option>
                  <option value="20">£20</option>
                  <option value="30">£30</option>
                  <option value="custom">Custom Amount</option>
                </select>
              </div>
              
              {(state.filters.amount !== undefined && !state.filters.amountExact) && (
                <div>
                  <label htmlFor="custom-amount" className="sr-only">Custom amount</label>
                  <input
                    id="custom-amount"
                    type="number"
                    min="0"
                    max="500"
                    step="0.01"
                    placeholder="£0.00"
                    value={state.filters.amount || ''}
                    onChange={(e) => {
                      const value = e.target.value ? parseFloat(e.target.value) : undefined;
                      handleAmountFilterChange(value, false);
                    }}
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-24"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Second row: Text search and date filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Text Search */}
            <div className="flex-1">
              <label htmlFor="text-search" className="sr-only">Search payments</label>
              <input
                id="text-search"
                type="text"
                placeholder="Search by customer name, email, or address..."
                value={state.filters.textSearch || ''}
                onChange={(e) => handleFilterChange('textSearch', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Date Range Filters */}
            <div className="flex gap-2">
              <div>
                <label htmlFor="date-from" className="sr-only">Date from</label>
                <input
                  id="date-from"
                  type="date"
                  value={state.filters.dateFrom || ''}
                  onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div>
                <label htmlFor="date-to" className="sr-only">Date to</label>
                <input
                  id="date-to"
                  type="date"
                  value={state.filters.dateTo || ''}
                  onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Third row: Show All toggle */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={state.filters.showAll || false}
                onChange={(e) => setState(prev => ({
                  ...prev,
                  filters: {
                    ...prev.filters,
                    showAll: e.target.checked
                  },
                  pagination: {
                    ...prev.pagination,
                    page: 1
                  }
                }))}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Show all payments (including confirmed and ignored)
            </label>
          </div>

          {/* Fourth row: Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={fetchPayments}
              disabled={state.loading}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {state.loading ? 'Loading...' : 'Apply Filters'}
            </button>
            
            <button
              onClick={handleClearFilters}
              disabled={state.loading}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 focus:ring-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Error State */}
      {state.error && (
        <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
          <div className="flex items-start space-x-3">
            <span className="text-red-400 text-lg">⚠️</span>
            <div className="flex-1">
              <h4 className="font-medium text-red-800 dark:text-red-300">
                Error Loading Payments
              </h4>
              <p className="text-sm text-red-700 dark:text-red-400 mt-1">
                {state.error}
              </p>
              <button
                onClick={fetchPayments}
                className="mt-2 text-sm bg-red-100 dark:bg-red-800 text-red-800 dark:text-red-200 px-3 py-1 rounded hover:bg-red-200 dark:hover:bg-red-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {state.loading && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-500 dark:text-gray-400">Loading payments...</p>
        </div>
      )}

      {/* Empty State */}
      {!state.loading && !state.error && state.payments.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
            <span className="text-2xl">💳</span>
          </div>
          <h4 className="text-gray-700 dark:text-gray-300 font-medium mb-2">
            No Payments Found
          </h4>
          <p className="text-gray-500 dark:text-gray-400">
            {state.filters.status || state.filters.source || state.filters.amount || debouncedTextSearch || state.filters.dateFrom || state.filters.dateTo
              ? 'No payments match your current filters. Try adjusting the filters or upload some CSV files.'
              : 'Upload CSV files to see payment transactions here.'
            }
          </p>
        </div>
      )}

      {/* Payment List */}
      {!state.loading && !state.error && state.payments.length > 0 && (
        <div className="space-y-4">
          <div className="grid gap-4">
            {state.payments.map((payment) => (
              <div
                key={payment.id}
                onClick={() => handlePaymentSelect(payment)}
                className={`p-4 border rounded-lg cursor-pointer transition-all hover:shadow-md ${
                  state.selectedPayment?.id === payment.id
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-400'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
                  <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadgeColor(payment.status)}`}>
                        {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                      </span>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getSourceBadgeColor(payment.source)}`}>
                        {payment.source === 'BANK_CSV' ? 'Bank CSV' : 'Stripe'}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Amount:</span>
                        <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">
                          {formatCurrency(payment.amount)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Date:</span>
                        <span className="ml-2 text-gray-900 dark:text-gray-100">
                          {formatDate(payment.paymentDate)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Uploaded:</span>
                        <span className="ml-2 text-gray-900 dark:text-gray-100">
                          {formatDate(payment.uploadedAt)}
                        </span>
                      </div>
                    </div>

                    {payment.description && (
                      <div className="text-sm">
                        <span className="text-gray-500 dark:text-gray-400">Description:</span>
                        <span className="ml-2 text-gray-900 dark:text-gray-100">
                          {payment.description.length > 100 
                            ? `${payment.description.substring(0, 100)}...` 
                            : payment.description
                          }
                        </span>
                      </div>
                    )}

                    {/* Display customer fields if available */}
                    {(payment.customer_name || payment.customer_email || payment.card_address_line1 || payment.card_address_postal_code) && (
                      <div className="space-y-1">
                        {payment.customer_name && (
                          <div className="text-sm">
                            <span className="text-gray-500 dark:text-gray-400">Customer:</span>
                            <span className="ml-2 text-gray-900 dark:text-gray-100">
                              {payment.customer_name}
                            </span>
                          </div>
                        )}
                        {payment.customer_email && (
                          <div className="text-sm">
                            <span className="text-gray-500 dark:text-gray-400">Email:</span>
                            <span className="ml-2 text-gray-900 dark:text-gray-100">
                              {payment.customer_email}
                            </span>
                          </div>
                        )}
                        {payment.card_address_line1 && (
                          <div className="text-sm">
                            <span className="text-gray-500 dark:text-gray-400">Address:</span>
                            <span className="ml-2 text-gray-900 dark:text-gray-100">
                              {payment.card_address_line1}
                              {payment.card_address_postal_code && `, ${payment.card_address_postal_code}`}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="text-xs text-gray-400 dark:text-gray-500">
                      Ref: {payment.transactionRef}
                    </div>
                  </div>

                  <div className="flex-shrink-0 flex items-center gap-2">
                    {state.selectedPayment?.id === payment.id && (
                      <span className="text-blue-600 dark:text-blue-400 text-sm font-medium">
                        Selected
                      </span>
                    )}
                    
                    {/* Ignore/Unignore button */}
                    {payment.status === 'ignored' ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleIgnorePayment(payment, false);
                        }}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded transition-colors focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                        title="Unignore this payment"
                      >
                        Unignore
                      </button>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleIgnorePayment(payment, true);
                        }}
                        className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded transition-colors focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
                        title="Ignore this payment"
                      >
                        Ignore
                      </button>
                    )}
                    
                    {/* Find Matches button - only show for pending/processing payments */}
                    {['pending', 'processing'].includes(payment.status) && (
                      <button
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent card selection
                        handleFindMatches(payment);
                      }}
                        className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded transition-colors focus:ring-2 focus:ring-green-500 focus:ring-offset-1"
                      >
                        Find Matches
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Showing {(state.pagination.page - 1) * state.pagination.limit + 1} to{' '}
                {Math.min(state.pagination.page * state.pagination.limit, state.pagination.total)} of{' '}
                {state.pagination.total} payments
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handlePageChange(state.pagination.page - 1)}
                  disabled={state.pagination.page <= 1}
                  className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>

                <span className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                  Page {state.pagination.page} of {totalPages}
                </span>

                <button
                  onClick={() => handlePageChange(state.pagination.page + 1)}
                  disabled={state.pagination.page >= totalPages}
                  className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}