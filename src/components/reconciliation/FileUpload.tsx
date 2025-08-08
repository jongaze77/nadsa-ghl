'use client';

import React, { useState, useRef, useCallback } from 'react';
import { FileUploadState, UploadResponse } from './types';

interface FileUploadProps {
  onUploadSuccess?: (data: UploadResponse) => void;
  onUploadError?: (error: string) => void;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export default function FileUpload({ onUploadSuccess, onUploadError }: FileUploadProps) {
  const [state, setState] = useState<FileUploadState>({
    isUploading: false,
    uploadProgress: 0,
    isDragOver: false,
    selectedFileType: null,
    error: null,
    success: null,
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = useCallback((file: File): string | null => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      return 'Only CSV files are allowed';
    }
    if (file.size > MAX_FILE_SIZE) {
      return 'File size must be less than 10MB';
    }
    if (file.size === 0) {
      return 'File cannot be empty';
    }
    return null;
  }, []);

  const uploadFile = useCallback(async (file: File, fileType: 'lloyds' | 'stripe') => {
    setState(prev => ({ ...prev, isUploading: true, uploadProgress: 0, error: null, success: null }));

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', fileType);

      const response = await fetch('/api/reconciliation/upload', {
        method: 'POST',
        body: formData,
      });

      const result: UploadResponse = await response.json();

      if (result.success) {
        setState(prev => ({ 
          ...prev, 
          isUploading: false, 
          uploadProgress: 100,
          success: result.message || `Successfully processed ${result.processed || 0} payments`,
          selectedFileType: null
        }));
        onUploadSuccess?.(result);
      } else {
        const errorMsg = result.errors?.join(', ') || result.message || 'Upload failed';
        setState(prev => ({ 
          ...prev, 
          isUploading: false, 
          uploadProgress: 0,
          error: errorMsg
        }));
        onUploadError?.(errorMsg);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Upload failed';
      setState(prev => ({ 
        ...prev, 
        isUploading: false, 
        uploadProgress: 0,
        error: errorMsg
      }));
      onUploadError?.(errorMsg);
    }
  }, [onUploadSuccess, onUploadError]);

  const handleFileSelect = useCallback((file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setState(prev => ({ ...prev, error: validationError }));
      return;
    }

    if (!state.selectedFileType) {
      setState(prev => ({ ...prev, error: 'Please select file type first' }));
      return;
    }

    uploadFile(file, state.selectedFileType);
  }, [validateFile, uploadFile, state.selectedFileType]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setState(prev => ({ ...prev, isDragOver: true }));
  }, []);

  const handleDragLeave = useCallback(() => {
    setState(prev => ({ ...prev, isDragOver: false }));
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setState(prev => ({ ...prev, isDragOver: false }));
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  const handleBrowseClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const resetState = useCallback(() => {
    setState(prev => ({ 
      ...prev, 
      error: null, 
      success: null, 
      selectedFileType: null,
      uploadProgress: 0
    }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  return (
    <div className="space-y-6">
      {/* File Type Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Select File Type
        </label>
        <div className="flex space-x-4">
          <button
            onClick={() => setState(prev => ({ ...prev, selectedFileType: 'lloyds', error: null }))}
            className={`px-4 py-2 rounded-lg border font-medium transition-colors ${
              state.selectedFileType === 'lloyds'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
            disabled={state.isUploading}
          >
            Lloyds Bank CSV
          </button>
          <button
            onClick={() => setState(prev => ({ ...prev, selectedFileType: 'stripe', error: null }))}
            className={`px-4 py-2 rounded-lg border font-medium transition-colors ${
              state.selectedFileType === 'stripe'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
            disabled={state.isUploading}
          >
            Stripe Report
          </button>
        </div>
      </div>

      {/* Upload Area */}
      <div
        className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
          state.isDragOver
            ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
            : 'border-gray-300 dark:border-gray-600'
        } ${
          !state.selectedFileType ? 'opacity-50 pointer-events-none' : ''
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileInputChange}
          className="hidden"
          disabled={state.isUploading || !state.selectedFileType}
        />
        
        <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
          <span className="text-2xl">📁</span>
        </div>
        
        {state.isUploading ? (
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
              Uploading File...
            </h3>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${state.uploadProgress}%` }}
              />
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Processing your {state.selectedFileType === 'lloyds' ? 'Lloyds Bank' : 'Stripe'} CSV file...
            </p>
          </div>
        ) : (
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              {state.selectedFileType 
                ? `Upload ${state.selectedFileType === 'lloyds' ? 'Lloyds Bank' : 'Stripe'} CSV File`
                : 'Select File Type First'
              }
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Drag and drop your CSV file here, or browse to select
            </p>
            <button
              onClick={handleBrowseClick}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!state.selectedFileType}
            >
              Browse Files
            </button>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Maximum file size: 10MB • Accepted format: CSV
            </p>
          </div>
        )}
      </div>

      {/* Status Messages */}
      {state.error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-4 border border-red-200 dark:border-red-800">
          <div className="flex items-center">
            <span className="text-red-400 mr-2">❌</span>
            <p className="text-sm text-red-800 dark:text-red-300">{state.error}</p>
            <button
              onClick={resetState}
              className="ml-auto text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200 text-sm underline"
            >
              Try Again
            </button>
          </div>
        </div>
      )}
      
      {state.success && (
        <div className="rounded-lg bg-green-50 dark:bg-green-900/20 p-4 border border-green-200 dark:border-green-800">
          <div className="flex items-center">
            <span className="text-green-400 mr-2">✅</span>
            <p className="text-sm text-green-800 dark:text-green-300">{state.success}</p>
            <button
              onClick={resetState}
              className="ml-auto text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-200 text-sm underline"
            >
              Upload Another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}