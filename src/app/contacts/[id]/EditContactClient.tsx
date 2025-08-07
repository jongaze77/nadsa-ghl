'use client';

import { useState, useEffect } from 'react';
import type { Contact } from '.prisma/client';
import FullContactEditForm from "@/components/FullContactEditForm";
import { FIELD_MAP } from "@/lib/ghl-api";

interface CustomField {
  id: string;
  value: string | null;
}

// Build payload with empty strings set to null
function buildPayload(form: any) {
  const payload: Record<string, any> = {};
  Object.keys(form).forEach((key) => {
    // Always send all fields; use null if blank
    const value = form[key];
    payload[key] = value === '' ? null : value;
  });
  return payload;
}

export default function EditContactClient({
  id,
  contact,
  formData: initialFormData,
}: {
  id: string;
  contact: Contact;
  formData: any;
}) {
  const [formData, setFormData] = useState(initialFormData);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (contact) {
      const f = { ...contact };
      if (contact.customFields) {
        const cf = contact.customFields;
        if (Array.isArray(cf)) {
          (cf as unknown as CustomField[]).forEach((field) => {
            if (field.id && field.value !== undefined) {
              const mappedKey = FIELD_MAP[field.id] || field.id;
              (f as any)[mappedKey] = field.value;
            }
          });
        } else if (typeof cf === 'object') {
          Object.entries(cf).forEach(([key, value]) => {
            const mappedKey = FIELD_MAP[key] || key;
            (f as any)[mappedKey] = value;
          });
        }
      }
      setFormData(f);
    }
  }, [contact]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = buildPayload(formData);
      const response = await fetch(`/api/contacts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error('Failed to update contact');
      // Optionally redirect or show success message
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Edit Contact</h1>
      <FullContactEditForm
  contact={contact}
  saving={saving}
  error={error}
  onSave={async (payload) => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/contacts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("Failed to update contact");
      // Optional: show success
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSaving(false);
    }
  }}
/>
    </div>
  );
} 