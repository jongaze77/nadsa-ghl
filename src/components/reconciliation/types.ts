// Types for reconciliation components

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: 'bank_csv' | 'stripe_report';
  uploadedAt: Date;
  status: 'uploaded' | 'processing' | 'completed' | 'error';
}

export interface FileUploadState {
  isUploading: boolean;
  uploadProgress: number;
  isDragOver: boolean;
  selectedFileType: 'lloyds' | 'stripe' | null;
  error: string | null;
  success: string | null;
}

export interface UploadResponse {
  success: boolean;
  data?: any[];
  errors?: string[];
  processed?: number;
  skipped?: number;
  message?: string;
}

export interface PaymentData {
  transactionFingerprint: string;
  amount: number;
  paymentDate: Date;
  description: string;
  source: 'BANK_CSV' | 'STRIPE';
  transactionRef?: string;
}

export interface ContactMatch {
  contactId: string;
  confidence: number;
  reasoning: {
    nameMatch?: { score: number };
    emailMatch?: { score: number };
    amountMatch?: { score: number };
  };
  contact: {
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    membershipType?: string;
  };
}

export interface MatchSuggestion {
  paymentData: PaymentData;
  matches: ContactMatch[];
  status: 'pending' | 'confirmed' | 'rejected';
}