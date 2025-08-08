// src/lib/WordPressService.ts

import axios, { AxiosInstance, AxiosResponse } from 'axios';
import type { Contact } from '@prisma/client';
import type { ParsedPaymentData } from '@/lib/CsvParsingService';

export interface WordPressUser {
  id: number;
  username: string;
  email: string;
  roles: string[];
  meta?: Record<string, any>;
}

export interface WordPressUserUpdate {
  roles?: string[];
  meta?: Record<string, any>;
}

export interface WordPressConnectionConfig {
  baseUrl: string;
  username: string;
  password: string; // Application Password
  timeout?: number;
}

export interface UserRoleMapping {
  membershipType: string;
  wordpressRole: string;
}

export class WordPressService {
  private client: AxiosInstance;
  private config: WordPressConnectionConfig;
  
  private static readonly DEFAULT_TIMEOUT = 30000; // 30 seconds
  private static readonly RETRY_CONFIG = {
    maxRetries: 3,
    initialDelay: process.env.NODE_ENV === 'test' ? 10 : 1000,
    maxDelay: process.env.NODE_ENV === 'test' ? 100 : 10000,
  };

  // Default role mapping - can be configured via environment or database
  private static readonly ROLE_MAPPINGS: UserRoleMapping[] = [
    { membershipType: 'Full', wordpressRole: 'full_member' },
    { membershipType: 'Associate', wordpressRole: 'associate_member' },
    { membershipType: 'Newsletter Only', wordpressRole: 'subscriber' },
    { membershipType: 'Ex Member', wordpressRole: 'subscriber' },
  ];

  constructor(config?: WordPressConnectionConfig) {
    // Get configuration from environment or parameter
    this.config = config || this.getConfigFromEnv();
    
    // Ensure trailing slash is removed from baseUrl
    if (this.config.baseUrl) {
      this.config.baseUrl = this.config.baseUrl.replace(/\/$/, '');
    }
    
    // Create Axios instance
    this.client = axios.create({
      baseURL: `${this.config.baseUrl}/wp-json/wp/v2`,
      timeout: this.config.timeout || WordPressService.DEFAULT_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'GHL-Client-Manager/1.0',
      },
      auth: {
        username: this.config.username,
        password: this.config.password,
      },
    });

    // Add request/response interceptors for logging
    this.setupInterceptors();
  }

  /**
   * Get WordPress configuration from environment variables
   */
  private getConfigFromEnv(): WordPressConnectionConfig {
    const baseUrl = process.env.WORDPRESS_API_URL;
    const username = process.env.WORDPRESS_API_USERNAME;
    const password = process.env.WORDPRESS_API_PASSWORD;

    if (!baseUrl || !username || !password) {
      throw new Error(
        'Missing WordPress configuration. Required: WORDPRESS_API_URL, WORDPRESS_API_USERNAME, WORDPRESS_API_PASSWORD'
      );
    }

    return {
      baseUrl: baseUrl.replace(/\/$/, ''), // Remove trailing slash
      username,
      password,
    };
  }

  /**
   * Setup Axios interceptors for logging and error handling
   */
  private setupInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        console.log(`[WordPress-API] ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error(`[WordPress-API] Request error:`, error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        console.log(`[WordPress-API] ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        const status = error.response?.status || 'NO_RESPONSE';
        const url = error.config?.url || 'UNKNOWN_URL';
        console.error(`[WordPress-API] ${status} ${url}:`, error.message);
        
        // Handle specific WordPress errors
        if (error.response?.status === 401) {
          console.error(`[WordPress-API] Authentication failed. Check WORDPRESS_API_USERNAME and WORDPRESS_API_PASSWORD`);
        } else if (error.response?.status === 403) {
          console.error(`[WordPress-API] Forbidden. User may not have sufficient permissions`);
        } else if (error.response?.status === 404) {
          console.error(`[WordPress-API] Endpoint not found. Check WordPress REST API is enabled`);
        }
        
        return Promise.reject(error);
      }
    );
  }

  /**
   * Find WordPress user by email address
   */
  async findUserByEmail(email: string): Promise<WordPressUser | null> {
    console.log(`[WordPress-API] Finding user by email: ${email}`);
    
    try {
      const response = await this.retryOperation(
        () => this.client.get('/users', { params: { search: email } }),
        'Find user by email'
      );

      const users = response.data as any[];
      
      // Find exact email match (search might return partial matches)
      const user = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
      
      if (!user) {
        console.log(`[WordPress-API] User not found with email: ${email}`);
        return null;
      }

      console.log(`[WordPress-API] Found user: ${user.username} (ID: ${user.id})`);
      
      return {
        id: user.id,
        username: user.username,
        email: user.email,
        roles: user.roles || [],
        meta: user.meta || {},
      };
    } catch (error) {
      console.error(`[WordPress-API] Failed to find user by email ${email}:`, error);
      throw error;
    }
  }

  /**
   * Update WordPress user role based on membership type
   */
  async updateUserRole(userId: number, membershipType: string, isActive: boolean = true): Promise<void> {
    console.log(`[WordPress-API] Updating user role for user ${userId}: ${membershipType} (active: ${isActive})`);
    
    // Determine the WordPress role based on membership type
    const targetRole = this.getMappedRole(membershipType, isActive);
    
    try {
      const updateData: WordPressUserUpdate = {
        roles: [targetRole],
        meta: {
          membership_type: membershipType,
          membership_active: isActive,
          last_updated: new Date().toISOString(),
        },
      };

      await this.retryOperation(
        () => this.client.post(`/users/${userId}`, updateData),
        'Update user role'
      );

      console.log(`[WordPress-API] Successfully updated user ${userId} to role: ${targetRole}`);
    } catch (error) {
      console.error(`[WordPress-API] Failed to update user role for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Update user role by email (convenience method)
   */
  async updateUserRoleByEmail(email: string, membershipType: string, isActive: boolean = true): Promise<boolean> {
    console.log(`[WordPress-API] Updating user role by email: ${email}`);
    
    try {
      const user = await this.findUserByEmail(email);
      
      if (!user) {
        console.log(`[WordPress-API] Cannot update role - user not found: ${email}`);
        return false;
      }

      await this.updateUserRole(user.id, membershipType, isActive);
      return true;
    } catch (error) {
      console.error(`[WordPress-API] Failed to update user role by email ${email}:`, error);
      throw error;
    }
  }

  /**
   * Update WordPress user role based on GHL contact and payment data
   */
  async updateUserFromReconciliation(
    contact: Contact, 
    _paymentData: ParsedPaymentData
  ): Promise<{ success: boolean; userId?: number }> {
    console.log(`[WordPress-API] Updating user from reconciliation for contact ${contact.id}`);
    
    if (!contact.email) {
      console.log(`[WordPress-API] Cannot update WordPress user - no email for contact ${contact.id}`);
      return { success: false };
    }

    try {
      const membershipType = contact.membershipType || 'Newsletter Only';
      const isActive = true; // Payment received means active membership
      
      const userUpdated = await this.updateUserRoleByEmail(
        contact.email,
        membershipType,
        isActive
      );

      if (!userUpdated) {
        console.log(`[WordPress-API] User not found in WordPress for email: ${contact.email}`);
        return { success: false };
      }

      console.log(`[WordPress-API] Successfully updated WordPress user for contact ${contact.id}`);
      return { success: true };
    } catch (error) {
      console.error(`[WordPress-API] Failed to update WordPress user for contact ${contact.id}:`, error);
      throw error;
    }
  }

  /**
   * Map membership type to WordPress role
   */
  private getMappedRole(membershipType: string, isActive: boolean): string {
    if (!isActive) {
      return 'subscriber'; // Inactive members become subscribers
    }

    const mapping = WordPressService.ROLE_MAPPINGS.find(
      m => m.membershipType.toLowerCase() === membershipType.toLowerCase()
    );

    return mapping?.wordpressRole || 'subscriber'; // Default to subscriber if no mapping found
  }

  /**
   * Test WordPress API connectivity and authentication
   */
  async testConnection(): Promise<{ connected: boolean; error?: string; version?: string }> {
    console.log(`[WordPress-API] Testing connection to ${this.config.baseUrl}`);
    
    try {
      // Test basic connectivity with a simple endpoint
      const response = await this.client.get('/users/me');
      const userData = response.data;

      console.log(`[WordPress-API] Connection successful. Authenticated as: ${userData.username}`);
      
      return {
        connected: true,
        version: userData.capabilities ? 'WordPress REST API v2' : 'Unknown',
      };
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
      console.error(`[WordPress-API] Connection test failed:`, errorMessage);
      
      return {
        connected: false,
        error: `WordPress connection failed: ${errorMessage}`,
      };
    }
  }

  /**
   * Get WordPress site information
   */
  async getSiteInfo(): Promise<any> {
    console.log(`[WordPress-API] Getting site information`);
    
    try {
      const response = await this.retryOperation(
        () => axios.get(`${this.config.baseUrl}/wp-json/wp/v2/`),
        'Get site info'
      );

      return response.data;
    } catch (error) {
      console.error(`[WordPress-API] Failed to get site info:`, error);
      throw error;
    }
  }

  /**
   * Retry operation with exponential backoff
   */
  private async retryOperation<T>(
    operation: () => Promise<AxiosResponse<T>>,
    operationName: string
  ): Promise<AxiosResponse<T>> {
    let lastError: Error | null = null;
    let delayMs = WordPressService.RETRY_CONFIG.initialDelay;

    for (let attempt = 0; attempt <= WordPressService.RETRY_CONFIG.maxRetries; attempt++) {
      try {
        const result = await operation();
        if (attempt > 0) {
          console.log(`[WordPress-API] ${operationName} succeeded on attempt ${attempt + 1}`);
        }
        return result;
      } catch (error: any) {
        lastError = error;
        console.error(`[WordPress-API] ${operationName} failed on attempt ${attempt + 1}:`, error.message);
        
        // Don't retry on authentication or client errors
        if (error.response?.status && error.response.status < 500) {
          console.error(`[WordPress-API] Not retrying client error (${error.response.status})`);
          break;
        }
        
        if (attempt === WordPressService.RETRY_CONFIG.maxRetries) {
          break;
        }

        await this.delay(delayMs);
        delayMs = Math.min(delayMs * 2, WordPressService.RETRY_CONFIG.maxDelay);
      }
    }

    throw lastError || new Error(`${operationName} failed after ${WordPressService.RETRY_CONFIG.maxRetries + 1} attempts`);
  }

  /**
   * Utility method for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current configuration (for debugging)
   */
  getConfig(): Omit<WordPressConnectionConfig, 'password'> {
    return {
      baseUrl: this.config.baseUrl,
      username: this.config.username,
      timeout: this.config.timeout,
    };
  }
}