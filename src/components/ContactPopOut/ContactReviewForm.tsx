'use client';

import { useState, useEffect } from 'react';
import { Contact } from '@prisma/client';

interface ContactReviewFormProps {
  contact: Contact;
  onContactUpdate: (updatedContact: Contact) => void;
}

interface ContactFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  membershipType: string;
  companyName: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  website: string;
  tags: string[];
}

export default function ContactReviewForm({ contact, onContactUpdate }: ContactReviewFormProps) {
  const [formData, setFormData] = useState<ContactFormData>({
    firstName: contact.firstName || '',
    lastName: contact.lastName || '',
    email: contact.email || '',
    phone: contact.phone || '',
    membershipType: contact.membershipType || '',
    companyName: contact.companyName || '',
    address1: contact.address1 || '',
    address2: contact.address2 || '',
    city: contact.city || '',
    state: contact.state || '',
    postalCode: contact.postalCode || '',
    country: contact.country || '',
    website: contact.website || '',
    tags: contact.tags || []
  });

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [customFields, setCustomFields] = useState<Record<string, any>>(
    (contact.customFields as Record<string, any>) || {}
  );

  const membershipTypes = [
    'Single',
    'Double', 
    'Associate',
    'Newsletter Only',
    'Full'
  ];

  useEffect(() => {
    if (successMessage || error) {
      const timer = setTimeout(() => {
        setSuccessMessage(null);
        setError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage, error]);

  const handleInputChange = (field: keyof ContactFormData, value: string | string[]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCustomFieldChange = (key: string, value: any) => {
    setCustomFields(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError(null);

      const updatedData = {
        ...formData,
        customFields: customFields
      };

      const response = await fetch(`/api/contacts/${contact.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update contact');
      }

      const data = await response.json();
      
      if (data.success && data.contact) {
        onContactUpdate(data.contact);
        setIsEditing(false);
        setSuccessMessage('Contact updated successfully!');
      } else {
        throw new Error(data.message || 'Update failed');
      }
    } catch (err) {
      console.error('Error updating contact:', err);
      setError(err instanceof Error ? err.message : 'Failed to update contact');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    // Reset form data to original contact data
    setFormData({
      firstName: contact.firstName || '',
      lastName: contact.lastName || '',
      email: contact.email || '',
      phone: contact.phone || '',
      membershipType: contact.membershipType || '',
      companyName: contact.companyName || '',
      address1: contact.address1 || '',
      address2: contact.address2 || '',
      city: contact.city || '',
      state: contact.state || '',
      postalCode: contact.postalCode || '',
      country: contact.country || '',
      website: contact.website || '',
      tags: contact.tags || []
    });
    setCustomFields((contact.customFields as Record<string, any>) || {});
    setIsEditing(false);
    setError(null);
  };

  const addTag = (tag: string) => {
    if (tag.trim() && !formData.tags.includes(tag.trim())) {
      handleInputChange('tags', [...formData.tags, tag.trim()]);
    }
  };

  const removeTag = (tagToRemove: string) => {
    handleInputChange('tags', formData.tags.filter(tag => tag !== tagToRemove));
  };

  return (
    <div className="space-y-8">
      {/* Status Messages */}
      {successMessage && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="flex items-center">
            <span className="text-green-400 text-lg mr-3">✓</span>
            <p className="text-green-700 dark:text-green-300">{successMessage}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center">
            <span className="text-red-400 text-lg mr-3">⚠️</span>
            <p className="text-red-700 dark:text-red-300">{error}</p>
          </div>
        </div>
      )}

      {/* Basic Information */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Basic Information
          </h2>
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors text-sm"
            >
              Edit Details
            </button>
          ) : (
            <div className="flex space-x-2">
              <button
                onClick={handleCancel}
                disabled={isSaving}
                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md transition-colors text-sm disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md transition-colors text-sm disabled:opacity-50 flex items-center gap-2"
              >
                {isSaving && (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                )}
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                First Name
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => handleInputChange('firstName', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                />
              ) : (
                <p className="text-gray-900 dark:text-gray-100">
                  {contact.firstName || 'Not provided'}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Last Name
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => handleInputChange('lastName', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                />
              ) : (
                <p className="text-gray-900 dark:text-gray-100">
                  {contact.lastName || 'Not provided'}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email
              </label>
              {isEditing ? (
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                />
              ) : (
                <p className="text-gray-900 dark:text-gray-100">
                  {contact.email || 'Not provided'}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Phone
              </label>
              {isEditing ? (
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                />
              ) : (
                <p className="text-gray-900 dark:text-gray-100">
                  {contact.phone || 'Not provided'}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Membership Type
              </label>
              {isEditing ? (
                <select
                  value={formData.membershipType}
                  onChange={(e) => handleInputChange('membershipType', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                >
                  <option value="">Select membership type</option>
                  {membershipTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-gray-900 dark:text-gray-100">
                  {contact.membershipType || 'Not specified'}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Company
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.companyName}
                  onChange={(e) => handleInputChange('companyName', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                />
              ) : (
                <p className="text-gray-900 dark:text-gray-100">
                  {contact.companyName || 'Not provided'}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Address Information */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Address Information
          </h2>
        </div>
        
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Address Line 1
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.address1}
                  onChange={(e) => handleInputChange('address1', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                />
              ) : (
                <p className="text-gray-900 dark:text-gray-100">
                  {contact.address1 || 'Not provided'}
                </p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Address Line 2
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.address2}
                  onChange={(e) => handleInputChange('address2', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                />
              ) : (
                <p className="text-gray-900 dark:text-gray-100">
                  {contact.address2 || 'Not provided'}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                City
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => handleInputChange('city', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                />
              ) : (
                <p className="text-gray-900 dark:text-gray-100">
                  {contact.city || 'Not provided'}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                State/County
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.state}
                  onChange={(e) => handleInputChange('state', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                />
              ) : (
                <p className="text-gray-900 dark:text-gray-100">
                  {contact.state || 'Not provided'}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Postal Code
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.postalCode}
                  onChange={(e) => handleInputChange('postalCode', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                />
              ) : (
                <p className="text-gray-900 dark:text-gray-100">
                  {contact.postalCode || 'Not provided'}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Country
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.country}
                  onChange={(e) => handleInputChange('country', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                />
              ) : (
                <p className="text-gray-900 dark:text-gray-100">
                  {contact.country || 'Not provided'}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Additional Information */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Additional Information
          </h2>
        </div>
        
        <div className="p-6">
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Website
              </label>
              {isEditing ? (
                <input
                  type="url"
                  value={formData.website}
                  onChange={(e) => handleInputChange('website', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                />
              ) : (
                <p className="text-gray-900 dark:text-gray-100">
                  {contact.website ? (
                    <a 
                      href={contact.website} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 underline"
                    >
                      {contact.website}
                    </a>
                  ) : (
                    'Not provided'
                  )}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Tags
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {formData.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-2 py-1 text-sm bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 rounded-full"
                  >
                    {tag}
                    {isEditing && (
                      <button
                        onClick={() => removeTag(tag)}
                        className="ml-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
                      >
                        ×
                      </button>
                    )}
                  </span>
                ))}
              </div>
              {isEditing && (
                <input
                  type="text"
                  placeholder="Add tag and press Enter"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addTag((e.target as HTMLInputElement).value);
                      (e.target as HTMLInputElement).value = '';
                    }
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Contact Meta Information */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Contact Information
          </h2>
        </div>
        
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-gray-600 dark:text-gray-400">
            <div>
              <span className="font-medium">Contact ID:</span>
              <span className="ml-2">{contact.id}</span>
            </div>
            <div>
              <span className="font-medium">Created:</span>
              <span className="ml-2">
                {new Date(contact.createdAt).toLocaleDateString('en-GB')}
              </span>
            </div>
            <div>
              <span className="font-medium">Updated:</span>
              <span className="ml-2">
                {new Date(contact.updatedAt).toLocaleDateString('en-GB')}
              </span>
            </div>
            <div>
              <span className="font-medium">Last Synced:</span>
              <span className="ml-2">
                {new Date(contact.lastSyncedAt).toLocaleDateString('en-GB')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}