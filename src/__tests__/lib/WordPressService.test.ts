import { WordPressService, type WordPressConnectionConfig } from '../../lib/WordPressService';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockAxios = axios as jest.Mocked<typeof axios>;

describe('WordPressService', () => {
  let wordpressService: WordPressService;
  
  const mockConfig: WordPressConnectionConfig = {
    baseUrl: 'https://example.com',
    username: 'test-user',
    password: 'test-password',
    timeout: 30000,
  };

  const mockContact = {
    id: 'contact-123',
    email: 'john@example.com',
    membershipType: 'Full',
    firstName: 'John',
    lastName: 'Smith',
  };

  const mockPaymentData = {
    transactionFingerprint: 'test-123',
    amount: 50.00,
    paymentDate: new Date('2024-01-15'),
    source: 'BANK_CSV' as const,
    transactionRef: 'REF123',
    description: 'MEMBERSHIP PAYMENT',
  };

  const mockWordPressUser = {
    id: 123,
    username: 'johnsmith',
    email: 'john@example.com',
    roles: ['subscriber'],
    capabilities: {},
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock axios.create to return a mock instance
    const mockAxiosInstance = {
      get: jest.fn(),
      post: jest.fn(),
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
    };
    
    mockAxios.create.mockReturnValue(mockAxiosInstance as any);
    mockAxios.get.mockResolvedValue({ data: {} });
    
    wordpressService = new WordPressService(mockConfig);
  });

  describe('constructor', () => {
    it('should create service with provided config', () => {
      const service = new WordPressService(mockConfig);
      const config = service.getConfig();
      
      expect(config.baseUrl).toBe('https://example.com');
      expect(config.username).toBe('test-user');
      expect(config.timeout).toBe(30000);
      // Password should not be exposed
      expect('password' in config).toBe(false);
    });

    it('should create service from environment variables', () => {
      // Set environment variables
      process.env.WORDPRESS_API_URL = 'https://env.example.com';
      process.env.WORDPRESS_API_USERNAME = 'env-user';
      process.env.WORDPRESS_API_PASSWORD = 'env-password';

      const service = new WordPressService();
      const config = service.getConfig();
      
      expect(config.baseUrl).toBe('https://env.example.com');
      expect(config.username).toBe('env-user');
      
      // Clean up
      delete process.env.WORDPRESS_API_URL;
      delete process.env.WORDPRESS_API_USERNAME;
      delete process.env.WORDPRESS_API_PASSWORD;
    });

    it('should throw error when environment variables are missing', () => {
      // Ensure no environment variables
      delete process.env.WORDPRESS_API_URL;
      delete process.env.WORDPRESS_API_USERNAME;
      delete process.env.WORDPRESS_API_PASSWORD;

      expect(() => new WordPressService()).toThrow(
        'Missing WordPress configuration. Required: WORDPRESS_API_URL, WORDPRESS_API_USERNAME, WORDPRESS_API_PASSWORD'
      );
    });

    it('should remove trailing slash from baseUrl', () => {
      const configWithSlash = {
        ...mockConfig,
        baseUrl: 'https://example.com/',
      };
      
      const service = new WordPressService(configWithSlash);
      const config = service.getConfig();
      
      expect(config.baseUrl).toBe('https://example.com');
    });
  });

  describe('findUserByEmail', () => {
    beforeEach(() => {
      const mockInstance = (wordpressService as any).client;
      mockInstance.get = jest.fn();
    });

    it('should find user by exact email match', async () => {
      const mockInstance = (wordpressService as any).client;
      mockInstance.get.mockResolvedValue({
        data: [
          { id: 123, username: 'johnsmith', email: 'john@example.com', roles: ['subscriber'] },
          { id: 124, username: 'partial', email: 'john.doe@example.com', roles: ['subscriber'] },
        ],
      });

      const user = await wordpressService.findUserByEmail('john@example.com');

      expect(user).toEqual({
        id: 123,
        username: 'johnsmith',
        email: 'john@example.com',
        roles: ['subscriber'],
        meta: {},
      });
      expect(mockInstance.get).toHaveBeenCalledWith('/users', { params: { search: 'john@example.com' } });
    });

    it('should return null when user not found', async () => {
      const mockInstance = (wordpressService as any).client;
      mockInstance.get.mockResolvedValue({ data: [] });

      const user = await wordpressService.findUserByEmail('notfound@example.com');

      expect(user).toBeNull();
    });

    it('should handle case-insensitive email matching', async () => {
      const mockInstance = (wordpressService as any).client;
      mockInstance.get.mockResolvedValue({
        data: [
          { id: 123, username: 'johnsmith', email: 'JOHN@EXAMPLE.COM', roles: ['subscriber'] },
        ],
      });

      const user = await wordpressService.findUserByEmail('john@example.com');

      expect(user).not.toBeNull();
      expect(user?.email).toBe('JOHN@EXAMPLE.COM');
    });

    it('should propagate API errors', async () => {
      const mockInstance = (wordpressService as any).client;
      mockInstance.get.mockRejectedValue(new Error('WordPress API Error'));

      await expect(wordpressService.findUserByEmail('test@example.com')).rejects.toThrow('WordPress API Error');
    });
  });

  describe('updateUserRole', () => {
    beforeEach(() => {
      const mockInstance = (wordpressService as any).client;
      mockInstance.post = jest.fn();
    });

    it('should update user role with correct payload for active Full member', async () => {
      const mockInstance = (wordpressService as any).client;
      mockInstance.post.mockResolvedValue({ data: { success: true } });

      await wordpressService.updateUserRole(123, 'Full', true);

      expect(mockInstance.post).toHaveBeenCalledWith('/users/123', {
        roles: ['full_member'],
        meta: {
          membership_type: 'Full',
          membership_active: true,
          last_updated: expect.any(String),
        },
      });
    });

    it('should update user role to subscriber for inactive member', async () => {
      const mockInstance = (wordpressService as any).client;
      mockInstance.post.mockResolvedValue({ data: { success: true } });

      await wordpressService.updateUserRole(123, 'Full', false);

      expect(mockInstance.post).toHaveBeenCalledWith('/users/123', {
        roles: ['subscriber'],
        meta: {
          membership_type: 'Full',
          membership_active: false,
          last_updated: expect.any(String),
        },
      });
    });

    it('should use default role for unknown membership type', async () => {
      const mockInstance = (wordpressService as any).client;
      mockInstance.post.mockResolvedValue({ data: { success: true } });

      await wordpressService.updateUserRole(123, 'Unknown Type', true);

      expect(mockInstance.post).toHaveBeenCalledWith('/users/123', {
        roles: ['subscriber'],
        meta: {
          membership_type: 'Unknown Type',
          membership_active: true,
          last_updated: expect.any(String),
        },
      });
    });

    it('should handle role mapping for different membership types', async () => {
      const mockInstance = (wordpressService as any).client;
      mockInstance.post.mockResolvedValue({ data: { success: true } });

      // Test Associate member
      await wordpressService.updateUserRole(123, 'Associate', true);
      
      expect(mockInstance.post).toHaveBeenLastCalledWith('/users/123', {
        roles: ['associate_member'],
        meta: {
          membership_type: 'Associate',
          membership_active: true,
          last_updated: expect.any(String),
        },
      });
    });

    it('should propagate API errors', async () => {
      const mockInstance = (wordpressService as any).client;
      mockInstance.post.mockRejectedValue(new Error('WordPress API Error'));

      await expect(wordpressService.updateUserRole(123, 'Full', true)).rejects.toThrow('WordPress API Error');
    });
  });

  describe('updateUserRoleByEmail', () => {
    beforeEach(() => {
      const mockInstance = (wordpressService as any).client;
      mockInstance.get = jest.fn();
      mockInstance.post = jest.fn();
    });

    it('should update user role by email successfully', async () => {
      const mockInstance = (wordpressService as any).client;
      mockInstance.get.mockResolvedValue({
        data: [mockWordPressUser],
      });
      mockInstance.post.mockResolvedValue({ data: { success: true } });

      const result = await wordpressService.updateUserRoleByEmail('john@example.com', 'Full', true);

      expect(result).toBe(true);
      expect(mockInstance.get).toHaveBeenCalledWith('/users', { params: { search: 'john@example.com' } });
      expect(mockInstance.post).toHaveBeenCalledWith('/users/123', expect.any(Object));
    });

    it('should return false when user not found', async () => {
      const mockInstance = (wordpressService as any).client;
      mockInstance.get.mockResolvedValue({ data: [] });

      const result = await wordpressService.updateUserRoleByEmail('notfound@example.com', 'Full', true);

      expect(result).toBe(false);
      expect(mockInstance.post).not.toHaveBeenCalled();
    });

    it('should propagate errors from findUserByEmail', async () => {
      const mockInstance = (wordpressService as any).client;
      mockInstance.get.mockRejectedValue(new Error('API Error'));

      await expect(
        wordpressService.updateUserRoleByEmail('test@example.com', 'Full', true)
      ).rejects.toThrow('API Error');
    });
  });

  describe('updateUserFromReconciliation', () => {
    beforeEach(() => {
      const mockInstance = (wordpressService as any).client;
      mockInstance.get = jest.fn();
      mockInstance.post = jest.fn();
    });

    it('should update WordPress user from reconciliation data', async () => {
      const mockInstance = (wordpressService as any).client;
      mockInstance.get.mockResolvedValue({
        data: [mockWordPressUser],
      });
      mockInstance.post.mockResolvedValue({ data: { success: true } });

      const result = await wordpressService.updateUserFromReconciliation(mockContact as any, mockPaymentData);

      expect(result.success).toBe(true);
      expect(mockInstance.get).toHaveBeenCalledWith('/users', { params: { search: 'john@example.com' } });
      expect(mockInstance.post).toHaveBeenCalledWith('/users/123', {
        roles: ['full_member'],
        meta: {
          membership_type: 'Full',
          membership_active: true,
          last_updated: expect.any(String),
        },
      });
    });

    it('should return false when contact has no email', async () => {
      const contactWithoutEmail = { ...mockContact, email: null };

      const result = await wordpressService.updateUserFromReconciliation(contactWithoutEmail as any, mockPaymentData);

      expect(result.success).toBe(false);
      const mockInstance = (wordpressService as any).client;
      expect(mockInstance.get).not.toHaveBeenCalled();
    });

    it('should return false when WordPress user not found', async () => {
      const mockInstance = (wordpressService as any).client;
      mockInstance.get.mockResolvedValue({ data: [] });

      const result = await wordpressService.updateUserFromReconciliation(mockContact as any, mockPaymentData);

      expect(result.success).toBe(false);
    });

    it('should use default membership type when not specified', async () => {
      const contactWithoutMembership = { ...mockContact, membershipType: null };
      const mockInstance = (wordpressService as any).client;
      mockInstance.get.mockResolvedValue({
        data: [mockWordPressUser],
      });
      mockInstance.post.mockResolvedValue({ data: { success: true } });

      const result = await wordpressService.updateUserFromReconciliation(contactWithoutMembership as any, mockPaymentData);

      expect(result.success).toBe(true);
      expect(mockInstance.post).toHaveBeenCalledWith('/users/123', {
        roles: ['subscriber'], // Default role for "Newsletter Only"
        meta: {
          membership_type: 'Newsletter Only',
          membership_active: true,
          last_updated: expect.any(String),
        },
      });
    });
  });

  describe('testConnection', () => {
    beforeEach(() => {
      const mockInstance = (wordpressService as any).client;
      mockInstance.get = jest.fn();
    });

    it('should return success when connection works', async () => {
      const mockInstance = (wordpressService as any).client;
      mockInstance.get.mockResolvedValue({
        data: {
          id: 1,
          username: 'admin',
          capabilities: { manage_options: true },
        },
      });

      const result = await wordpressService.testConnection();

      expect(result.connected).toBe(true);
      expect(result.version).toBe('WordPress REST API v2');
      expect(mockInstance.get).toHaveBeenCalledWith('/users/me');
    });

    it('should return failure when connection fails', async () => {
      const mockInstance = (wordpressService as any).client;
      const error = {
        response: {
          status: 401,
          data: { message: 'Unauthorized' },
        },
        message: 'Request failed',
      };
      mockInstance.get.mockRejectedValue(error);

      const result = await wordpressService.testConnection();

      expect(result.connected).toBe(false);
      expect(result.error).toBe('WordPress connection failed: Unauthorized');
    });

    it('should handle network errors', async () => {
      const mockInstance = (wordpressService as any).client;
      mockInstance.get.mockRejectedValue(new Error('Network Error'));

      const result = await wordpressService.testConnection();

      expect(result.connected).toBe(false);
      expect(result.error).toBe('WordPress connection failed: Network Error');
    });
  });

  describe('getSiteInfo', () => {
    it('should get WordPress site information', async () => {
      const mockSiteInfo = {
        name: 'Test Site',
        description: 'A test WordPress site',
        url: 'https://example.com',
      };
      
      mockAxios.get.mockResolvedValue({ data: mockSiteInfo });

      const result = await wordpressService.getSiteInfo();

      expect(result).toEqual(mockSiteInfo);
      expect(mockAxios.get).toHaveBeenCalledWith('https://example.com/wp-json/wp/v2/');
    });

    it('should propagate API errors', async () => {
      mockAxios.get.mockRejectedValue(new Error('Site info error'));

      await expect(wordpressService.getSiteInfo()).rejects.toThrow('Site info error');
    });
  });

  describe('retry mechanism', () => {
    beforeEach(() => {
      const mockInstance = (wordpressService as any).client;
      mockInstance.get = jest.fn();
    });

    it('should retry on server errors', async () => {
      const mockInstance = (wordpressService as any).client;
      const serverError = {
        response: { status: 500 },
        message: 'Internal Server Error',
      };
      
      mockInstance.get
        .mockRejectedValueOnce(serverError)
        .mockRejectedValueOnce(serverError)
        .mockResolvedValue({
          data: [mockWordPressUser],
        });

      const user = await wordpressService.findUserByEmail('john@example.com');

      expect(user).not.toBeNull();
      expect(mockInstance.get).toHaveBeenCalledTimes(3);
    });

    it('should not retry on client errors', async () => {
      const mockInstance = (wordpressService as any).client;
      const clientError = {
        response: { status: 401 },
        message: 'Unauthorized',
      };
      
      mockInstance.get.mockRejectedValue(clientError);

      await expect(wordpressService.findUserByEmail('test@example.com')).rejects.toMatchObject({
        message: 'Unauthorized',
      });
      
      expect(mockInstance.get).toHaveBeenCalledTimes(1); // No retries
    });
  });
});