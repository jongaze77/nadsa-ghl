// src/lib/ReconciliationService.ts

import { prisma } from '@/lib/prisma';
import { updateMembershipStatus, type MembershipUpdateData as GHLMembershipUpdateData } from '@/lib/ghl-api';
import { WordPressService } from '@/lib/WordPressService';
import type { ReconciliationLog } from '@prisma/client';
import type { ParsedPaymentData } from '@/lib/CsvParsingService';
import { Decimal } from '@prisma/client/runtime/library';

export interface ConfirmMatchRequest {
  paymentData: ParsedPaymentData;
  contactId: string;
  confidence: number;
  reasoning?: any;
  reconciledByUserId: number;
}

export interface ConfirmMatchResult {
  success: boolean;
  reconciliationLogId: string;
  ghlUpdateResult?: any;
  wordpressUpdateResult?: any;
  errors?: string[];
  rollbackPerformed?: boolean;
}

export interface MembershipUpdateData {
  renewalDate: string;
  membershipStatus: 'active' | 'expired' | 'pending';
  paidTag: boolean;
}

export class ReconciliationService {
  private wordpressService: WordPressService | null = null;
  
  private static readonly RETRY_CONFIG = {
    maxRetries: 3,
    initialDelay: process.env.NODE_ENV === 'test' ? 10 : 1000,
    maxDelay: process.env.NODE_ENV === 'test' ? 100 : 10000,
  };

  constructor() {
    // Initialize WordPress service if configured
    this.initializeWordPressService();
  }

  /**
   * Initialize WordPress service if configuration is available
   */
  private initializeWordPressService(): void {
    try {
      this.wordpressService = new WordPressService();
      console.log(`[ReconciliationService] WordPress service initialized`);
    } catch (error) {
      console.log(`[ReconciliationService] WordPress service not configured:`, error instanceof Error ? error.message : 'Unknown error');
      this.wordpressService = null;
    }
  }

  /**
   * Main method to confirm a match and orchestrate all updates
   */
  async confirmMatch(request: ConfirmMatchRequest): Promise<ConfirmMatchResult> {
    const { paymentData, contactId } = request;
    
    console.log(`[ReconciliationService] Starting match confirmation for contact ${contactId}`);
    
    let reconciliationLog: ReconciliationLog | null = null;
    const errors: string[] = [];

    try {
      // Validate required data
      this.validateConfirmMatchRequest(request);

      // Step 1: Create database records in transaction
      console.log(`[ReconciliationService] Creating reconciliation log entry`);
      reconciliationLog = await this.createReconciliationLog(request);
      
      // Step 2: Update GHL contact
      let ghlUpdateResult;
      try {
        console.log(`[ReconciliationService] Updating GHL contact ${contactId}`);
        ghlUpdateResult = await this.updateGHLContact(contactId, paymentData);
        console.log(`[ReconciliationService] GHL update successful`);
      } catch (ghlError) {
        console.error(`[ReconciliationService] GHL update failed:`, ghlError);
        errors.push(`GHL update failed: ${ghlError instanceof Error ? ghlError.message : 'Unknown error'}`);
        
        // Rollback database transaction
        await this.rollbackReconciliation(reconciliationLog.id);
        return {
          success: false,
          reconciliationLogId: reconciliationLog.id,
          errors,
          rollbackPerformed: true,
        };
      }

      // Step 3: Update WordPress user role
      let wordpressUpdateResult;
      try {
        console.log(`[ReconciliationService] Updating WordPress user role`);
        wordpressUpdateResult = await this.updateWordPressUser(contactId, paymentData);
        console.log(`[ReconciliationService] WordPress update completed`);
      } catch (wpError) {
        console.error(`[ReconciliationService] WordPress update failed:`, wpError);
        errors.push(`WordPress update failed: ${wpError instanceof Error ? wpError.message : 'Unknown error'}`);
        
        // If WordPress fails, we might want to continue or rollback based on business rules
        // For now, we'll log the error but consider the reconciliation successful
        console.log(`[ReconciliationService] Continuing despite WordPress error (business decision)`);
      }

      console.log(`[ReconciliationService] Match confirmation completed successfully`);
      
      return {
        success: true,
        reconciliationLogId: reconciliationLog.id,
        ghlUpdateResult,
        wordpressUpdateResult,
        errors: errors.length > 0 ? errors : undefined,
      };

    } catch (error) {
      console.error(`[ReconciliationService] Match confirmation failed:`, error);
      errors.push(`Reconciliation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Attempt rollback if reconciliation log was created
      if (reconciliationLog) {
        try {
          await this.rollbackReconciliation(reconciliationLog.id);
          return {
            success: false,
            reconciliationLogId: reconciliationLog.id,
            errors,
            rollbackPerformed: true,
          };
        } catch (rollbackError) {
          console.error(`[ReconciliationService] Rollback failed:`, rollbackError);
          errors.push(`Rollback failed: ${rollbackError instanceof Error ? rollbackError.message : 'Unknown error'}`);
        }
      }

      return {
        success: false,
        reconciliationLogId: reconciliationLog?.id || '',
        errors,
        rollbackPerformed: false,
      };
    }
  }

  /**
   * Validate the confirm match request
   */
  private validateConfirmMatchRequest(request: ConfirmMatchRequest): void {
    const { paymentData, contactId, reconciledByUserId } = request;
    
    if (!paymentData?.transactionFingerprint) {
      throw new Error('Transaction fingerprint is required');
    }
    
    if (!paymentData?.amount || paymentData.amount <= 0) {
      throw new Error('Valid payment amount is required');
    }
    
    if (!paymentData?.paymentDate) {
      throw new Error('Payment date is required');
    }
    
    if (!contactId?.trim()) {
      throw new Error('Contact ID is required');
    }
    
    if (!reconciledByUserId || reconciledByUserId <= 0) {
      throw new Error('Valid user ID is required');
    }
    
    // Validate payment date
    const paymentDate = new Date(paymentData.paymentDate);
    if (isNaN(paymentDate.getTime())) {
      throw new Error('Invalid payment date format');
    }
  }

  /**
   * Create reconciliation log and payment source in database transaction
   */
  private async createReconciliationLog(request: ConfirmMatchRequest): Promise<ReconciliationLog> {
    const { paymentData, contactId, confidence, reasoning, reconciledByUserId } = request;
    
    return await prisma.$transaction(async (tx) => {
      // Check if transaction already exists
      const existingReconciliation = await tx.reconciliationLog.findUnique({
        where: { transactionFingerprint: paymentData.transactionFingerprint },
      });

      if (existingReconciliation) {
        throw new Error('Transaction has already been reconciled');
      }

      // Verify contact exists
      const contact = await tx.contact.findUnique({
        where: { id: contactId },
      });

      if (!contact) {
        throw new Error('Contact not found');
      }

      // Verify user exists
      const user = await tx.user.findUnique({
        where: { id: reconciledByUserId },
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Create reconciliation log entry
      const reconciliationLog = await tx.reconciliationLog.create({
        data: {
          transactionFingerprint: paymentData.transactionFingerprint,
          paymentDate: new Date(paymentData.paymentDate),
          amount: new Decimal(paymentData.amount),
          source: paymentData.source || 'BANK_CSV',
          transactionRef: paymentData.transactionRef || paymentData.transactionFingerprint,
          reconciledByUserId: reconciledByUserId,
          contactId: contactId,
          metadata: {
            confidence: confidence,
            reasoning: reasoning,
            description: paymentData.description,
            hashedAccountIdentifier: paymentData.hashedAccountIdentifier,
            reconciledAt: new Date().toISOString(),
          },
        },
      });

      // Create or update payment source if hashedAccountIdentifier exists
      if (paymentData.hashedAccountIdentifier) {
        await tx.paymentSource.upsert({
          where: { hashedIdentifier: paymentData.hashedAccountIdentifier },
          update: {
            contactId: contactId,
          },
          create: {
            hashedIdentifier: paymentData.hashedAccountIdentifier,
            sourceType: paymentData.source === 'STRIPE_REPORT' ? 'stripe_source' : 'bank_account',
            contactId: contactId,
          },
        });
      }

      return reconciliationLog;
    });
  }

  /**
   * Update GHL contact with membership renewal information
   */
  private async updateGHLContact(contactId: string, paymentData: ParsedPaymentData): Promise<any> {
    // Calculate renewal date (1 year from payment date)
    const paymentDate = new Date(paymentData.paymentDate);
    const renewalDate = new Date(paymentDate);
    renewalDate.setFullYear(renewalDate.getFullYear() + 1);
    
    const membershipUpdateData: GHLMembershipUpdateData = {
      renewalDate,
      membershipStatus: 'active',
      paidTag: true,
      paymentAmount: paymentData.amount,
      paymentDate,
    };

    console.log(`[ReconciliationService] Updating GHL contact with membership data:`, membershipUpdateData);
    
    return await this.retryOperation(
      () => updateMembershipStatus(contactId, membershipUpdateData),
      'GHL membership update'
    );
  }

  /**
   * Update WordPress user role based on GHL contact and payment data
   */
  private async updateWordPressUser(contactId: string, paymentData: ParsedPaymentData): Promise<any> {
    if (!this.wordpressService) {
      console.log(`[ReconciliationService] WordPress service not configured - skipping user update`);
      return { status: 'skipped', message: 'WordPress service not configured' };
    }

    try {
      // Get contact details from database
      const contact = await prisma.contact.findUnique({
        where: { id: contactId },
      });

      if (!contact) {
        throw new Error(`Contact ${contactId} not found`);
      }

      console.log(`[ReconciliationService] Updating WordPress user for contact ${contactId} (${contact.email})`);
      
      const result = await this.wordpressService.updateUserFromReconciliation(contact, paymentData);
      
      if (result.success) {
        console.log(`[ReconciliationService] WordPress user update successful for contact ${contactId}`);
        return { status: 'success', userId: result.userId };
      } else {
        console.log(`[ReconciliationService] WordPress user update skipped (user not found) for contact ${contactId}`);
        return { status: 'user_not_found', message: 'WordPress user not found by email' };
      }
    } catch (error) {
      console.error(`[ReconciliationService] WordPress user update error for contact ${contactId}:`, error);
      throw error;
    }
  }

  /**
   * Rollback reconciliation by deleting the reconciliation log
   */
  private async rollbackReconciliation(reconciliationLogId: string): Promise<void> {
    console.log(`[ReconciliationService] Rolling back reconciliation ${reconciliationLogId}`);
    
    await prisma.$transaction(async (tx) => {
      // Delete reconciliation log
      await tx.reconciliationLog.delete({
        where: { id: reconciliationLogId },
      });
      
      console.log(`[ReconciliationService] Reconciliation log ${reconciliationLogId} deleted`);
    });
  }

  /**
   * Health check for external services
   */
  async healthCheck(): Promise<{ ghl: boolean; wordpress: boolean; database: boolean }> {
    const results = {
      ghl: false,
      wordpress: false,
      database: false,
    };

    // Test database connection
    try {
      await prisma.$queryRaw`SELECT 1`;
      results.database = true;
      console.log(`[ReconciliationService] Database health check: OK`);
    } catch (error) {
      console.error(`[ReconciliationService] Database health check failed:`, error);
    }

    // Test GHL connection (simple API call)
    try {
      // This would require a test contact ID or a simple API endpoint
      // For now, we'll assume it's healthy if we have API keys
      const hasGhlConfig = process.env.GHL_API_KEY && process.env.GHL_LOCATION_ID;
      results.ghl = !!hasGhlConfig;
      console.log(`[ReconciliationService] GHL health check: ${results.ghl ? 'OK' : 'MISSING_CONFIG'}`);
    } catch (error) {
      console.error(`[ReconciliationService] GHL health check failed:`, error);
    }

    // Test WordPress connection
    try {
      if (this.wordpressService) {
        const wpHealth = await this.wordpressService.testConnection();
        results.wordpress = wpHealth.connected;
        console.log(`[ReconciliationService] WordPress health check: ${wpHealth.connected ? 'OK' : 'FAILED'}`);
        if (!wpHealth.connected && wpHealth.error) {
          console.error(`[ReconciliationService] WordPress error: ${wpHealth.error}`);
        }
      } else {
        results.wordpress = false;
        console.log(`[ReconciliationService] WordPress health check: NOT_CONFIGURED`);
      }
    } catch (error) {
      console.error(`[ReconciliationService] WordPress health check failed:`, error);
      results.wordpress = false;
    }

    return results;
  }

  /**
   * Retry operation with exponential backoff
   */
  private async retryOperation<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: Error | null = null;
    let delayMs = ReconciliationService.RETRY_CONFIG.initialDelay;

    for (let attempt = 0; attempt <= ReconciliationService.RETRY_CONFIG.maxRetries; attempt++) {
      try {
        const result = await operation();
        if (attempt > 0) {
          console.log(`[ReconciliationService] ${operationName} succeeded on attempt ${attempt + 1}`);
        }
        return result;
      } catch (error) {
        lastError = error as Error;
        console.error(`[ReconciliationService] ${operationName} failed on attempt ${attempt + 1}:`, error);
        
        if (attempt === ReconciliationService.RETRY_CONFIG.maxRetries) {
          break;
        }

        await this.delay(delayMs);
        delayMs = Math.min(delayMs * 2, ReconciliationService.RETRY_CONFIG.maxDelay);
      }
    }

    throw lastError || new Error(`${operationName} failed after ${ReconciliationService.RETRY_CONFIG.maxRetries + 1} attempts`);
  }

  /**
   * Utility method for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}