'use client';

import type React from 'react';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface ExportPreview {
  count: number;
  criteria: string;
}

export default function DataImportExportPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportPreview, setExportPreview] = useState<ExportPreview | null>(null);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  useEffect(() => {
    if (!session) {
      router.push('/login');
      return;
    }
    
    if (session.user.role !== 'admin') {
      router.push('/');
      return;
    }
    
    // Load export preview on page load
    loadExportPreview();
  }, [session, router]);

  const loadExportPreview = async () => {
    try {
      setError('');
      const response = await fetch('/api/admin/export/wordpress-users?preview=true');
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load export preview');
      }
      
      const data = await response.json();
      setExportPreview(data);
    } catch (err: any) {
      console.error('Error loading export preview:', err);
      setError(err.message || 'Failed to load export preview');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      setError('');
      setSuccess('');
      
      const response = await fetch('/api/admin/export/wordpress-users');
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Export failed');
      }
      
      // Create blob from response and trigger download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `wordpress-users-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      setSuccess(`Successfully exported ${exportPreview?.count || 0} users to CSV file`);
    } catch (err: any) {
      console.error('Export error:', err);
      setError(err.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const clearMessages = () => {
    setError('');
    setSuccess('');
  };

  if (!session) return null;
  if (session.user.role !== 'admin') return null;
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-500 dark:text-gray-400">Loading export options...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Data Import/Export</h1>
              <p className="mt-2 text-gray-600 dark:text-gray-400">
                Export contact data for integration with external systems
              </p>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-red-400 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-300">Export Error</h3>
                <p className="mt-1 text-sm text-red-700 dark:text-red-400">{error}</p>
                <button
                  onClick={clearMessages}
                  className="mt-3 text-sm bg-red-100 dark:bg-red-800 text-red-800 dark:text-red-200 px-3 py-1 rounded hover:bg-red-200 dark:hover:bg-red-700 transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="mb-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-green-400 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-green-800 dark:text-green-300">Export Successful</h3>
                <p className="mt-1 text-sm text-green-700 dark:text-green-400">{success}</p>
                <button
                  onClick={clearMessages}
                  className="mt-3 text-sm bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200 px-3 py-1 rounded hover:bg-green-200 dark:hover:bg-green-700 transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {/* WordPress User Export Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                WordPress User Export
              </h3>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                CSV Format
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="mb-6">
              <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">Export Criteria</h4>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <li className="flex items-center">
                  <svg className="w-4 h-4 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Membership Type = &quot;Full&quot;
                </li>
                <li className="flex items-center">
                  <svg className="w-4 h-4 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Renewal Date ≥ Today
                </li>
              </ul>
            </div>

            <div className="mb-6">
              <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">Export Format</h4>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                <p className="mb-2">CSV file with columns: user_login, user_email, role, first_name, last_name</p>
                <p>Role mapping: Single membership → &quot;subscriber,Single Member&quot;, Double membership → &quot;subscriber,Double Member&quot;</p>
              </div>
            </div>

            {/* Export Preview */}
            {exportPreview && (
              <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-blue-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <h4 className="text-sm font-medium text-blue-900 dark:text-blue-300">Ready for Export</h4>
                    <p className="text-sm text-blue-700 dark:text-blue-400">
                      {exportPreview.count} contact{exportPreview.count !== 1 ? 's' : ''} match{exportPreview.count === 1 ? 'es' : ''} the export criteria
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Export Button */}
            <div className="flex gap-3">
              <button
                onClick={handleExport}
                disabled={exporting || !exportPreview || exportPreview.count === 0}
                className={`inline-flex items-center px-4 py-2 font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                  exporting || !exportPreview || exportPreview.count === 0
                    ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500'
                }`}
              >
                {exporting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generating Export...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Export to CSV
                  </>
                )}
              </button>
              
              <button
                onClick={loadExportPreview}
                disabled={exporting}
                className="inline-flex items-center px-4 py-2 bg-gray-500 hover:bg-gray-600 disabled:bg-gray-300 disabled:text-gray-500 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh Preview
              </button>
            </div>

            {exportPreview && exportPreview.count === 0 && (
              <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-yellow-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.867-.833-2.636 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <div>
                    <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-300">No Records to Export</h4>
                    <p className="text-sm text-yellow-700 dark:text-yellow-400">
                      No contacts currently match the export criteria. Check that you have Full members with current renewal dates.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>
            Export functionality is restricted to administrators. Exported data should be handled securely.
          </p>
        </div>
      </div>
    </div>
  );
}