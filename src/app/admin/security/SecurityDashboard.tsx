'use client';

import { useState } from 'react';
import SecurityStats from '@/components/security/SecurityStats';
import SecurityEventsList from '@/components/security/SecurityEventsList';
import SecurityConfig from '@/components/security/SecurityConfig';

export default function SecurityDashboard() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [activeTab, setActiveTab] = useState<'overview' | 'events' | 'config'>('overview');

  const refresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'events', label: 'Security Events', icon: '🔍' },
    { id: 'config', label: 'Configuration', icon: '⚙️' }
  ];

  return (
    <div className="space-y-6">
      {/* Header with Refresh Button */}
      <div className="flex justify-between items-center">
        <div className="flex space-x-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
        
        <button
          onClick={refresh}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>Refresh</span>
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <SecurityStats refreshTrigger={refreshTrigger} />
          
          <div className="bg-white p-6 rounded-lg border">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h3>
            <SecurityEventsList refreshTrigger={refreshTrigger} />
          </div>
        </div>
      )}

      {activeTab === 'events' && (
        <SecurityEventsList refreshTrigger={refreshTrigger} />
      )}

      {activeTab === 'config' && (
        <SecurityConfig />
      )}

      {/* System Status Indicators */}
      <div className="bg-white p-4 rounded-lg border">
        <div className="flex justify-between items-center">
          <h4 className="font-medium text-gray-900">System Status</h4>
          <div className="flex items-center space-x-4 text-sm">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-gray-600">Security Monitoring Active</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span className="text-gray-600">Real-time Logging</span>
            </div>
            <div className="text-gray-500">
              Last updated: {new Date().toLocaleTimeString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}