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
      className="w-full max-w-2xl bg-gray-100 p-6 rounded-lg border-2 border-black mb-8"
      style={{ fontSize: "1.25rem" }}
      onSubmit={e => {
        e.preventDefault();
        onSave();
      }}
    >
      <h2 className="text-2xl font-bold mb-4">Edit Contact Details</h2>
      {error && <div className="mb-4 p-2 bg-red-100 text-red-700 rounded">{error}</div>}
      {FIELDS.map(field => (
        <div className="mb-4" key={field.key}>
          <label className="block font-semibold mb-1" htmlFor={field.key}>
            {field.label}
          </label>
          {field.type === "select" ? (
            <select
              id={field.key}
              name={field.key}
              className="w-full p-3 border-2 border-black rounded-lg focus:outline-none focus:ring-4 focus:ring-blue-400"
              value={form[field.key] || ""}
              onChange={e => setForm({ ...form, [field.key]: e.target.value })}
            >
              <option value="">-- Select --</option>
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
              className="w-full p-3 border-2 border-black rounded-lg focus:outline-none focus:ring-4 focus:ring-blue-400"
              value={form[field.key] || ""}
              onChange={e => setForm({ ...form, [field.key]: e.target.value })}
            />
          )}
        </div>
      ))}
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