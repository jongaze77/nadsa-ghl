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
      
      // Step 2: Update pending payment status to 'matched'
      console.log(`[ReconciliationService] Updating pending payment status`);
      await this.updatePendingPaymentStatus(paymentData.transactionFingerprint, 'matched');
      
      // Step 3: Update GHL contact
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

      // Step 4: Update WordPress user role
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
   * Update GHL contact with membership renewal information and notes
   */
  private async updateGHLContact(contactId: string, paymentData: ParsedPaymentData): Promise<any> {
    console.log(`[ReconciliationService] Starting GHL contact update for ${contactId}`);
    
    // Step 1: Fetch current contact details to validate membership type and get current renewal date
    const currentContact = await this.fetchContactDetails(contactId);
    
    // Step 2: Validate membership type and determine expected payment amount
    const membershipValidation = this.validateMembershipPayment(currentContact, paymentData);
    console.log(`[ReconciliationService] Membership validation:`, membershipValidation);
    
    // Step 3: Calculate smart renewal date (never go backwards)
    const smartRenewalDate = this.calculateSmartRenewalDate(paymentData.paymentDate, currentContact.renewalDate);
    console.log(`[ReconciliationService] Smart renewal date: ${smartRenewalDate.toISOString().split('T')[0]}`);
    
    // Step 4: Update membership status and renewal date
    const membershipUpdateData: GHLMembershipUpdateData = {
      renewalDate: smartRenewalDate,
      membershipStatus: 'active',
      paidTag: true,
      paymentAmount: paymentData.amount,
      paymentDate: new Date(paymentData.paymentDate),
    };

    console.log(`[ReconciliationService] Updating GHL contact with membership data:`, membershipUpdateData);
    
    const membershipUpdateResult = await this.retryOperation(
      () => updateMembershipStatus(contactId, membershipUpdateData),
      'GHL membership update'
    );
    
    // Step 5: Add reconciliation note to GHL contact
    const noteResult = await this.addReconciliationNote(contactId, paymentData, membershipValidation, smartRenewalDate);
    
    return {
      membershipUpdate: membershipUpdateResult,
      noteAdded: noteResult,
      membershipValidation,
      renewalDate: smartRenewalDate
    };
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
   * Update pending payment status
   */
  private async updatePendingPaymentStatus(transactionFingerprint: string, status: string): Promise<void> {
    try {
      const updatedPayment = await prisma.pendingPayment.update({
        where: { transactionFingerprint },
        data: { status },
      });
      console.log(`[ReconciliationService] Updated payment ${transactionFingerprint} status to ${status}`);
    } catch (error) {
      console.error(`[ReconciliationService] Failed to update payment status:`, error);
      // Don't throw here - this is a non-critical update
      // The reconciliation log is the source of truth
    }
  }

  /**
   * Fetch current contact details from GHL to get membership type and renewal date
   */
  private async fetchContactDetails(contactId: string): Promise<{
    membershipType: string | null;
    renewalDate: Date | null;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
  }> {
    try {
      const { fetchContactFromGHL } = await import('./ghl-api');
      const ghlContact = await fetchContactFromGHL(contactId);
      
      // Extract current renewal date from custom fields
      let currentRenewalDate: Date | null = null;
      const renewalDateFieldId = 'cWMPNiNAfReHOumOhBB2'; // renewal_date field ID
      
      if (ghlContact.customFields) {
        const renewalField = Array.isArray(ghlContact.customFields)
          ? ghlContact.customFields.find((f: any) => f.id === renewalDateFieldId)
          : ghlContact.customFields[renewalDateFieldId];
          
        if (renewalField) {
          const dateValue = typeof renewalField === 'object' ? renewalField.value : renewalField;
          if (dateValue) {
            currentRenewalDate = new Date(dateValue);
          }
        }
      }
      
      // Extract membership type
      const membershipTypeFieldId = 'gH97LlNC9Y4PlkKVlY8V';
      const singleDoubleFieldId = 'hJQPtsVDFBxI1USEN83v'; // single_or_double_membership field
      let membershipType: string | null = null;
      let singleDoubleType: string | null = null;
      
      if (ghlContact.customFields) {
        const membershipField = Array.isArray(ghlContact.customFields)
          ? ghlContact.customFields.find((f: any) => f.id === membershipTypeFieldId)
          : ghlContact.customFields[membershipTypeFieldId];
          
        if (membershipField) {
          membershipType = typeof membershipField === 'object' ? membershipField.value : membershipField;
        }
        
        // Also check the single/double field
        const singleDoubleField = Array.isArray(ghlContact.customFields)
          ? ghlContact.customFields.find((f: any) => f.id === singleDoubleFieldId)
          : ghlContact.customFields[singleDoubleFieldId];
          
        if (singleDoubleField) {
          singleDoubleType = typeof singleDoubleField === 'object' ? singleDoubleField.value : singleDoubleField;
        }
      }
      
      // Combine membership types - prefer single/double if available
      let finalMembershipType = membershipType;
      if (singleDoubleType && ['Single', 'Double'].includes(singleDoubleType)) {
        finalMembershipType = singleDoubleType;
      }
      
      return {
        membershipType: finalMembershipType?.trim() || null,
        renewalDate: currentRenewalDate,
        firstName: ghlContact.firstName || null,
        lastName: ghlContact.lastName || null,
        email: ghlContact.email || null
      };
    } catch (error) {
      console.error(`[ReconciliationService] Failed to fetch contact details for ${contactId}:`, error);
      return {
        membershipType: null,
        renewalDate: null,
        firstName: null,
        lastName: null,
        email: null
      };
    }
  }

  /**
   * Validate membership type and payment amount
   */
  private validateMembershipPayment(contact: {
    membershipType: string | null;
    firstName: string | null;
    lastName: string | null;
  }, paymentData: ParsedPaymentData): {
    isValid: boolean;
    membershipType: string | null;
    expectedAmount: string;
    actualAmount: number;
    warning?: string;
  } {
    const membershipFees = {
      'Full': { min: 60, max: 80, typical: 70 },
      'Associate': { min: 40, max: 60, typical: 50 },
      'Single': { min: 60, max: 80, typical: 70 }, // Same as Full
      'Double': { min: 60, max: 80, typical: 70 }, // Same as Full
      'Newsletter Only': { min: 10, max: 20, typical: 15 },
      'None': { min: 10, max: 80, typical: 30 } // Wide range for upgrading members
    };
    
    const membershipType = contact.membershipType;
    const paymentAmount = paymentData.amount;
    
    if (!membershipType) {
      return {
        isValid: false,
        membershipType: null,
        expectedAmount: 'Unknown - no membership type recorded',
        actualAmount: paymentAmount,
        warning: `Contact ${((contact.firstName || '') + ' ' + (contact.lastName || '')).trim() || '[Unknown Name]'} has no membership type recorded in GHL`
      };
    }
    
    // Normalize membership type
    let normalizedType = membershipType;
    const typeMap: Record<string, string> = {
      'single': 'Single',
      'double': 'Double', 
      'associate': 'Associate',
      'full': 'Full',
      'newsletter': 'Newsletter Only',
      'newsletter only': 'Newsletter Only',
      'none': 'None'
    };
    
    const lowerType = membershipType.toLowerCase().trim();
    if (typeMap[lowerType]) {
      normalizedType = typeMap[lowerType];
    }
    
    const feeRange = membershipFees[normalizedType as keyof typeof membershipFees];
    
    if (!feeRange) {
      return {
        isValid: false,
        membershipType: normalizedType,
        expectedAmount: 'Unknown membership type',
        actualAmount: paymentAmount,
        warning: `Unknown membership type: ${normalizedType}`
      };
    }
    
    const isWithinRange = paymentAmount >= feeRange.min && paymentAmount <= feeRange.max;
    const expectedRange = `£${feeRange.min}-${feeRange.max} (typical: £${feeRange.typical})`;
    
    return {
      isValid: isWithinRange,
      membershipType: normalizedType,
      expectedAmount: expectedRange,
      actualAmount: paymentAmount,
      warning: isWithinRange ? undefined : `Payment amount £${paymentAmount} is outside expected range ${expectedRange}`
    };
  }

  /**
   * Calculate smart renewal date - never go backwards from existing renewal date
   */
  private calculateSmartRenewalDate(paymentDate: string | Date, currentRenewalDate: Date | null): Date {
    const paymentDateObj = new Date(paymentDate);
    const newRenewalDate = new Date(paymentDateObj);
    newRenewalDate.setFullYear(newRenewalDate.getFullYear() + 1);
    
    if (currentRenewalDate) {
      // If there's an existing renewal date, never go backwards
      if (newRenewalDate > currentRenewalDate) {
        console.log(`[ReconciliationService] Advancing renewal date from ${currentRenewalDate.toISOString().split('T')[0]} to ${newRenewalDate.toISOString().split('T')[0]}`);
        return newRenewalDate;
      } else {
        console.log(`[ReconciliationService] Keeping existing renewal date ${currentRenewalDate.toISOString().split('T')[0]} (would not advance from payment date ${paymentDateObj.toISOString().split('T')[0]})`);
        return currentRenewalDate;
      }
    } else {
      console.log(`[ReconciliationService] Setting initial renewal date to ${newRenewalDate.toISOString().split('T')[0]} (payment date + 1 year)`);
      return newRenewalDate;
    }
  }

  /**
   * Add a reconciliation note to the GHL contact
   */
  private async addReconciliationNote(
    contactId: string,
    paymentData: ParsedPaymentData,
    validation: { isValid: boolean; membershipType: string | null; expectedAmount: string; actualAmount: number; warning?: string },
    renewalDate: Date
  ): Promise<any> {
    try {
      console.log(`[ReconciliationService] Adding reconciliation note to contact ${contactId}`);
      
      const paymentDateStr = new Date(paymentData.paymentDate).toLocaleDateString('en-GB');
      const renewalDateStr = renewalDate.toLocaleDateString('en-GB');
      const timestamp = new Date().toLocaleString('en-GB');
      
      let noteText = `🔄 Payment Reconciliation - ${timestamp}\n`;
      noteText += `💳 Payment: £${paymentData.amount} on ${paymentDateStr}\n`;
      noteText += `📝 Reference: ${paymentData.transactionRef || paymentData.transactionFingerprint}\n`;
      
      if (paymentData.customer_name) {
        noteText += `👤 Customer Name: ${paymentData.customer_name}\n`;
      }
      if (paymentData.customer_email) {
        noteText += `📧 Customer Email: ${paymentData.customer_email}\n`;
      }
      
      noteText += `🏷️ Membership Type: ${validation.membershipType || 'Unknown'}\n`;
      noteText += `💰 Expected Amount: ${validation.expectedAmount}\n`;
      noteText += `📅 Renewal Date: ${renewalDateStr}\n`;
      noteText += `🔧 Renewal Date (ISO): ${renewalDate.toISOString().split('T')[0]}\n`;
      
      if (validation.warning) {
        noteText += `⚠️ Warning: ${validation.warning}\n`;
      }
      
      if (!validation.isValid) {
        noteText += `❌ Validation: Payment amount does not match expected range\n`;
      } else {
        noteText += `✅ Validation: Payment amount confirmed\n`;
      }
      
      noteText += `🔧 Source: Automated reconciliation system\n`;
      noteText += `📊 GHL Field Updates: renewal_date=${renewalDate.toISOString().split('T')[0]}, tags=Paid,Active Member`;
      
      // Add note via GHL API
      const { fetchWithRetry } = await import('./ghl-api');
      const GHL_API_BASE = 'https://rest.gohighlevel.com/v1';
      const notePayload = {
        body: noteText,
        contactId: contactId
      };
      
      const response = await fetchWithRetry(
        `${GHL_API_BASE}/contacts/${contactId}/notes`,
        {
          method: 'POST',
          body: JSON.stringify(notePayload)
        }
      );
      
      const result = await response.json();
      console.log(`[ReconciliationService] Successfully added note to contact ${contactId}`);
      return result;
      
    } catch (error) {
      console.error(`[ReconciliationService] Failed to add note to contact ${contactId}:`, error);
      throw error;
    }
  }

  /**
   * Utility method for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}