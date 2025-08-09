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
  parsingErrors?: number;
  duplicates?: number;
  skippedDetails?: Array<{ type: string; reason: string; reference?: string }>;
  message?: string;
}

export interface PaymentData {
  transactionFingerprint: string;
  amount: number;
  paymentDate: Date;
  description: string;
  source: 'BANK_CSV' | 'STRIPE_REPORT';
  transactionRef?: string;
  // New customer fields from Stripe CSV
  customer_name?: string;
  customer_email?: string;
  card_address_line1?: string;
  card_address_postal_code?: string;
}

// New types for persisted payment data
export interface PersistedPaymentData {
  id: string;
  transactionFingerprint: string;
  paymentDate: string; // ISO string from API
  amount: number;
  source: string;
  transactionRef: string;
  description?: string;
  hashedAccountIdentifier?: string;
  status: 'pending' | 'processing' | 'matched' | 'confirmed' | 'ignored';
  uploadedAt: string; // ISO string from API
  // New customer fields from Stripe CSV
  customer_name?: string;
  customer_email?: string;
  card_address_line1?: string;
  card_address_postal_code?: string;
}

export interface PaymentsResponse {
  success: boolean;
  payments?: PersistedPaymentData[];
  total?: number;
  page?: number;
  limit?: number;
  message?: string;
}

export interface MatchesResponse {
  success: boolean;
  suggestions?: ContactMatch[];
  totalMatches?: number;
  processingTimeMs?: number;
  message?: string;
}

export interface ConfirmResponse {
  success: boolean;
  reconciliationLogId?: string;
  message?: string;
  ghlUpdateResult?: any;
  wordpressUpdateResult?: any;
  errors?: string[];
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

// Component state types
export interface PaymentListState {
  payments: PersistedPaymentData[];
  loading: boolean;
  error: string | null;
  selectedPayment: PersistedPaymentData | null;
  filters: {
    status?: string;
    source?: string;
    amount?: number;
    amountExact?: boolean;
    textSearch?: string;
    dateFrom?: string;
    dateTo?: string;
    showAll?: boolean;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}

export interface MatchSuggestionsState {
  suggestions: ContactMatch[];
  loading: boolean;
  error: string | null;
  selectedPayment: PersistedPaymentData | null;
  confirmingMatch: string | null; // contactId being confirmed
  processingTimeMs?: number;
}