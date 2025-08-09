'use client';

import React, { useState, useEffect } from 'react';
import { PersistedPaymentData, ContactMatch, MatchSuggestionsState, MatchesResponse, ConfirmResponse, PaymentData } from './types';

interface MatchSuggestionsProps {
  selectedPayment: PersistedPaymentData | null;
  onMatchConfirmed?: (payment: PersistedPaymentData, match: ContactMatch) => void;
}

export default function MatchSuggestions({ selectedPayment, onMatchConfirmed }: MatchSuggestionsProps) {
  const [state, setState] = useState<MatchSuggestionsState>({
    suggestions: [],
    loading: false,
    error: null,
    selectedPayment: null,
    confirmingMatch: null,
    processingTimeMs: undefined,
  });

  // Fetch match suggestions for selected payment
  const fetchMatchSuggestions = async (payment: PersistedPaymentData) => {
    setState(prev => ({ 
      ...prev, 
      loading: true, 
      error: null, 
      selectedPayment: payment, 
      suggestions: [],
      processingTimeMs: undefined 
    }));

    try {
      // Convert PersistedPaymentData to PaymentData format for API
      const paymentData: PaymentData = {
        transactionFingerprint: payment.transactionFingerprint,
        amount: payment.amount,
        paymentDate: new Date(payment.paymentDate),
        description: payment.description || '',
        source: payment.source as 'BANK_CSV' | 'STRIPE_REPORT',
        transactionRef: payment.transactionRef,
        // Include customer fields for better matching
        customer_name: payment.customer_name,
        customer_email: payment.customer_email,
        card_address_line1: payment.card_address_line1,
        card_address_postal_code: payment.card_address_postal_code,
      };

      const response = await fetch('/api/reconciliation/matches', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ paymentData }),
      });

      const data: MatchesResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch match suggestions');
      }

      if (data.success && data.suggestions) {
        setState(prev => ({
          ...prev,
          suggestions: data.suggestions || [],
          loading: false,
          processingTimeMs: data.processingTimeMs,
        }));
      } else {
        throw new Error(data.message || 'Invalid response format');
      }
    } catch (error) {
      console.error('Error fetching match suggestions:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }));
    }
  };

  // Confirm a match
  const confirmMatch = async (match: ContactMatch) => {
    if (!state.selectedPayment) return;

    setState(prev => ({ ...prev, confirmingMatch: match.contactId }));

    try {
      // Convert PersistedPaymentData to PaymentData format for API
      const paymentData: PaymentData = {
        transactionFingerprint: state.selectedPayment!.transactionFingerprint,
        amount: state.selectedPayment!.amount,
        paymentDate: new Date(state.selectedPayment!.paymentDate),
        description: state.selectedPayment!.description || '',
        source: state.selectedPayment!.source as 'BANK_CSV' | 'STRIPE_REPORT',
        transactionRef: state.selectedPayment!.transactionRef,
        // Include customer fields for matching
        customer_name: state.selectedPayment!.customer_name,
        customer_email: state.selectedPayment!.customer_email,
        card_address_line1: state.selectedPayment!.card_address_line1,
        card_address_postal_code: state.selectedPayment!.card_address_postal_code,
      };

      const response = await fetch('/api/reconciliation/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentData,
          contactId: match.contactId,
          confidence: match.confidence,
          reasoning: match.reasoning,
        }),
      });

      const data: ConfirmResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to confirm match');
      }

      if (data.success) {
        setState(prev => ({
          ...prev,
          confirmingMatch: null,
          suggestions: [], // Clear suggestions after successful confirmation
        }));

        if (onMatchConfirmed) {
          onMatchConfirmed(state.selectedPayment, match);
        }
      } else {
        throw new Error(data.message || 'Match confirmation failed');
      }
    } catch (error) {
      console.error('Error confirming match:', error);
      setState(prev => ({
        ...prev,
        confirmingMatch: null,
        error: error instanceof Error ? error.message : 'Failed to confirm match'
      }));
    }
  };

  // Effect to fetch suggestions when selected payment changes
  useEffect(() => {
    if (selectedPayment) {
      fetchMatchSuggestions(selectedPayment);
    } else {
      setState(prev => ({
        ...prev,
        suggestions: [],
        selectedPayment: null,
        error: null,
      }));
    }
  }, [selectedPayment]);

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

  // Get confidence color
  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.8) return 'text-green-600 dark:text-green-400';
    if (confidence >= 0.6) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  // Get confidence badge color
  const getConfidenceBadgeColor = (confidence: number): string => {
    if (confidence >= 0.8) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
    if (confidence >= 0.6) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
    return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
  };

  // Format confidence percentage
  const formatConfidence = (confidence: number): string => {
    return `${Math.round(confidence * 100)}%`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
          Match Suggestions
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          AI-powered contact matching for payment reconciliation
        </p>
        {state.processingTimeMs && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Processing time: {state.processingTimeMs}ms
          </p>
        )}
      </div>

      {/* Selected Payment Summary */}
      {selectedPayment && (
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
          <h4 className="font-medium text-blue-900 dark:text-blue-300 mb-2">
            Selected Payment
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
            <div>
              <span className="text-blue-700 dark:text-blue-400">Amount:</span>
              <span className="ml-2 font-medium text-blue-900 dark:text-blue-100">
                {formatCurrency(selectedPayment.amount)}
              </span>
            </div>
            <div>
              <span className="text-blue-700 dark:text-blue-400">Date:</span>
              <span className="ml-2 text-blue-900 dark:text-blue-100">
                {formatDate(selectedPayment.paymentDate)}
              </span>
            </div>
            <div>
              <span className="text-blue-700 dark:text-blue-400">Source:</span>
              <span className="ml-2 text-blue-900 dark:text-blue-100">
                {selectedPayment.source === 'BANK_CSV' ? 'Bank CSV' : 'Stripe'}
              </span>
            </div>
          </div>
          
          {/* Display customer fields if available */}
          {(selectedPayment.customer_name || selectedPayment.customer_email || selectedPayment.card_address_line1) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm mt-3">
              {selectedPayment.customer_name && (
                <div>
                  <span className="text-blue-700 dark:text-blue-400">Customer:</span>
                  <span className="ml-2 font-medium text-blue-900 dark:text-blue-100">
                    {selectedPayment.customer_name}
                  </span>
                </div>
              )}
              {selectedPayment.customer_email && (
                <div>
                  <span className="text-blue-700 dark:text-blue-400">Email:</span>
                  <span className="ml-2 text-blue-900 dark:text-blue-100">
                    {selectedPayment.customer_email}
                  </span>
                </div>
              )}
              {selectedPayment.card_address_line1 && (
                <div className="sm:col-span-2">
                  <span className="text-blue-700 dark:text-blue-400">Address:</span>
                  <span className="ml-2 text-blue-900 dark:text-blue-100">
                    {selectedPayment.card_address_line1}
                    {selectedPayment.card_address_postal_code && `, ${selectedPayment.card_address_postal_code}`}
                  </span>
                </div>
              )}
            </div>
          )}
          
          {selectedPayment.description && (
            <div className="text-sm mt-2">
              <span className="text-blue-700 dark:text-blue-400">Description:</span>
              <span className="ml-2 text-blue-900 dark:text-blue-100">
                {selectedPayment.description}
              </span>
            </div>
          )}
        </div>
      )}

      {/* No Payment Selected */}
      {!selectedPayment && (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
            <span className="text-2xl">🔗</span>
          </div>
          <h4 className="text-gray-700 dark:text-gray-300 font-medium mb-2">
            No Payment Selected
          </h4>
          <p className="text-gray-500 dark:text-gray-400">
            Select a payment from the Payment Processing tab to see AI-powered match suggestions
          </p>
        </div>
      )}

      {/* Error State */}
      {state.error && (
        <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
          <div className="flex items-start space-x-3">
            <span className="text-red-400 text-lg">⚠️</span>
            <div className="flex-1">
              <h4 className="font-medium text-red-800 dark:text-red-300">
                Error Loading Match Suggestions
              </h4>
              <p className="text-sm text-red-700 dark:text-red-400 mt-1">
                {state.error}
              </p>
              {selectedPayment && (
                <button
                  onClick={() => fetchMatchSuggestions(selectedPayment)}
                  className="mt-2 text-sm bg-red-100 dark:bg-red-800 text-red-800 dark:text-red-200 px-3 py-1 rounded hover:bg-red-200 dark:hover:bg-red-700 transition-colors"
                >
                  Try Again
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {state.loading && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            Finding match suggestions using AI...
          </p>
        </div>
      )}

      {/* Match Suggestions */}
      {selectedPayment && !state.loading && !state.error && (
        <>
          {state.suggestions.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                <span className="text-2xl">🚫</span>
              </div>
              <h4 className="text-gray-700 dark:text-gray-300 font-medium mb-2">
                No Matches Found
              </h4>
              <p className="text-gray-500 dark:text-gray-400">
                No potential contact matches were found for this payment. You may need to add the contact manually.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Found {state.suggestions.length} potential match{state.suggestions.length !== 1 ? 'es' : ''} 
                  {state.suggestions.length > 0 && ' (sorted by confidence)'}
                </p>
              </div>

              <div className="space-y-4">
                {state.suggestions
                  .sort((a, b) => b.confidence - a.confidence) // Sort by confidence (highest first)
                  .map((match) => (
                  <div
                    key={match.contactId}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 bg-white dark:bg-gray-800"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                            {match.contact.firstName && match.contact.lastName
                              ? `${match.contact.firstName} ${match.contact.lastName}`
                              : match.contact.email || 'Unknown Contact'
                            }
                          </h4>
                          <span className={`px-3 py-1 text-sm font-medium rounded-full ${getConfidenceBadgeColor(match.confidence)}`}>
                            {formatConfidence(match.confidence)} match
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                          {match.contact.email && (
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">Email:</span>
                              <span className="ml-2 text-gray-900 dark:text-gray-100">
                                {match.contact.email}
                              </span>
                            </div>
                          )}
                          {match.contact.membershipType && (
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">Membership:</span>
                              <span className="ml-2 text-gray-900 dark:text-gray-100">
                                {match.contact.membershipType}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            const url = `/contact-review/${match.contactId}`;
                            window.open(url, '_blank', 'width=1200,height=800,scrollbars=yes,resizable=yes');
                          }}
                          className="px-4 py-2 text-sm font-medium rounded-md transition-colors bg-blue-600 text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500"
                        >
                          View Details
                        </button>
                        <button
                          onClick={() => confirmMatch(match)}
                          disabled={state.confirmingMatch !== null}
                          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                            state.confirmingMatch === match.contactId
                              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                              : 'bg-green-600 text-white hover:bg-green-700 focus:ring-2 focus:ring-green-500'
                          }`}
                        >
                          {state.confirmingMatch === match.contactId ? (
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
                              Confirming...
                            </div>
                          ) : (
                            'Confirm Match'
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Match Reasoning */}
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                      <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Match Reasoning:
                      </h5>
                      <div className="space-y-2">
                        {match.reasoning.nameMatch && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Name Match:</span>
                            <div className="flex items-center gap-2">
                              <div className="w-16 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                                <div 
                                  className="bg-blue-600 h-2 rounded-full transition-all"
                                  style={{ width: `${match.reasoning.nameMatch.score * 100}%` }}
                                ></div>
                              </div>
                              <span className={`font-medium ${getConfidenceColor(match.reasoning.nameMatch.score)}`}>
                                {formatConfidence(match.reasoning.nameMatch.score)}
                              </span>
                            </div>
                          </div>
                        )}
                        {match.reasoning.emailMatch && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Email Match:</span>
                            <div className="flex items-center gap-2">
                              <div className="w-16 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                                <div 
                                  className="bg-green-600 h-2 rounded-full transition-all"
                                  style={{ width: `${match.reasoning.emailMatch.score * 100}%` }}
                                ></div>
                              </div>
                              <span className={`font-medium ${getConfidenceColor(match.reasoning.emailMatch.score)}`}>
                                {formatConfidence(match.reasoning.emailMatch.score)}
                              </span>
                            </div>
                          </div>
                        )}
                        {match.reasoning.amountMatch && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Amount Match:</span>
                            <div className="flex items-center gap-2">
                              <div className="w-16 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                                <div 
                                  className="bg-purple-600 h-2 rounded-full transition-all"
                                  style={{ width: `${match.reasoning.amountMatch.score * 100}%` }}
                                ></div>
                              </div>
                              <span className={`font-medium ${getConfidenceColor(match.reasoning.amountMatch.score)}`}>
                                {formatConfidence(match.reasoning.amountMatch.score)}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="text-xs text-gray-400 dark:text-gray-500 mt-3">
                      Contact ID: {match.contactId}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}