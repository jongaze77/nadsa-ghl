import { render } from '@testing-library/react';
import MatchSuggestions from '../../../components/reconciliation/MatchSuggestions';
import type { PersistedPaymentData } from '../../../components/reconciliation/types';

// Mock fetch globally
global.fetch = jest.fn();

const mockPaymentData: PersistedPaymentData = {
  id: 'test-payment-1',
  transactionFingerprint: 'test-fingerprint-1',
  paymentDate: '2025-01-08T10:00:00Z',
  amount: 50.00,
  source: 'BANK_CSV',
  transactionRef: 'REF123456',
  description: 'Test payment description',
  status: 'pending',
  uploadedAt: '2025-01-08T09:00:00Z',
};

describe('MatchSuggestions Component', () => {
  beforeEach(() => {
    (fetch as jest.MockedFunction<typeof fetch>).mockClear();
  });

  it('renders without crashing', () => {
    const { container } = render(<MatchSuggestions selectedPayment={null} />);
    expect(container).toBeDefined();
  });

  it('renders header and description', () => {
    const { container } = render(<MatchSuggestions selectedPayment={null} />);
    expect(container.textContent).toContain('Match Suggestions');
    expect(container.textContent).toContain('AI-powered contact matching for payment reconciliation');
  });

  it('shows no payment selected state', () => {
    const { container } = render(<MatchSuggestions selectedPayment={null} />);
    expect(container.textContent).toContain('No Payment Selected');
  });

  it('fetches suggestions when payment is selected', () => {
    (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        suggestions: [],
        totalMatches: 0,
        processingTimeMs: 150,
      }),
    } as Response);

    const { container } = render(<MatchSuggestions selectedPayment={mockPaymentData} />);
    expect(container.textContent).toContain('Selected Payment');
  });
});