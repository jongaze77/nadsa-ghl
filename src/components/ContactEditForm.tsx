import React from "react";

interface ContactEditFormProps {
  form: any;
  setForm: (form: any) => void;
  saving: boolean;
  error: string | null;
  onSave: () => void;
  onCancel?: () => void;
}

const FIELDS = [
  { key: "firstName", label: "First Name", type: "text" },
  { key: "lastName", label: "Last Name", type: "text" },
  { key: "email", label: "Email", type: "email" },
  { key: "phone", label: "Phone", type: "tel" },
  { key: "membershipType", label: "Membership Type", type: "select", options: ["Full", "Associate", "Newsletter Only", "Ex Member"] },
  { key: "companyName", label: "Company Name", type: "text" },
  { key: "address1", label: "Address Line 1", type: "text" },
  { key: "address2", label: "Address Line 2", type: "text" },
  { key: "city", label: "City", type: "text" },
  { key: "state", label: "State", type: "text" },
  { key: "postalCode", label: "Postal Code", type: "text" },
  { key: "country", label: "Country", type: "text" },
  { key: "website", label: "Website", type: "url" },
];

export default function ContactEditForm({
  form,
  setForm,
  saving,
  error,
  onSave,
  onCancel,
}: ContactEditFormProps) {
  return (
    <form
      onSubmit={e => {
        e.preventDefault();
        onSave();
      }}
      className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6"
    >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Edit Contact Details
          </h2>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-red-400 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-300">Error</h3>
                <p className="mt-1 text-sm text-red-700 dark:text-red-400">{error}</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {FIELDS.map(field => (
            <div key={field.key} className={field.key === 'website' || field.key === 'companyName' ? 'md:col-span-2' : ''}>
              <label htmlFor={field.key} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {field.label}
              </label>
              {field.type === "select" ? (
                <select
                  id={field.key}
                  name={field.key}
                  value={form[field.key] || ""}
                  onChange={e => setForm({ ...form, [field.key]: e.target.value })}
                  disabled={saving}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <option value="">-- Select {field.label} --</option>
                  {field.options?.map(opt => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id={field.key}
                  type={field.type}
                  name={field.key}
                  value={form[field.key] || ""}
                  onChange={e => setForm({ ...form, [field.key]: e.target.value })}
                  disabled={saving}
                  placeholder={`Enter ${field.label.toLowerCase()}`}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                />
              )}
            </div>
          ))}
        </div>

        <div className="mt-8 flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Save Changes
              </>
            )}
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="inline-flex items-center px-4 py-2 bg-gray-500 hover:bg-gray-600 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Cancel
            </button>
          )}
        </div>
    </form>
  );
}