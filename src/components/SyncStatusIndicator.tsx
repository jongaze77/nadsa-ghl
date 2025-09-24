'use client';

import { useState, useEffect } from 'react';

interface SyncStatus {
  status: 'green' | 'yellow' | 'red';
  lastSyncTime: string | null;
  hoursAgo: number | null;
  message: string;
  totalContacts: number;
  recentlyUpdated: number;
  lastIncrementalSync: string | null;
  lastFullSync: string | null;
  recentSyncOperations: Array<{
    id: string;
    type: string;
    status: string;
    startedAt: string;
    completedAt: string | null;
    duration: number | null;
    contactsProcessed: number;
    errors: number;
  }>;
}

export default function SyncStatusIndicator() {
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSyncStatus();
    // Refresh status every 5 minutes
    const interval = setInterval(fetchSyncStatus, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchSyncStatus = async () => {
    try {
      const response = await fetch('/api/sync/status');
      if (response.ok) {
        const data = await response.json();
        setSyncStatus(data);
      }
    } catch (error) {
      console.error('Failed to fetch sync status:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center">
        <div className="w-3 h-3 rounded-full bg-gray-300 animate-pulse mr-2"></div>
        <span className="text-xs text-gray-500">Loading...</span>
      </div>
    );
  }

  if (!syncStatus) {
    return (
      <div className="flex items-center">
        <div className="w-3 h-3 rounded-full bg-red-500 mr-2"></div>
        <span className="text-xs text-red-600">Sync Error</span>
      </div>
    );
  }

  const getStatusColor = () => {
    switch (syncStatus.status) {
      case 'green': return 'bg-green-500';
      case 'yellow': return 'bg-yellow-500';
      case 'red': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusTextColor = () => {
    switch (syncStatus.status) {
      case 'green': return 'text-green-600';
      case 'yellow': return 'text-yellow-600';
      case 'red': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return 'N/A';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100 transition-colors"
        title={syncStatus.message}
      >
        <div className={`w-3 h-3 rounded-full ${getStatusColor()}`}></div>
        <span className={`text-xs font-medium ${getStatusTextColor()}`}>
          Sync
        </span>
      </button>

      {showDetails && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
          <div className="p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Sync Status</h3>

            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Status:</span>
                <span className={`font-medium ${getStatusTextColor()}`}>
                  {syncStatus.message}
                </span>
              </div>

              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Total Contacts:</span>
                <span className="font-medium">{syncStatus.totalContacts.toLocaleString()}</span>
              </div>

              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Updated (24h):</span>
                <span className="font-medium">{syncStatus.recentlyUpdated}</span>
              </div>

              {syncStatus.lastIncrementalSync && (
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">Last Incremental:</span>
                  <span className="font-medium">
                    {formatDateTime(syncStatus.lastIncrementalSync)}
                  </span>
                </div>
              )}

              {syncStatus.lastFullSync && (
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">Last Full Sync:</span>
                  <span className="font-medium">
                    {formatDateTime(syncStatus.lastFullSync)}
                  </span>
                </div>
              )}
            </div>

            {syncStatus.recentSyncOperations.length > 0 && (
              <>
                <h4 className="text-xs font-semibold text-gray-900 mb-2">Recent Operations</h4>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {syncStatus.recentSyncOperations.slice(0, 5).map((op) => (
                    <div key={op.id} className="flex justify-between items-center text-xs border-b border-gray-100 pb-1">
                      <div className="flex items-center space-x-2">
                        <span className={`w-2 h-2 rounded-full ${
                          op.status === 'success' ? 'bg-green-400' :
                          op.status === 'failed' ? 'bg-red-400' : 'bg-yellow-400'
                        }`}></span>
                        <span className="capitalize">{op.type}</span>
                      </div>
                      <div className="text-right">
                        <div>{op.contactsProcessed} contacts</div>
                        <div className="text-gray-500">
                          {formatDuration(op.duration)}
                          {op.errors > 0 && ` • ${op.errors} errors`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="mt-3 pt-3 border-t border-gray-200">
              <button
                onClick={fetchSyncStatus}
                className="w-full text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                Refresh Status
              </button>
            </div>
          </div>
        </div>
      )}

      {showDetails && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowDetails(false)}
        />
      )}
    </div>
  );
}