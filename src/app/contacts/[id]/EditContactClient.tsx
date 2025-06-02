'use client';

import { useState } from 'react';
import { Contact } from '@prisma/client';
import FullContactEditForm from "@/components/FullContactEditForm";

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

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/contacts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
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
        form={formData}
        setForm={setFormData}
        saving={saving}
        error={error}
        onSave={handleSave}
      />
    </div>
  );
} 