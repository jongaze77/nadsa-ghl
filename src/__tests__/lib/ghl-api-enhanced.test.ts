// Mock the underlying functions first
jest.mock('../../lib/ghl-api', () => ({
  updateContactInGHL: jest.fn(),
  fetchContactFromGHL: jest.fn(),
  getApiKey: jest.fn(),
  getLocationId: jest.fn(),
  updateMembershipStatus: jest.fn(),
  updateContactTags: jest.fn(),
  checkGHLConnection: jest.fn(),
}));

import { 
  updateMembershipStatus, 
  updateContactTags, 
  checkGHLConnection,
  updateContactInGHL,
  fetchContactFromGHL,
  getApiKey,
  getLocationId,
  type MembershipUpdateData 
} from '../../lib/ghl-api';

// Get the mocked functions
const mockUpdateMembershipStatus = updateMembershipStatus as jest.MockedFunction<typeof updateMembershipStatus>;
const mockUpdateContactTags = updateContactTags as jest.MockedFunction<typeof updateContactTags>;
const mockCheckGHLConnection = checkGHLConnection as jest.MockedFunction<typeof checkGHLConnection>;
const mockUpdateContactInGHL = updateContactInGHL as jest.MockedFunction<typeof updateContactInGHL>;
const mockFetchContactFromGHL = fetchContactFromGHL as jest.MockedFunction<typeof fetchContactFromGHL>;
const mockGetApiKey = getApiKey as jest.MockedFunction<typeof getApiKey>;
const mockGetLocationId = getLocationId as jest.MockedFunction<typeof getLocationId>;

// Mock fetch globally
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('Enhanced GHL API Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up default successful mocks
    mockUpdateMembershipStatus.mockResolvedValue({ success: true });
    mockUpdateContactTags.mockResolvedValue({ success: true });
    mockCheckGHLConnection.mockResolvedValue({ connected: true });
    mockUpdateContactInGHL.mockResolvedValue({ success: true });
    mockFetchContactFromGHL.mockResolvedValue({
      id: 'contact-123',
      tags: ['Existing Tag', 'Old Tag'],
    });
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    } as any);
    
    // Reset environment variables
    delete process.env.GHL_API_KEY;
    delete process.env.GHL_LOCATION_ID;
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

    it('should update membership status with correct payload', async () => {
      // Mock the fetch call that updateContactInGHL will make
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ success: true }),
      } as any);

      const result = await updateMembershipStatus(contactId, mockMembershipData);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/contacts/contact-123'),
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({
            customFields: {
              'cWMPNiNAfReHOumOhBB2': '2025-01-15', // renewal_date
              'w52V1FONYrhH0LUqDjBs': '2024-01-15', // membership_start_date
            },
            tags: ['Paid', 'Active Member', 'Payment-£50'],
          })
        })
      );
      expect(result).toEqual({ success: true });
    });

    it('should handle minimal membership data', async () => {
      mockUpdateContactInGHL.mockResolvedValue({ success: true });
      
      const minimalData: MembershipUpdateData = {
        renewalDate: new Date('2025-01-15'),
      };

      await updateMembershipStatus(contactId, minimalData);

      expect(mockUpdateContactInGHL).toHaveBeenCalledWith(contactId, {
        customFields: {
          'cWMPNiNAfReHOumOhBB2': '2025-01-15',
        },
        tags: ['Paid', 'Active Member'],
      });
    });

    it('should handle different membership statuses', async () => {
      mockUpdateContactInGHL.mockResolvedValue({ success: true });
      
      const expiredData: MembershipUpdateData = {
        renewalDate: new Date('2023-01-15'),
        membershipStatus: 'expired',
        paidTag: false,
      };

      await updateMembershipStatus(contactId, expiredData);

      expect(mockUpdateContactInGHL).toHaveBeenCalledWith(contactId, {
        customFields: {
          'cWMPNiNAfReHOumOhBB2': '2023-01-15',
        },
        tags: ['Expired Member'],
      });
    });

    it('should handle pending membership status', async () => {
      mockUpdateContactInGHL.mockResolvedValue({ success: true });
      
      const pendingData: MembershipUpdateData = {
        renewalDate: new Date('2025-01-15'),
        membershipStatus: 'pending',
        paidTag: false,
      };

      await updateMembershipStatus(contactId, pendingData);

      expect(mockUpdateContactInGHL).toHaveBeenCalledWith(contactId, {
        customFields: {
          'cWMPNiNAfReHOumOhBB2': '2025-01-15',
        },
        tags: ['Pending Member'],
      });
    });

    it('should propagate errors from updateContactInGHL', async () => {
      const error = new Error('GHL API Error');
      mockUpdateContactInGHL.mockRejectedValue(error);

      await expect(updateMembershipStatus(contactId, mockMembershipData)).rejects.toThrow('GHL API Error');
    });
  });

  describe('updateContactTags', () => {
    const contactId = 'contact-123';
    const mockCurrentContact = {
      id: contactId,
      tags: ['Existing Tag', 'Old Tag'],
    };

    beforeEach(() => {
      mockFetchContactFromGHL.mockResolvedValue(mockCurrentContact);
      mockUpdateContactInGHL.mockResolvedValue({ success: true });
    });

    it('should add new tags without removing existing ones', async () => {
      const tagsToAdd = ['New Tag', 'Another Tag'];
      
      await updateContactTags(contactId, tagsToAdd, []);

      expect(mockFetchContactFromGHL).toHaveBeenCalledWith(contactId);
      expect(mockUpdateContactInGHL).toHaveBeenCalledWith(contactId, {
        tags: ['Existing Tag', 'Old Tag', 'New Tag', 'Another Tag'],
      });
    });

    it('should remove specified tags', async () => {
      const tagsToRemove = ['Old Tag'];
      
      await updateContactTags(contactId, [], tagsToRemove);

      expect(mockUpdateContactInGHL).toHaveBeenCalledWith(contactId, {
        tags: ['Existing Tag'],
      });
    });

    it('should add and remove tags in same operation', async () => {
      const tagsToAdd = ['New Tag'];
      const tagsToRemove = ['Old Tag'];
      
      await updateContactTags(contactId, tagsToAdd, tagsToRemove);

      expect(mockUpdateContactInGHL).toHaveBeenCalledWith(contactId, {
        tags: ['Existing Tag', 'New Tag'],
      });
    });

    it('should not add duplicate tags', async () => {
      const tagsToAdd = ['Existing Tag', 'New Tag']; // Existing Tag is already there
      
      await updateContactTags(contactId, tagsToAdd, []);

      expect(mockUpdateContactInGHL).toHaveBeenCalledWith(contactId, {
        tags: ['Existing Tag', 'Old Tag', 'New Tag'], // No duplicate
      });
    });

    it('should handle contact with no existing tags', async () => {
      mockFetchContactFromGHL.mockResolvedValue({ id: contactId, tags: [] });
      
      const tagsToAdd = ['First Tag'];
      await updateContactTags(contactId, tagsToAdd, []);

      expect(mockUpdateContactInGHL).toHaveBeenCalledWith(contactId, {
        tags: ['First Tag'],
      });
    });

    it('should handle contact with null tags', async () => {
      mockFetchContactFromGHL.mockResolvedValue({ id: contactId, tags: null });
      
      const tagsToAdd = ['First Tag'];
      await updateContactTags(contactId, tagsToAdd, []);

      expect(mockUpdateContactInGHL).toHaveBeenCalledWith(contactId, {
        tags: ['First Tag'],
      });
    });

    it('should propagate fetch errors', async () => {
      const error = new Error('Failed to fetch contact');
      mockFetchContactFromGHL.mockRejectedValue(error);

      await expect(updateContactTags(contactId, ['New Tag'], [])).rejects.toThrow('Failed to fetch contact');
    });

    it('should propagate update errors', async () => {
      const error = new Error('Failed to update contact');
      mockUpdateContactInGHL.mockRejectedValue(error);

      await expect(updateContactTags(contactId, ['New Tag'], [])).rejects.toThrow('Failed to update contact');
    });
  });

  describe('checkGHLConnection', () => {
    beforeEach(() => {
      mockFetch.mockClear();
    });

    it('should return success when API credentials are valid and API responds', async () => {
      mockGetApiKey.mockReturnValue('test-api-key');
      mockGetLocationId.mockReturnValue('test-location-id');
      
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ contacts: [] }),
      } as any);

      const result = await checkGHLConnection();

      expect(result).toEqual({ connected: true });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('https://rest.gohighlevel.com/v1/contacts?limit=1'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-api-key',
          }),
        })
      );
    });

    it('should return failure when API key is missing', async () => {
      mockGetApiKey.mockReturnValue('');
      mockGetLocationId.mockReturnValue('test-location-id');

      const result = await checkGHLConnection();

      expect(result).toEqual({
        connected: false,
        error: 'Missing GHL API credentials (GHL_API_KEY or GHL_LOCATION_ID)',
      });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should return failure when location ID is missing', async () => {
      mockGetApiKey.mockReturnValue('test-api-key');
      mockGetLocationId.mockReturnValue('');

      const result = await checkGHLConnection();

      expect(result).toEqual({
        connected: false,
        error: 'Missing GHL API credentials (GHL_API_KEY or GHL_LOCATION_ID)',
      });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should return failure when API call fails', async () => {
      mockGetApiKey.mockReturnValue('test-api-key');
      mockGetLocationId.mockReturnValue('test-location-id');
      
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await checkGHLConnection();

      expect(result).toEqual({
        connected: false,
        error: 'GHL API connection failed: Network error',
      });
    });

    it('should return failure when API returns error status', async () => {
      mockGetApiKey.mockReturnValue('test-api-key');
      mockGetLocationId.mockReturnValue('test-location-id');
      
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
      } as any);

      const result = await checkGHLConnection();

      expect(result).toEqual({
        connected: false,
        error: 'GHL API connection failed: HTTP error! status: 401',
      });
    });

    it('should handle retry logic on API failures', async () => {
      mockGetApiKey.mockReturnValue('test-api-key');
      mockGetLocationId.mockReturnValue('test-location-id');
      
      // Mock failure then success
      mockFetch
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue({ contacts: [] }),
        } as any);

      const result = await checkGHLConnection();

      expect(result).toEqual({ connected: true });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});