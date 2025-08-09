// src/components/FullContactEditForm.tsx

import React, { useEffect, useState } from "react";
import { FIELD_MAP } from "@/lib/ghl-api";
import NotesSection from "./NotesSection";

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
  { key: "membership_payment_date", label: "Membership Payment Date", type: "date" },
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
  { key: "membership_payment_date", type: "custom", section: "Membership Details" },
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
  
  // Form validation state
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);

  useEffect(() => {
    setForm({ ...contact, ...flattenCustomFields(contact) });
    setFieldErrors({});
    setIsDirty(false);
  }, [contact]);

  // Field validation functions
  const validateField = (key: string, value: any): string | null => {
    if (!value || value.toString().trim() === '') {
      // Only validate required fields
      if (['firstName', 'lastName', 'email'].includes(key)) {
        return `${standardFields.find(f => f.key === key)?.label || key} is required`;
      }
      return null;
    }

    // Email validation
    if (key === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        return 'Please enter a valid email address';
      }
    }

    // Phone validation (basic)
    if (key === 'phone') {
      const phoneRegex = /^[\+]?[\d\s\-\(\)]{7,}$/;
      if (!phoneRegex.test(value)) {
        return 'Please enter a valid phone number';
      }
    }

    // Date validation
    if (standardFields.find(f => f.key === key && f.type === 'date') || 
        customFields.find(f => f.key === key && f.type === 'date')) {
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        return 'Please enter a valid date';
      }
    }

    // Postcode validation (basic UK format)
    if (key === 'postalCode' && value) {
      const postcodeRegex = /^[A-Z]{1,2}[0-9][A-Z0-9]?\s?[0-9][A-Z]{2}$/i;
      if (!postcodeRegex.test(value)) {
        return 'Please enter a valid UK postcode (e.g., SW1A 1AA)';
      }
    }

    return null;
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    let isValid = true;

    // Validate all fields
    [...standardFields, ...customFields].forEach(fieldDef => {
      const error = validateField(fieldDef.key, form[fieldDef.key]);
      if (error) {
        errors[fieldDef.key] = error;
        isValid = false;
      }
    });

    console.log('🔍 Validation results:', { errors, isValid, fieldCount: [...standardFields, ...customFields].length });
    setFieldErrors(errors);
    return isValid;
  };

  const handleFieldChange = (key: string, value: any) => {
    setForm((prev: any) => ({ ...prev, [key]: value }));
    setIsDirty(true);
    
    // Clear field error when user starts typing
    if (fieldErrors[key]) {
      setFieldErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[key];
        return newErrors;
      });
    }

    // Real-time validation for this field
    const error = validateField(key, value);
    if (error) {
      setFieldErrors(prev => ({ ...prev, [key]: error }));
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('🔵 Form submission triggered - validating form');
    
    // Validate form before submission
    if (!validateForm()) {
      console.log('❌ Form validation failed - not submitting');
      return;
    }
    
    console.log('✅ Form validation passed - calling onSave');
    onSave(buildPayload(form));
    setIsDirty(false);
  };

  const handleCancel = () => {
    if (isDirty && !showUnsavedWarning) {
      setShowUnsavedWarning(true);
      return;
    }
    setIsDirty(false);
    setShowUnsavedWarning(false);
    onCancel?.();
  };

  const confirmCancel = () => {
    setIsDirty(false);
    setShowUnsavedWarning(false);
    onCancel?.();
  };

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
    <div className="max-h-[calc(90vh-8rem)] overflow-y-auto">
      <form
        onSubmit={handleFormSubmit}
        className="p-6 space-y-8"
        noValidate
      >
        {/* Form Header */}
        <div className="pb-4 border-b border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Manage complete contact information including membership details and notes
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-red-400 mt-0.5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-300">Error</h3>
                <p className="mt-1 text-sm text-red-700 dark:text-red-400">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Form Sections */}
        <div className="space-y-8">
          {Object.entries(sections).map(([sectionName, sectionFields]) => (
            <section key={sectionName} className="space-y-6">
              {/* Section Header */}
              <div className="flex items-center gap-3 pb-3 border-b border-gray-200 dark:border-gray-700">
                {/* Section Icons */}
                {sectionName === "Personal Details" && (
                  <div className="flex items-center justify-center w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                )}
                {sectionName === "Contact Information" && (
                  <div className="flex items-center justify-center w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-lg">
                    <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                )}
                {sectionName === "Membership Details" && (
                  <div className="flex items-center justify-center w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                    <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                )}
                {sectionName === "Preferences" && (
                  <div className="flex items-center justify-center w-8 h-8 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                    <svg className="w-4 h-4 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                )}
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {sectionName}
                </h3>
              </div>
              
              {/* Section Fields Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {sectionFields.map(field => {
                  const fieldDef = field.type === "standard" 
                    ? standardFields.find(sf => sf.key === field.key)
                    : customFields.find(cf => cf.key === field.key);

                  if (!fieldDef) return null;

                  const isFullWidth = ['source', 'address1', 'address2', 'address3', 'email'].includes(fieldDef.key);
                  const isTwoColumns = ['membership_type', 'single_or_double_membership', 'renewal_reminder'].includes(fieldDef.key);

                  return (
                    <div key={fieldDef.key} className={`space-y-2 ${
                      isFullWidth ? 'lg:col-span-2 xl:col-span-3' : 
                      isTwoColumns ? 'lg:col-span-2' : ''
                    }`}>
                      <label htmlFor={fieldDef.key} className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        {fieldDef.label}
                        {['firstName', 'lastName', 'email'].includes(fieldDef.key) && (
                          <span className="ml-1 text-red-500">*</span>
                        )}
                        {fieldDef.key === 'membership_payment_date' && (
                          <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">(Latest payment)</span>
                        )}
                      </label>
                      
                      {fieldDef.type === "text" || fieldDef.type === "email" || fieldDef.type === "date" ? (
                        <div>
                          <input
                            id={fieldDef.key}
                            type={fieldDef.type}
                            value={form[fieldDef.key] || ""}
                            onChange={e => handleFieldChange(fieldDef.key, e.target.value)}
                            disabled={saving}
                            placeholder={fieldDef.type === "date" ? "" : `Enter ${fieldDef.label.toLowerCase()}`}
                            aria-invalid={fieldErrors[fieldDef.key] ? 'true' : 'false'}
                            aria-describedby={fieldErrors[fieldDef.key] ? `${fieldDef.key}-error` : undefined}
                            className={`w-full px-4 py-3 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:border-gray-400 dark:hover:border-gray-500 ${
                              fieldErrors[fieldDef.key] 
                                ? 'border-red-300 dark:border-red-600 focus:ring-red-500 focus:border-red-500' 
                                : 'border-gray-300 dark:border-gray-600'
                            }`}
                          />
                          {fieldErrors[fieldDef.key] && (
                            <p id={`${fieldDef.key}-error`} className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center">
                              <svg className="w-4 h-4 mr-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {fieldErrors[fieldDef.key]}
                            </p>
                          )}
                        </div>
                      ) : fieldDef.type === "select" ? (
                        <div>
                          <select
                            id={fieldDef.key}
                            value={form[fieldDef.key] || ""}
                            onChange={e => handleFieldChange(fieldDef.key, e.target.value)}
                            disabled={saving}
                            aria-invalid={fieldErrors[fieldDef.key] ? 'true' : 'false'}
                            aria-describedby={fieldErrors[fieldDef.key] ? `${fieldDef.key}-error` : undefined}
                            className={`w-full px-4 py-3 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:border-gray-400 dark:hover:border-gray-500 ${
                              fieldErrors[fieldDef.key] 
                                ? 'border-red-300 dark:border-red-600 focus:ring-red-500 focus:border-red-500' 
                                : 'border-gray-300 dark:border-gray-600'
                            }`}
                          >
                            <option value="">-- Select {fieldDef.label} --</option>
                            {fieldDef.options?.map((opt: string) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                          {fieldErrors[fieldDef.key] && (
                            <p id={`${fieldDef.key}-error`} className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center">
                              <svg className="w-4 h-4 mr-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {fieldErrors[fieldDef.key]}
                            </p>
                          )}
                        </div>
                      ) : fieldDef.type === "radio" ? (
                        <div>
                          <div className="flex flex-wrap gap-6">
                            {fieldDef.options?.map((opt: string) => (
                              <label key={opt} className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="radio"
                                  name={fieldDef.key}
                                  value={opt}
                                  checked={form[fieldDef.key] === opt}
                                  onChange={() => handleFieldChange(fieldDef.key, opt)}
                                  disabled={saving}
                                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 disabled:opacity-50"
                                />
                                <span className="text-sm text-gray-700 dark:text-gray-300 select-none">{opt}</span>
                              </label>
                            ))}
                          </div>
                          {fieldErrors[fieldDef.key] && (
                            <p id={`${fieldDef.key}-error`} className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center">
                              <svg className="w-4 h-4 mr-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {fieldErrors[fieldDef.key]}
                            </p>
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
          
          {/* Notes Section */}
          <NotesSection contactId={contact.id} />
        </div>
      </form>

      {/* Action Buttons - Sticky Footer */}
      <div className="sticky bottom-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-6 py-4">
        {/* Unsaved Changes Warning */}
        {showUnsavedWarning && (
          <div className="mb-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-yellow-400 mt-0.5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.664-.833-2.464 0L4.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-300">Unsaved Changes</h3>
                <p className="mt-1 text-sm text-yellow-700 dark:text-yellow-400">
                  You have unsaved changes. Are you sure you want to leave without saving?
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={confirmCancel}
                    className="text-sm bg-yellow-100 hover:bg-yellow-200 dark:bg-yellow-800 dark:hover:bg-yellow-700 text-yellow-800 dark:text-yellow-200 px-3 py-1 rounded transition-colors"
                  >
                    Yes, discard changes
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowUnsavedWarning(false)}
                    className="text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 px-3 py-1 rounded transition-colors"
                  >
                    Keep editing
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Validation Summary */}
        {Object.keys(fieldErrors).length > 0 && (
          <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-red-400 mt-0.5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-300">
                  Please fix the following errors:
                </h3>
                <ul className="mt-2 text-sm text-red-700 dark:text-red-400 list-disc list-inside">
                  {Object.entries(fieldErrors).map(([field, error]) => (
                    <li key={field}>{error}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={handleCancel}
            disabled={saving}
            className="inline-flex items-center px-6 py-3 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:disabled:bg-gray-800 dark:text-gray-300 font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Cancel
            {isDirty && !showUnsavedWarning && (
              <span className="ml-1 w-2 h-2 bg-yellow-400 rounded-full" title="Unsaved changes" />
            )}
          </button>
          <button
            type="submit"
            disabled={saving || Object.keys(fieldErrors).length > 0}
            className="inline-flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
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
                {isDirty && (
                  <span className="ml-1 w-2 h-2 bg-green-400 rounded-full" title="Has changes to save" />
                )}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}