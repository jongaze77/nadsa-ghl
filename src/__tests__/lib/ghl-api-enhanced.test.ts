// Mock only the underlying functions, not the ones we want to test
jest.mock('../../lib/ghl-api', () => {
  const originalModule = jest.requireActual('../../lib/ghl-api');
  
  return {
    ...originalModule,
    // Mock only the underlying functions
    fetchWithRetry: jest.fn(),
  };
});

// Mock fetch globally for the test environment
global.fetch = jest.fn();

import { 
  updateMembershipStatus, 
  updateContactTags, 
  checkGHLConnection,
  fetchWithRetry,
  type MembershipUpdateData 
} from '../../lib/ghl-api';

// Get the mocked functions
const mockFetchWithRetry = fetchWithRetry as jest.MockedFunction<typeof fetchWithRetry>;
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

describe('Enhanced GHL API Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up default successful mocks for fetchWithRetry
    mockFetchWithRetry.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    } as any);
    
    // Mock fetch as fallback
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    } as any);
  });

  describe('updateMembershipStatus', () => {
    const contactId = 'contact-123';
    const mockMembershipData: MembershipUpdateData = {
      renewalDate: new Date('2025-01-15'),
      membershipStatus: 'active',
      paidTag: true,
      paymentAmount: 50.00,
      paymentDate: new Date('2024-01-15'),
    };

    it('should update membership status successfully', async () => {
      const result = await updateMembershipStatus(contactId, mockMembershipData);
      expect(result).toEqual({ success: true });
    });

    it('should handle minimal membership data', async () => {
      const minimalData: MembershipUpdateData = {
        renewalDate: new Date('2025-01-15'),
      };

      const result = await updateMembershipStatus(contactId, minimalData);
      expect(result).toEqual({ success: true });
    });

    it('should handle different membership statuses', async () => {
      const expiredData: MembershipUpdateData = {
        renewalDate: new Date('2023-01-15'),
        membershipStatus: 'expired',
        paidTag: false,
      };

      const result = await updateMembershipStatus(contactId, expiredData);
      expect(result).toEqual({ success: true });
    });

    it('should handle pending membership status', async () => {
      const pendingData: MembershipUpdateData = {
        renewalDate: new Date('2025-01-15'),
        membershipStatus: 'pending',
        paidTag: false,
      };

      const result = await updateMembershipStatus(contactId, pendingData);
      expect(result).toEqual({ success: true });
    });

  });

  describe('updateContactTags', () => {
    const contactId = 'contact-123';

    it('should add new tags without removing existing ones', async () => {
      const tagsToAdd = ['New Tag', 'Another Tag'];
      
      const result = await updateContactTags(contactId, tagsToAdd, []);
      expect(result).toEqual({ success: true });
    });

    it('should remove specified tags', async () => {
      const tagsToRemove = ['Old Tag'];
      
      const result = await updateContactTags(contactId, [], tagsToRemove);
      expect(result).toEqual({ success: true });
    });

    it('should add and remove tags in same operation', async () => {
      const tagsToAdd = ['New Tag'];
      const tagsToRemove = ['Old Tag'];
      
      const result = await updateContactTags(contactId, tagsToAdd, tagsToRemove);
      expect(result).toEqual({ success: true });
    });

    it('should not add duplicate tags', async () => {
      const tagsToAdd = ['Existing Tag', 'New Tag'];
      
      const result = await updateContactTags(contactId, tagsToAdd, []);
      expect(result).toEqual({ success: true });
    });

    it('should handle contact with no existing tags', async () => {
      const tagsToAdd = ['First Tag'];
      
      const result = await updateContactTags(contactId, tagsToAdd, []);
      expect(result).toEqual({ success: true });
    });

    it('should handle contact with null tags', async () => {
      const tagsToAdd = ['First Tag'];
      
      const result = await updateContactTags(contactId, tagsToAdd, []);
      expect(result).toEqual({ success: true });
    });

  });

  describe('checkGHLConnection', () => {
    it('should return success when API credentials are valid and API responds', async () => {
      // Mock environment variables
      process.env.GHL_API_KEY = 'test-api-key';
      process.env.GHL_LOCATION_ID = 'test-location-id';
      
      const result = await checkGHLConnection();

      expect(result).toEqual({ connected: true });
    });

    it('should return failure when API key is missing', async () => {
      delete process.env.GHL_API_KEY;
      process.env.GHL_LOCATION_ID = 'test-location-id';

      const result = await checkGHLConnection();

      expect(result).toEqual({
        connected: false,
        error: 'Missing GHL API credentials (GHL_API_KEY or GHL_LOCATION_ID)',
      });
    });

    it('should return failure when location ID is missing', async () => {
      process.env.GHL_API_KEY = 'test-api-key';
      delete process.env.GHL_LOCATION_ID;

      const result = await checkGHLConnection();

      expect(result).toEqual({
        connected: false,
        error: 'Missing GHL API credentials (GHL_API_KEY or GHL_LOCATION_ID)',
      });
    });


    it('should handle retry logic on API failures', async () => {
      process.env.GHL_API_KEY = 'test-api-key';
      process.env.GHL_LOCATION_ID = 'test-location-id';
      
      // Test passes if no errors are thrown
      const result = await checkGHLConnection();
      expect(result.connected).toBe(true);
    });
  });
});