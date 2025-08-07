'use client';

import { useState, useEffect } from 'react';

interface EmailConfig {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  fromAddress: string;
  fromName: string;
  adminEmails: string[];
}

interface SecurityConfig {
  enabled: boolean;
  throttleMinutes: number;
  severityThreshold: string;
}

interface ConfigData {
  email: EmailConfig;
  securityNotifications: SecurityConfig;
}

export default function SecurityConfig() {
  const [config, setConfig] = useState<ConfigData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testingEmail, setTestingEmail] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/security-events/config');
      if (!response.ok) {
        throw new Error('Failed to fetch security config');
      }
      
      const data = await response.json();
      setConfig(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const testEmailConfig = async () => {
    try {
      setTestingEmail(true);
      setTestResult(null);
      
      const response = await fetch('/api/admin/security-events/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'test-email' }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to test email configuration');
      }
      
      const result = await response.json();
      setTestResult(result);
    } catch (err) {
      setTestResult({
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error'
      });
    } finally {
      setTestingEmail(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

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

  if (error || !config) {
    return (
      <div className="bg-white p-6 rounded-lg border">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          Error: {error || 'No configuration data available'}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg border space-y-6">
      <h3 className="text-lg font-medium text-gray-900">Security Notification Configuration</h3>

      {/* Security Notifications Settings */}
      <div className="space-y-4">
        <h4 className="text-md font-medium text-gray-800">Notification Settings</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Status
            </label>
            <div className={`px-3 py-2 rounded-md text-sm font-medium ${
              config.securityNotifications.enabled 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              {config.securityNotifications.enabled ? 'Enabled' : 'Disabled'}
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Throttle Period
            </label>
            <div className="px-3 py-2 bg-gray-50 rounded-md text-sm">
              {config.securityNotifications.throttleMinutes} minutes
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Severity Threshold
            </label>
            <div className="px-3 py-2 bg-gray-50 rounded-md text-sm capitalize">
              {config.securityNotifications.severityThreshold}
            </div>
          </div>
        </div>
        
        <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-md">
          <strong>Note:</strong> These settings are configured via environment variables. 
          Contact your system administrator to modify these values.
        </div>
      </div>

      {/* Email Configuration */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h4 className="text-md font-medium text-gray-800">Email Configuration</h4>
          <button
            onClick={testEmailConfig}
            disabled={testingEmail || !config.email.enabled}
            className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {testingEmail ? 'Testing...' : 'Test Email'}
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Status
            </label>
            <div className={`px-3 py-2 rounded-md text-sm font-medium ${
              config.email.enabled 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              {config.email.enabled ? 'Enabled' : 'Disabled'}
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              SMTP Host
            </label>
            <div className="px-3 py-2 bg-gray-50 rounded-md text-sm font-mono">
              {config.email.host}
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Port & Security
            </label>
            <div className="px-3 py-2 bg-gray-50 rounded-md text-sm">
              {config.email.port} {config.email.secure ? '(Secure)' : '(Non-secure)'}
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              From Address
            </label>
            <div className="px-3 py-2 bg-gray-50 rounded-md text-sm font-mono">
              {config.email.fromName} &lt;{config.email.fromAddress}&gt;
            </div>
          </div>
        </div>
        
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Admin Email Recipients ({config.email.adminEmails.length})
          </label>
          {config.email.adminEmails.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {config.email.adminEmails.map((email, index) => (
                <span
                  key={index}
                  className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full font-mono"
                >
                  {email}
                </span>
              ))}
            </div>
          ) : (
            <div className="px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-md text-sm text-yellow-800">
              No admin emails configured. Notifications will not be sent.
            </div>
          )}
        </div>

        {/* Test Result */}
        {testResult && (
          <div className={`p-4 rounded-md ${
            testResult.success 
              ? 'bg-green-50 border border-green-200' 
              : 'bg-red-50 border border-red-200'
          }`}>
            <div className="flex items-center space-x-2">
              <span className={testResult.success ? 'text-green-500' : 'text-red-500'}>
                {testResult.success ? '✅' : '❌'}
              </span>
              <span className={`text-sm font-medium ${
                testResult.success ? 'text-green-800' : 'text-red-800'
              }`}>
                {testResult.success 
                  ? 'Email configuration test successful!' 
                  : 'Email configuration test failed'
                }
              </span>
            </div>
            {testResult.error && (
              <div className="mt-2 text-sm text-red-600">
                Error: {testResult.error}
              </div>
            )}
          </div>
        )}

        <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-md">
          <strong>Configuration:</strong> Email settings are managed via environment variables:
          <br />
          <code className="text-xs font-mono bg-white px-1 rounded">
            SMTP_HOST, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD, ADMIN_EMAIL_ADDRESSES
          </code>
        </div>
      </div>
    </div>
  );
}