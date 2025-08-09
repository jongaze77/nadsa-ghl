import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { act } from 'react';
import PaymentList from '../../../components/reconciliation/PaymentList';
import { PersistedPaymentData } from '../../../components/reconciliation/types';

// Mock fetch globally
global.fetch = jest.fn();

const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

// Sample test data
const mockPayments: PersistedPaymentData[] = [
  {
    id: 'payment1',
    transactionFingerprint: 'fp1',
    paymentDate: '2024-01-01T10:00:00.000Z',
    amount: 42,
    source: 'STRIPE_REPORT',
    transactionRef: 'stripe_123',
    description: 'Test payment for membership',
    status: 'pending',
    uploadedAt: '2024-01-01T12:00:00.000Z',
    customer_name: 'John Doe',
    customer_email: 'john@example.com',
    card_address_line1: '123 Main St',
    card_address_postal_code: 'SW1A 1AA'
  },
  {
    id: 'payment2',
    transactionFingerprint: 'fp2',
    paymentDate: '2024-01-02T11:00:00.000Z',
    amount: 20,
    source: 'BANK_CSV',
    transactionRef: 'bank_456',
    description: 'Bank transfer payment',
    status: 'confirmed',
    uploadedAt: '2024-01-02T13:00:00.000Z'
  }
];

const mockSuccessResponse = {
  success: true,
  payments: mockPayments,
  total: 2,
  page: 1,
  limit: 25,
  message: 'Found 2 payments'
};

describe('PaymentList Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    } as Response);
  });

  describe('Initial Render', () => {
    it('renders without crashing', async () => {
      await act(async () => {
        render(<PaymentList />);
      });
      expect(screen.getByText('Payment Processing')).toBeInTheDocument();
    });

    it('renders basic structure', async () => {
      await act(async () => {
        render(<PaymentList />);
      });
      expect(screen.getByText('Payment Processing')).toBeInTheDocument();
      expect(screen.getByText('Review and process uploaded payment transactions')).toBeInTheDocument();
    });

    it('renders all filter controls', async () => {
      await act(async () => {
        render(<PaymentList />);
      });
      
      expect(screen.getByLabelText(/Filter by status/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Filter by source/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Filter by amount/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Search by customer name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Date from/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Date to/i)).toBeInTheDocument();
      expect(screen.getByText('Apply Filters')).toBeInTheDocument();
      expect(screen.getByText('Clear Filters')).toBeInTheDocument();
    });

    it('fetches payments on initial load with default filters', async () => {
      await act(async () => {
        render(<PaymentList />);
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/reconciliation/payments?page=1&limit=25');
      });
    });
  });

  describe('Payment Display', () => {
    it('displays payment cards with customer information', async () => {
      await act(async () => {
        render(<PaymentList />);
      });

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('john@example.com')).toBeInTheDocument();
        expect(screen.getByText('123 Main St, SW1A 1AA')).toBeInTheDocument();
        expect(screen.getByText('£42.00')).toBeInTheDocument();
      });
    });

    it('displays payment without customer fields correctly', async () => {
      await act(async () => {
        render(<PaymentList />);
      });

      await waitFor(() => {
        expect(screen.getByText('£20.00')).toBeInTheDocument();
        expect(screen.getByText('Bank transfer payment')).toBeInTheDocument();
      });
    });
  });

  describe('Amount Filtering', () => {
    it('filters by preset amount values', async () => {
      await act(async () => {
        render(<PaymentList />);
      });

      const amountSelect = screen.getByLabelText(/Filter by amount/i);
      
      await act(async () => {
        fireEvent.change(amountSelect, { target: { value: '10' } });
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/reconciliation/payments?page=1&limit=25&status=pending&amount=10&amountExact=true');
      });
    });

    it('shows custom amount input when custom is selected and amount is entered', async () => {
      await act(async () => {
        render(<PaymentList />);
      });

      const amountSelect = screen.getByLabelText(/Filter by amount/i);
      
      await act(async () => {
        fireEvent.change(amountSelect, { target: { value: 'custom' } });
      });

      // Custom input only shows after typing an amount
      await waitFor(() => {
        expect(screen.getByLabelText(/Custom amount/i)).toBeInTheDocument();
      });
    });
  });

  describe('Status Filtering', () => {
    it('updates API call when status filter changes', async () => {
      await act(async () => {
        render(<PaymentList />);
      });

      const statusSelect = screen.getByLabelText(/Filter by status/i);
      
      await act(async () => {
        fireEvent.change(statusSelect, { target: { value: 'confirmed' } });
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/reconciliation/payments?page=1&limit=25&status=confirmed');
      });
    });
  });

  describe('Text Search', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('performs debounced text search', async () => {
      await act(async () => {
        render(<PaymentList />);
      });

      const searchInput = screen.getByPlaceholderText(/Search by customer name/i);
      
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: 'john' } });
      });

      // Should not call immediately
      expect(mockFetch).not.toHaveBeenCalledWith(expect.stringContaining('textSearch=john'));

      // Fast forward past debounce delay
      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/reconciliation/payments?page=1&limit=25&status=pending&textSearch=john');
      });
    });
  });

  describe('Date Range Filtering', () => {
    it('filters by date range', async () => {
      await act(async () => {
        render(<PaymentList />);
      });

      const dateFromInput = screen.getByLabelText(/Date from/i);
      const dateToInput = screen.getByLabelText(/Date to/i);
      
      await act(async () => {
        fireEvent.change(dateFromInput, { target: { value: '2024-01-01' } });
        fireEvent.change(dateToInput, { target: { value: '2024-01-31' } });
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/reconciliation/payments?page=1&limit=25&status=pending&dateFrom=2024-01-01&dateTo=2024-01-31');
      });
    });
  });

  describe('Clear Filters', () => {
    it('clears all filters except default status', async () => {
      await act(async () => {
        render(<PaymentList />);
      });

      // Set some filters first
      const amountSelect = screen.getByLabelText(/Filter by amount/i);
      await act(async () => {
        fireEvent.change(amountSelect, { target: { value: '10' } });
      });

      // Clear filters
      const clearButton = screen.getByText('Clear Filters');
      await act(async () => {
        fireEvent.click(clearButton);
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/reconciliation/payments?page=1&limit=25');
      });

      // Check UI reset
      expect(amountSelect).toHaveValue('');
    });
  });

  describe('Error Handling', () => {
    it('displays error message when API call fails', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({
          success: false,
          message: 'Server error'
        }),
      } as Response);

      await act(async () => {
        render(<PaymentList />);
      });

      await waitFor(() => {
        expect(screen.getByText('Error Loading Payments')).toBeInTheDocument();
        expect(screen.getByText('Server error')).toBeInTheDocument();
      });
    });
  });

  describe('Empty States', () => {
    it('shows empty state when no payments found', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          ...mockSuccessResponse,
          payments: [],
          total: 0
        }),
      } as Response);

      await act(async () => {
        render(<PaymentList />);
      });

      await waitFor(() => {
        expect(screen.getByText('No Payments Found')).toBeInTheDocument();
      });
    });
  });
});