import { render } from '@testing-library/react';
import ReconciliationDashboard from '@/components/reconciliation/ReconciliationDashboard';

describe('ReconciliationDashboard', () => {
  it('renders without crashing', () => {
    const { container } = render(<ReconciliationDashboard />);
    expect(container).toBeDefined();
  });

  it('renders basic component structure', () => {
    const { container } = render(<ReconciliationDashboard />);
    
    // Check that main container exists
    const mainContainer = container.querySelector('.space-y-6');
    expect(mainContainer).toBeTruthy();
  });

  it('has tab navigation structure', () => {
    const { container } = render(<ReconciliationDashboard />);
    
    // Check for tab buttons
    const tabButtons = container.querySelectorAll('button');
    expect(tabButtons.length).toBeGreaterThan(0);
  });

  it('displays system status section', () => {
    const { container } = render(<ReconciliationDashboard />);
    
    // Check for system status indicators
    const indicators = container.querySelectorAll('.w-2.h-2.rounded-full');
    expect(indicators).toHaveLength(2);
  });

  it('includes dark mode support classes', () => {
    const { container } = render(<ReconciliationDashboard />);
    
    // Check content areas have dark mode styles
    const contentArea = container.querySelector('.bg-white');
    expect(contentArea?.className).toContain('dark:bg-gray-800');
  });
});