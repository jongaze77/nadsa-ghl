'use client';

import { useState } from 'react';

export default function ReconciliationDashboard() {
  const [activeTab, setActiveTab] = useState<'upload' | 'payments' | 'matches'>('upload');

  const tabs = [
    { id: 'upload', label: 'File Upload', icon: '📁' },
    { id: 'payments', label: 'Payment Processing', icon: '💳' },
    { id: 'matches', label: 'Match Suggestions', icon: '🔗' }
  ];

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex justify-between items-center">
        <div className="flex space-x-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'upload' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
              File Upload
            </h3>
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                <span className="text-2xl">📁</span>
              </div>
              <h4 className="text-gray-700 dark:text-gray-300 font-medium mb-2">
                Upload Payment Files
              </h4>
              <p className="text-gray-500 dark:text-gray-400">
                Upload CSV files from Lloyds Bank or Stripe transaction reports
              </p>
              <div className="mt-4 text-sm text-gray-400 dark:text-gray-500">
                Coming soon: File upload functionality
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'payments' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
              Payment Processing
            </h3>
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                <span className="text-2xl">💳</span>
              </div>
              <h4 className="text-gray-700 dark:text-gray-300 font-medium mb-2">
                Payment Data Review
              </h4>
              <p className="text-gray-500 dark:text-gray-400">
                Review and validate imported payment transactions
              </p>
              <div className="mt-4 text-sm text-gray-400 dark:text-gray-500">
                Coming soon: Payment list and processing interface
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'matches' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
              Match Suggestions
            </h3>
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                <span className="text-2xl">🔗</span>
              </div>
              <h4 className="text-gray-700 dark:text-gray-300 font-medium mb-2">
                Smart Matching
              </h4>
              <p className="text-gray-500 dark:text-gray-400">
                AI-powered suggestions to match payments with GHL contacts
              </p>
              <div className="mt-4 text-sm text-gray-400 dark:text-gray-500">
                Coming soon: Intelligent matching interface
              </div>
            </div>
          </div>
        </div>
      )}

      {/* System Status */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center">
          <h4 className="font-medium text-gray-900 dark:text-gray-100">System Status</h4>
          <div className="flex items-center space-x-4 text-sm">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-gray-600 dark:text-gray-300">Backend Services Active</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span className="text-gray-600 dark:text-gray-300">API Endpoints Ready</span>
            </div>
            <div className="text-gray-500 dark:text-gray-400">
              Last updated: {new Date().toLocaleTimeString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}