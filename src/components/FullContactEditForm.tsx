// src/components/FullContactEditForm.tsx

import React, { useEffect, useState } from "react";
import { FIELD_MAP } from "@/lib/ghl-api";

// Field type definitions
interface FieldDefinition {
  key: string;
  label: string;
  type: "text" | "email" | "date" | "select" | "radio";
  options?: string[];
}

// Field definitions
const standardFields: FieldDefinition[] = [
  { key: "firstName", label: "First Name", type: "text" },
  { key: "lastName", label: "Last Name", type: "text" },
  { key: "address1", label: "Address 1", type: "text" },
  { key: "city", label: "City", type: "text" },
  { key: "postalCode", label: "Postcode", type: "text" },
  { key: "phone", label: "Telephone", type: "text" },
  { key: "email", label: "Email", type: "email" },
  { key: "source", label: "Contact Source", type: "text" },
];

const customFields: FieldDefinition[] = [
  { key: "membership_start_date", label: "Membership Start Date", type: "date" },
  { key: "membership_type", label: "Membership Type", type: "select", options: ["Full", "Associate", "None", "Newsletter Only", "Ex Member"] },
  { key: "single_or_double_membership", label: "Single or Double Membership", type: "select", options: ["Single", "Double"] },
  { key: "standing_order", label: "Standing Order", type: "radio", options: ["Yes", "No"] },
  { key: "renewal_date", label: "Renewal Date", type: "date" },
  { key: "renewal_reminder", label: "Renewal Reminder", type: "select", options: ["No", "Membership Secretary", "Member", "Both"] },
  { key: "marketing_email_consent", label: "Marketing and Email Consent", type: "select", options: ["Yes", "No"] },
  { key: "gift_aid", label: "Gift Aid", type: "radio", options: ["Yes", "No"] },
  { key: "title", label: "Title", type: "text" },
  { key: "address2", label: "Address 2", type: "text" },
  { key: "address3", label: "Address 3", type: "text" },
];

const fieldOrder = [
  { key: "firstName", type: "standard", section: "Personal Details" },
  { key: "lastName", type: "standard", section: "Personal Details" },
  { key: "title", type: "custom", section: "Personal Details" },
  { key: "address1", type: "standard", section: "Contact Information" },
  { key: "address2", type: "custom", section: "Contact Information" },
  { key: "address3", type: "custom", section: "Contact Information" },
  { key: "city", type: "standard", section: "Contact Information" },
  { key: "postalCode", type: "standard", section: "Contact Information" },
  { key: "phone", type: "standard", section: "Contact Information" },
  { key: "email", type: "standard", section: "Contact Information" },
  { key: "source", type: "standard", section: "Contact Information" },
  { key: "membership_start_date", type: "custom", section: "Membership Details" },
  { key: "membership_type", type: "custom", section: "Membership Details" },
  { key: "single_or_double_membership", type: "custom", section: "Membership Details" },
  { key: "standing_order", type: "custom", section: "Membership Details" },
  { key: "renewal_date", type: "custom", section: "Membership Details" },
  { key: "renewal_reminder", type: "custom", section: "Membership Details" },
  { key: "marketing_email_consent", type: "custom", section: "Preferences" },
  { key: "gift_aid", type: "custom", section: "Preferences" },
];

// Helper: flatten custom fields into editable form state
function flattenCustomFields(contact: any) {
  const flat: Record<string, any> = {};

  // Try both 'customFields' and 'customField' for robustness
  const cf = contact.customFields || contact.customField;

  if (!cf) return flat;

  if (Array.isArray(cf)) {
    cf.forEach((item: any) => {
      const key = FIELD_MAP[item.id] || item.id;
      flat[key] = item.value;
    });
  } else if (typeof cf === "object") {
    Object.entries(cf).forEach(([id, value]) => {
      const key = FIELD_MAP[id] || id;
      flat[key] = value;
    });
  }

  return flat;
}

// Helper: nest custom fields back into GHL object format for DB/API
function nestCustomFields(form: any) {
  const out: Record<string, any> = {};
  Object.entries(FIELD_MAP).forEach(([id, key]) => {
    out[id] = form[key] === "" ? null : form[key];
  });
  return out;
}

export default function FullContactEditForm({
  contact,
  onSave,
  onCancel,
  saving = false,
  error = null,
}: {
  contact: any;
  onSave: (payload: any) => void;
  onCancel?: () => void;
  saving?: boolean;
  error?: string | null;
}) {
  // Build initial form state from contact (top-level + custom fields)
  const [form, setForm] = useState<any>(() => ({
    ...contact,
    ...flattenCustomFields(contact),
  }));

  useEffect(() => {
    setForm({ ...contact, ...flattenCustomFields(contact) });
  }, [contact]);

  // Build payload for save: top-level fields + nested custom fields
  function buildPayload(form: any) {
    const payload: Record<string, any> = {};
    // Standard fields
    standardFields.forEach(f => {
      payload[f.key] = form[f.key] === "" ? null : form[f.key];
    });
    // Custom fields
    payload.customField = nestCustomFields(form);
    // Optionally: also update membershipType if you want it as top-level
    if ("membership_type" in form) payload.membershipType = form["membership_type"];
    // Also include id if present
    if (contact.id) payload.id = contact.id;
    return payload;
  }

  // Group fields by section
  const sections = fieldOrder.reduce((acc, field) => {
    if (!acc[field.section]) {
      acc[field.section] = [];
    }
    acc[field.section].push(field);
    return acc;
  }, {} as Record<string, typeof fieldOrder>);

  return (
    <form
      onSubmit={e => {
        e.preventDefault();
        onSave(buildPayload(form));
      }}
      className="p-6"
    >
        <div className="mb-6">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Complete contact information with membership details
          </p>
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

        <div className="space-y-8">
          {Object.entries(sections).map(([sectionName, sectionFields]) => (
            <div key={sectionName} className="space-y-6">
              <div className="border-b border-gray-200 dark:border-gray-700 pb-2">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                  {sectionName}
                </h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {sectionFields.map(field => {
                  const fieldDef = field.type === "standard" 
                    ? standardFields.find(sf => sf.key === field.key)
                    : customFields.find(cf => cf.key === field.key);

                  if (!fieldDef) return null;

                  const isFullWidth = ['source', 'address1', 'address2', 'address3'].includes(fieldDef.key);

                  return (
                    <div key={fieldDef.key} className={isFullWidth ? 'md:col-span-2' : ''}>
                      <label htmlFor={fieldDef.key} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {fieldDef.label}
                      </label>
                      
                      {fieldDef.type === "text" || fieldDef.type === "email" || fieldDef.type === "date" ? (
                        <input
                          id={fieldDef.key}
                          type={fieldDef.type}
                          value={form[fieldDef.key] || ""}
                          onChange={e => setForm({ ...form, [fieldDef.key]: e.target.value })}
                          disabled={saving}
                          placeholder={fieldDef.type === "date" ? "" : `Enter ${fieldDef.label.toLowerCase()}`}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        />
                      ) : fieldDef.type === "select" ? (
                        <select
                          id={fieldDef.key}
                          value={form[fieldDef.key] || ""}
                          onChange={e => setForm({ ...form, [fieldDef.key]: e.target.value })}
                          disabled={saving}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <option value="">-- Select {fieldDef.label} --</option>
                          {fieldDef.options?.map((opt: string) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : fieldDef.type === "radio" ? (
                        <div className="flex gap-6">
                          {fieldDef.options?.map((opt: string) => (
                            <label key={opt} className="flex items-center gap-2">
                              <input
                                type="radio"
                                name={fieldDef.key}
                                value={opt}
                                checked={form[fieldDef.key] === opt}
                                onChange={() => setForm({ ...form, [fieldDef.key]: opt })}
                                disabled={saving}
                                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 disabled:opacity-50"
                              />
                              <span className="text-sm text-gray-700 dark:text-gray-300">{opt}</span>
                            </label>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700 flex gap-3">
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
        </div>
    </form>
  );
}