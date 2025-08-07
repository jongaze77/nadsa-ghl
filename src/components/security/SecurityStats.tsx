'use client';

import { useState, useEffect } from 'react';

interface SecurityStats {
  [eventType: string]: number;
}

interface SecurityStatsProps {
  refreshTrigger?: number;
}

export default function SecurityStats({ refreshTrigger }: SecurityStatsProps) {
  const [stats, setStats] = useState<SecurityStats>({});
  const [timeframe, setTimeframe] = useState<'day' | 'week' | 'month'>('day');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/security-events/stats?timeframe=${timeframe}`);
      if (!response.ok) {
        throw new Error('Failed to fetch security stats');
      }
      
      const data = await response.json();
      setStats(data.stats);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [timeframe, refreshTrigger]);

  const formatEventType = (type: string) => {
    const typeMap: Record<string, string> = {
      'failed_login': 'Failed Logins',
      'successful_login_after_failures': 'Logins After Failures',
      'new_ip_login': 'New IP Logins',
      'suspicious_pattern': 'Suspicious Patterns'
    };
    return typeMap[type] || type;
  };

  const getEventIcon = (type: string) => {
    const iconMap: Record<string, string> = {
      'failed_login': '🚫',
      'successful_login_after_failures': '⚠️',
      'new_ip_login': '🌍',
      'suspicious_pattern': '🔍'
    };
    return iconMap[type] || '📊';
  };

  const getTotalEvents = () => {
    return Object.values(stats).reduce((sum, count) => sum + count, 0);
  };

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-lg border">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white p-6 rounded-lg border">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          Error: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg border space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900">Security Events Overview</h3>
        <select 
          value={timeframe}
          onChange={(e) => setTimeframe(e.target.value as 'day' | 'week' | 'month')}
          className="border border-gray-300 rounded-md px-3 py-1 text-sm"
        >
          <option value="day">Last 24 Hours</option>
          <option value="week">Last Week</option>
          <option value="month">Last Month</option>
        </select>
      </div>

      {Object.keys(stats).length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No security events in the selected timeframe.
        </div>
      ) : (
        <>
          {/* Total Events Summary */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">{getTotalEvents()}</div>
              <div className="text-sm text-blue-600 font-medium">
                Total Security Events ({timeframe === 'day' ? '24h' : timeframe === 'week' ? '7d' : '30d'})
              </div>
            </div>
          </div>

          {/* Individual Event Type Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(stats).map(([eventType, count]) => (
              <div key={eventType} className="border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">{getEventIcon(eventType)}</span>
                    <div>
                      <div className="font-medium text-gray-900">
                        {formatEventType(eventType)}
                      </div>
                      <div className="text-sm text-gray-500">
                        {eventType}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-gray-900">{count}</div>
                    {getTotalEvents() > 0 && (
                      <div className="text-xs text-gray-500">
                        {((count / getTotalEvents()) * 100).toFixed(1)}%
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Quick Insights */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-2">Quick Insights</h4>
            <div className="text-sm text-gray-600 space-y-1">
              {stats['failed_login'] > 10 && (
                <div className="flex items-center space-x-2">
                  <span className="text-red-500">⚠️</span>
                  <span>High number of failed login attempts detected</span>
                </div>
              )}
              {stats['new_ip_login'] > 0 && (
                <div className="flex items-center space-x-2">
                  <span className="text-blue-500">ℹ️</span>
                  <span>New IP addresses detected for user logins</span>
                </div>
              )}
              {stats['successful_login_after_failures'] > 0 && (
                <div className="flex items-center space-x-2">
                  <span className="text-yellow-500">⚠️</span>
                  <span>Successful logins after failed attempts detected</span>
                </div>
              )}
              {Object.keys(stats).length === 0 && (
                <div className="flex items-center space-x-2">
                  <span className="text-green-500">✅</span>
                  <span>No security events - system appears secure</span>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}