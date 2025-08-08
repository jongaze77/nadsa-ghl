'use client';

import type { MatchSuggestion } from './types';

interface MatchSuggestionsProps {
  suggestions?: MatchSuggestion[];
}

// Placeholder component for future match suggestions functionality
export default function MatchSuggestions({ suggestions = [] }: MatchSuggestionsProps) {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
        Match Suggestions Component
      </h3>
      
      {suggestions.length === 0 ? (
        <div className="text-center py-8">
          <div className="w-12 h-12 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
            <span className="text-xl">🔗</span>
          </div>
          <p className="text-gray-600 dark:text-gray-400 mb-2">
            No match suggestions available
          </p>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Coming in Story 1.11: AI-powered matching suggestions with GHL contacts
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {suggestions.map((suggestion, index) => (
            <div key={suggestion.paymentData.transactionFingerprint || index} 
                 className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-gray-100">
                    {suggestion.paymentData.description}
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    £{suggestion.paymentData.amount.toFixed(2)} • {suggestion.paymentData.paymentDate.toLocaleDateString()}
                  </p>
                </div>
                <span className={`px-2 py-1 rounded text-xs ${
                  suggestion.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                  suggestion.status === 'rejected' ? 'bg-red-100 text-red-800' :
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {suggestion.status}
                </span>
              </div>
              
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {suggestion.matches.length} potential matches found
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}