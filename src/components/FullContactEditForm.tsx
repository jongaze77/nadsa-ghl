// src/components/FullContactEditForm.tsx

import React, { useEffect, useState } from "react";
import { FIELD_MAP } from "@/lib/ghl-api";

// Field definitions
const standardFields = [
  { key: "firstName", label: "First Name", type: "text" },
  { key: "lastName", label: "Last Name", type: "text" },
  { key: "address1", label: "Address 1", type: "text" },
  { key: "city", label: "City", type: "text" },
  { key: "postalCode", label: "Postcode", type: "text" },
  { key: "phone", label: "Telephone", type: "text" },
  { key: "email", label: "Email", type: "email" },
  { key: "source", label: "Contact Source", type: "text" },
];

const customFields = [
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
  { key: "firstName", type: "standard" },
  { key: "lastName", type: "standard" },
  { key: "title", type: "custom" },
  { key: "address1", type: "standard" },
  { key: "address2", type: "custom" },
  { key: "address3", type: "custom" },
  { key: "city", type: "standard" },
  { key: "postalCode", type: "standard" },
  { key: "phone", type: "standard" },
  { key: "email", type: "standard" },
  { key: "source", type: "standard" },
  { key: "membership_start_date", type: "custom" },
  { key: "membership_type", type: "custom" },
  { key: "single_or_double_membership", type: "custom" },
  { key: "standing_order", type: "custom" },
  { key: "renewal_date", type: "custom" },
  { key: "renewal_reminder", type: "custom" },
  { key: "marketing_email_consent", type: "custom" },
  { key: "gift_aid", type: "custom" },
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

  return (
    <form
      className="w-full max-w-2xl bg-gray-100 p-6 rounded-lg border-2 border-black mb-8"
      style={{ fontSize: "1.25rem" }}
      onSubmit={e => {
        e.preventDefault();
        onSave(buildPayload(form));
      }}
    >
      <h2 className="text-2xl font-bold mb-4">Edit Contact Details</h2>
      {error && (
        <div className="mb-4 p-2 bg-red-100 text-red-700 rounded">{error}</div>
      )}
      {fieldOrder.map(field => {
        if (field.type === "standard") {
          const f = standardFields.find(sf => sf.key === field.key);
          if (!f) return null;
          return (
            <div className="mb-4" key={f.key}>
              <label className="block font-semibold mb-1" htmlFor={f.key}>
                {f.label}
              </label>
              <input
                id={f.key}
                type={f.type}
                className="w-full p-3 border-2 border-black rounded-lg focus:outline-none focus:ring-4 focus:ring-blue-400"
                value={form[f.key] || ""}
                onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                aria-label={f.label}
                disabled={saving}
              />
            </div>
          );
        }
        if (field.type === "custom") {
          const f = customFields.find(cf => cf.key === field.key);
          if (!f) return null;
          return (
            <div className="mb-4" key={f.key}>
              <label className="block font-semibold mb-1" htmlFor={f.key}>
                {f.label}
              </label>
              {f.type === "text" || f.type === "date" ? (
                <input
                  id={f.key}
                  type={f.type}
                  className="w-full p-3 border-2 border-black rounded-lg focus:outline-none focus:ring-4 focus:ring-blue-400"
                  value={form[f.key] || ""}
                  onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                  aria-label={f.label}
                  disabled={saving}
                />
              ) : f.type === "select" ? (
                <select
                  id={f.key}
                  className="w-full p-3 border-2 border-black rounded-lg focus:outline-none focus:ring-4 focus:ring-blue-400"
                  value={form[f.key] || ""}
                  onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                  aria-label={f.label}
                  disabled={saving}
                >
                  <option value="">-- Select --</option>
                  {f.options?.map(opt => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : f.type === "radio" ? (
                <div className="flex gap-6">
                  {f.options?.map(opt => (
                    <label key={opt} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={f.key}
                        value={opt}
                        checked={form[f.key] === opt}
                        onChange={() => setForm({ ...form, [f.key]: opt })}
                        aria-label={opt}
                        disabled={saving}
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              ) : null}
            </div>
          );
        }
        return null;
      })}
      <div className="mt-8 flex gap-4">
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2 border rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}