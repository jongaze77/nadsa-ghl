import { render } from '@testing-library/react';
import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import Navigation from '@/components/Navigation';

// Mock dependencies
jest.mock('next-auth/react');
jest.mock('next/navigation');

const mockUseSession = useSession as jest.MockedFunction<typeof useSession>;
const mockUsePathname = usePathname as jest.MockedFunction<typeof usePathname>;

describe('Navigation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUsePathname.mockReturnValue('/');
  });

  it('renders nothing when user is not authenticated', () => {
    mockUseSession.mockReturnValue({ 
      data: null, 
      status: 'unauthenticated',
      update: jest.fn()
    });

    const { container } = render(<Navigation />);
    expect(container.firstChild).toBeNull();
  });

  it('renders navigation for authenticated users', () => {
    mockUseSession.mockReturnValue({
      data: {
        user: {
          id: '1',
          name: 'Regular User',
          email: 'user@test.com',
          role: 'user'
        },
        expires: '2024-12-31'
      },
      status: 'authenticated',
      update: jest.fn()
    });

    const { container } = render(<Navigation />);

    // Check that nav element renders
    const navElement = container.querySelector('nav');
    expect(navElement).toBeTruthy();
  });

  it('renders admin navigation elements for admin users', () => {
    mockUseSession.mockReturnValue({
      data: {
        user: {
          id: '1',
          name: 'Admin User',
          email: 'admin@test.com',
          role: 'admin'
        },
        expires: '2024-12-31'
      },
      status: 'authenticated',
      update: jest.fn()
    });

    const { container } = render(<Navigation />);

    // Check for navigation links (should be more for admin)
    const links = container.querySelectorAll('a');
    expect(links.length).toBeGreaterThan(1);
  });

  it('includes reconciliation link for admin users', () => {
    mockUseSession.mockReturnValue({
      data: {
        user: {
          id: '1',
          name: 'Admin User',
          email: 'admin@test.com',
          role: 'admin'
        },
        expires: '2024-12-31'
      },
      status: 'authenticated',
      update: jest.fn()
    });

    const { container } = render(<Navigation />);

    // Check for reconciliation link
    const reconciliationLink = container.querySelector('a[href="/admin/reconciliation"]');
    expect(reconciliationLink).toBeTruthy();
  });
});