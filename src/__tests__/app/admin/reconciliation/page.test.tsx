import { render } from '@testing-library/react';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import ReconciliationPage from '@/app/admin/reconciliation/page';

// Mock dependencies
jest.mock('next-auth');
jest.mock('next/navigation');
jest.mock('@/components/reconciliation/ReconciliationDashboard', () => {
  return function MockReconciliationDashboard() {
    return <div data-testid="reconciliation-dashboard">Mock Dashboard</div>;
  };
});

const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;
const mockRedirect = redirect as jest.MockedFunction<typeof redirect>;

describe('ReconciliationPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('redirects non-admin users to login', async () => {
    // Mock non-admin session
    mockGetServerSession.mockResolvedValue({
      user: {
        id: '2',
        name: 'Regular User',
        email: 'user@test.com',
        role: 'user'
      },
      expires: '2024-12-31'
    });

    await ReconciliationPage();

    expect(mockRedirect).toHaveBeenCalledWith('/login');
  });

  it('redirects when no session exists', async () => {
    // Mock no session
    mockGetServerSession.mockResolvedValue(null);

    await ReconciliationPage();

    expect(mockRedirect).toHaveBeenCalledWith('/login');
  });

  it('allows admin users to access page', async () => {
    mockGetServerSession.mockResolvedValue({
      user: {
        id: '1',
        name: 'Admin User',
        email: 'admin@test.com',
        role: 'admin'
      },
      expires: '2024-12-31'
    });

    const PageComponent = await ReconciliationPage();
    const { container } = render(PageComponent);

    // Check that component renders (no redirect called)
    expect(mockRedirect).not.toHaveBeenCalled();
    expect(container).toBeTruthy();
  });
});