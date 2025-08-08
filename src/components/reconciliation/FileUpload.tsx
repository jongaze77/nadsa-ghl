'use client';

// Placeholder component for future file upload functionality

export default function FileUpload() {
  return (
    <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-12 text-center">
      <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
        <span className="text-2xl">📁</span>
      </div>
      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
        File Upload Component
      </h3>
      <p className="text-gray-600 dark:text-gray-400 mb-4">
        This component will handle CSV file uploads for bank statements and Stripe reports.
      </p>
      <div className="text-sm text-gray-500 dark:text-gray-400">
        Coming in Story 1.10: File upload implementation
      </div>
    </div>
  );
}