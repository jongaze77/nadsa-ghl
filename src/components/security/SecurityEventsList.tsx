'use client';

import { useState, useEffect } from 'react';

interface SecurityEvent {
  id: string;
  eventType: string;
  userId: number | null;
  username: string;
  ipAddress: string;
  userAgent: string | null;
  timestamp: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  context: any;
  notificationSent: boolean;
  user: {
    id: number;
    username: string;
    role: string;
  } | null;
}

interface SecurityEventsListProps {
  refreshTrigger?: number;
}

export default function SecurityEventsList({ refreshTrigger }: SecurityEventsListProps) {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    eventType: '',
    severity: '',
    limit: 50,
    offset: 0
  });

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.eventType) params.append('eventType', filters.eventType);
      if (filters.severity) params.append('severity', filters.severity);
      params.append('limit', filters.limit.toString());
      params.append('offset', filters.offset.toString());

      const response = await fetch(`/api/admin/security-events?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch security events');
      }
      
      const data = await response.json();
      setEvents(data.events);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [filters, refreshTrigger]);

  const formatEventType = (type: string) => {
    const typeMap: Record<string, string> = {
      'failed_login': 'Failed Login',
      'successful_login_after_failures': 'Login After Failures',
      'new_ip_login': 'New IP Login',
      'suspicious_pattern': 'Suspicious Pattern'
    };
    return typeMap[type] || type;
  };

  const getSeverityColor = (severity: string) => {
    const colorMap: Record<string, string> = {
      'low': 'text-green-600 bg-green-100',
      'medium': 'text-yellow-600 bg-yellow-100',
      'high': 'text-orange-600 bg-orange-100',
      'critical': 'text-red-600 bg-red-100'
    };
    return colorMap[severity] || 'text-gray-600 bg-gray-100';
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="text-lg">Loading security events...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white p-4 rounded-lg border space-y-4">
        <h3 className="text-lg font-medium">Filters</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Event Type
            </label>
            <select 
              value={filters.eventType}
              onChange={(e) => setFilters(prev => ({ ...prev, eventType: e.target.value, offset: 0 }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="">All Types</option>
              <option value="failed_login">Failed Login</option>
              <option value="successful_login_after_failures">Login After Failures</option>
              <option value="new_ip_login">New IP Login</option>
              <option value="suspicious_pattern">Suspicious Pattern</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Severity
            </label>
            <select 
              value={filters.severity}
              onChange={(e) => setFilters(prev => ({ ...prev, severity: e.target.value, offset: 0 }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="">All Severities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Limit
            </label>
            <select 
              value={filters.limit}
              onChange={(e) => setFilters(prev => ({ ...prev, limit: parseInt(e.target.value), offset: 0 }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
          </div>
        </div>
      </div>

      {/* Events List */}
      {events.length === 0 ? (
        <div className="bg-white p-8 rounded-lg border text-center text-gray-500">
          No security events found.
        </div>
      ) : (
        <div className="space-y-2">
          {events.map((event) => (
            <div key={event.id} className="bg-white border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(event.severity)}`}>
                    {event.severity.toUpperCase()}
                  </span>
                  <span className="font-medium text-gray-900">
                    {formatEventType(event.eventType)}
                  </span>
                  {event.notificationSent && (
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                      Notified
                    </span>
                  )}
                </div>
                <span className="text-sm text-gray-500">
                  {formatTimestamp(event.timestamp)}
                </span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-700">Username:</span>
                  <span className="ml-2 text-gray-900">{event.username}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">IP Address:</span>
                  <span className="ml-2 text-gray-900">{event.ipAddress}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">User Agent:</span>
                  <span className="ml-2 text-gray-900 truncate block">
                    {event.userAgent || 'Unknown'}
                  </span>
                </div>
              </div>
              
              {event.context && Object.keys(event.context).length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <details className="text-sm">
                    <summary className="font-medium text-gray-700 cursor-pointer">
                      Additional Context
                    </summary>
                    <pre className="mt-2 p-3 bg-gray-50 rounded text-xs overflow-x-auto">
                      {JSON.stringify(event.context, null, 2)}
                    </pre>
                  </details>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      <div className="flex justify-between items-center">
        <button
          onClick={() => setFilters(prev => ({ ...prev, offset: Math.max(0, prev.offset - prev.limit) }))}
          disabled={filters.offset === 0}
          className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        
        <span className="text-sm text-gray-700">
          Showing {filters.offset + 1} - {filters.offset + events.length}
        </span>
        
        <button
          onClick={() => setFilters(prev => ({ ...prev, offset: prev.offset + prev.limit }))}
          disabled={events.length < filters.limit}
          className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>
  );
}