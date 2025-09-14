#!/usr/bin/env tsx

/**
 * Script to update renewal_date field based on ReconciliationLog data
 * 
 * This script reads from the ReconciliationLog table to find all reconciled payments
 * and updates the renewal_date field in the Contact table based on the payment dates.
 * 
 * Logic: payment_date + 1 year = renewal_date (but never go backward from existing dates)
 * 
 * Usage: npm run update-renewal-dates-from-reconciliation
 */

import { prisma } from '../lib/prisma';

const RENEWAL_DATE_FIELD_ID = 'cWMPNiNAfReHOumOhBB2';

interface UpdateOptions {
  dryRun?: boolean;
  limit?: number;
  contactId?: string;
  skipIfExists?: boolean; // Skip contacts that already have renewal_date
}

interface UpdateStats {
  totalReconciliations: number;
  contactsProcessed: number;
  updated: number;
  noChange: number;
  errors: number;
  skippedExisting: number;
  alreadyCorrect: number;
}

/**
 * Calculate smart renewal date - never go backwards from existing renewal date
 */
function calculateSmartRenewalDate(paymentDate: Date, currentRenewalDate: string | null): { newDate: string; reason: string } {
  const paymentDateObj = new Date(paymentDate);
  const newRenewalDate = new Date(paymentDateObj);
  newRenewalDate.setFullYear(newRenewalDate.getFullYear() + 1);
  const newRenewalDateString = newRenewalDate.toISOString().split('T')[0];
  
  if (currentRenewalDate) {
    const currentRenewalDateObj = new Date(currentRenewalDate);
    
    // If new renewal date is later, use it
    if (newRenewalDate > currentRenewalDateObj) {
      return {
        newDate: newRenewalDateString,
        reason: `Advanced from ${currentRenewalDate} to ${newRenewalDateString} (payment date + 1 year)`
      };
    } else {
      return {
        newDate: currentRenewalDate,
        reason: `Kept existing ${currentRenewalDate} (would not advance from payment date ${paymentDateObj.toISOString().split('T')[0]})`
      };
    }
  } else {
    return {
      newDate: newRenewalDateString,
      reason: `Set initial renewal date to ${newRenewalDateString} (payment date + 1 year)`
    };
  }
}

/**
 * Update contact renewal date in database
 */
async function updateContactRenewalDate(
  contactId: string, 
  renewalDateString: string, 
  currentCustomFields: any,
  dryRun: boolean
): Promise<boolean> {
  try {
    if (dryRun) {
      console.log(`       🔍 Would update database renewal_date to: ${renewalDateString} (DRY RUN)`);
      return true;
    }

    // Update the customFields JSON to include the new renewal date
    let updatedCustomFields = currentCustomFields || {};
    
    // Handle both array and object formats of customFields
    if (Array.isArray(updatedCustomFields)) {
      // If it's an array format, update or add the renewal date field
      const existingFieldIndex = updatedCustomFields.findIndex((field: any) => field.id === RENEWAL_DATE_FIELD_ID);
      if (existingFieldIndex >= 0) {
        // Update existing field
        updatedCustomFields[existingFieldIndex].value = renewalDateString;
      } else {
        // Add new field
        updatedCustomFields.push({ id: RENEWAL_DATE_FIELD_ID, value: renewalDateString });
      }
    } else {
      // If it's an object format, just set the field
      updatedCustomFields = {
        ...updatedCustomFields,
        [RENEWAL_DATE_FIELD_ID]: renewalDateString
      };
    }
    
    // Update both renewal_date field and customFields JSON
    await prisma.contact.update({
      where: { id: contactId },
      data: {
        renewal_date: renewalDateString,
        customFields: updatedCustomFields,
        updatedAt: new Date(),
      }
    });
    
    console.log(`       ✅ Updated database renewal_date and customFields JSON`);
    return true;
    
  } catch (error) {
    console.error(`       ❌ Database update failed:`, error);
    return false;
  }
}

/**
 * Update renewal dates based on reconciliation data
 */
async function updateRenewalDatesFromReconciliation(options: UpdateOptions): Promise<UpdateStats> {
  const { dryRun = false, limit, contactId, skipIfExists = false } = options;
  const stats: UpdateStats = {
    totalReconciliations: 0,
    contactsProcessed: 0,
    updated: 0,
    noChange: 0,
    errors: 0,
    skippedExisting: 0,
    alreadyCorrect: 0
  };
  
  try {
    console.log('📋 Starting renewal date updates from ReconciliationLog...');
    
    // Build query conditions for reconciliation logs
    const reconciliationWhere: any = {};
    if (contactId) {
      reconciliationWhere.contactId = contactId;
    }
    
    // Get all reconciliation logs with contact data
    const reconciliations = await prisma.reconciliationLog.findMany({
      where: reconciliationWhere,
      include: {
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            renewal_date: true,
            customFields: true
          }
        }
      },
      orderBy: { paymentDate: 'desc' }, // Most recent payments first
      take: limit
    });
    
    stats.totalReconciliations = reconciliations.length;
    console.log(`📊 Found ${reconciliations.length} reconciliation records${limit ? ` (limited to ${limit})` : ''}`);
    
    if (reconciliations.length === 0) {
      console.log('✅ No reconciliation records found');
      return stats;
    }
    
    // Group by contact to get the most recent payment for each contact
    const contactPayments = new Map<string, typeof reconciliations[0]>();
    
    for (const reconciliation of reconciliations) {
      const contactId = reconciliation.contactId;
      
      if (!contactPayments.has(contactId)) {
        contactPayments.set(contactId, reconciliation);
      } else {
        // Keep the most recent payment (since we ordered by paymentDate desc)
        const existing = contactPayments.get(contactId)!;
        if (reconciliation.paymentDate > existing.paymentDate) {
          contactPayments.set(contactId, reconciliation);
        }
      }
    }
    
    stats.contactsProcessed = contactPayments.size;
    console.log(`👥 Found ${contactPayments.size} unique contacts with reconciled payments\n`);
    
    for (const [contactId, reconciliation] of contactPayments) {
      const contact = reconciliation.contact;
      const displayName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email || contact.id;
      
      try {
        console.log(`👤 Processing: ${displayName} (${contact.id})`);
        console.log(`   💳 Latest payment: ${reconciliation.paymentDate.toISOString().split('T')[0]} (£${reconciliation.amount})`);
        console.log(`   📅 Current renewal_date: ${contact.renewal_date || 'null'}`);
        
        // Skip if contact already has renewal_date and skipIfExists is true
        if (skipIfExists && contact.renewal_date) {
          console.log(`   ⏭️  Already has renewal_date - skipping`);
          stats.skippedExisting++;
          continue;
        }
        
        // Calculate new renewal date using smart logic
        const { newDate, reason } = calculateSmartRenewalDate(reconciliation.paymentDate, contact.renewal_date);
        console.log(`   🧠 Smart calculation: ${reason}`);
        
        // Check if renewal_date would actually change
        if (contact.renewal_date === newDate) {
          console.log(`   ✅ Already correct - no change needed`);
          stats.alreadyCorrect++;
          continue;
        }
        
        console.log(`   📅 Will update: "${contact.renewal_date || 'null'}" -> "${newDate}"`);
        
        // Update the contact
        const success = await updateContactRenewalDate(
          contact.id, 
          newDate, 
          contact.customFields,
          dryRun
        );
        
        if (success) {
          stats.updated++;
        } else {
          stats.errors++;
        }
        
      } catch (error) {
        console.error(`   ❌ Error processing contact ${contact.id}:`, error);
        stats.errors++;
      }
      
      console.log(''); // Empty line for readability
    }
    
    return stats;
    
  } catch (error) {
    console.error('❌ Update process failed:', error);
    throw error;
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  // Parse command line arguments
  const dryRun = args.includes('--dry-run') || args.includes('-d');
  const limitArg = args.find(arg => arg.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : undefined;
  const contactIdArg = args.find(arg => arg.startsWith('--contact='));
  const contactId = contactIdArg ? contactIdArg.split('=')[1] : undefined;
  const skipIfExists = args.includes('--skip-existing');
  const showHelp = args.includes('--help') || args.includes('-h');
  
  if (showHelp) {
    console.log('📋 Update Renewal Dates from Reconciliation Script - Help');
    console.log('========================================================');
    console.log('Usage: npm run update-renewal-dates-from-reconciliation -- [options]');
    console.log('');
    console.log('This script reads from ReconciliationLog to find reconciled payments');
    console.log('and updates renewal_date field based on payment_date + 1 year.');
    console.log('Uses smart logic: never goes backward from existing renewal dates.');
    console.log('');
    console.log('Options:');
    console.log('  --dry-run, -d       Preview changes without making them');
    console.log('  --limit=N           Limit processing to first N reconciliation records');
    console.log('  --contact=ID        Process only the specified contact ID');
    console.log('  --skip-existing     Only process contacts with null renewal_date');
    console.log('  --help, -h          Show this help message');
    console.log('');
    console.log('Examples:');
    console.log('  npm run update-renewal-dates-from-reconciliation -- --dry-run');
    console.log('  npm run update-renewal-dates-from-reconciliation -- --skip-existing');
    console.log('  npm run update-renewal-dates-from-reconciliation -- --contact=abc123');
    console.log('  npm run update-renewal-dates-from-reconciliation -- --dry-run --limit=5');
    return;
  }
  
  const options: UpdateOptions = { dryRun, limit, contactId, skipIfExists };
  
  console.log('📋 Update Renewal Dates from Reconciliation Script');
  console.log('==================================================');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE UPDATE'}`);
  if (limit) console.log(`Limit: ${limit} reconciliation records`);
  if (contactId) console.log(`Target: Single contact ${contactId}`);
  if (skipIfExists) console.log(`Filter: Only null renewal_date contacts`);
  console.log('==================================================\n');
  
  if (dryRun) {
    console.log('⚠️  DRY RUN MODE - No actual changes will be made');
  } else {
    console.log('🔴 LIVE MODE - Changes will be permanent');
    console.log('Press Ctrl+C to cancel, or wait 3 seconds to continue...');
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  
  try {
    const stats = await updateRenewalDatesFromReconciliation(options);
    
    console.log('📊 UPDATE SUMMARY');
    console.log('==================');
    console.log(`📋 Reconciliation records found: ${stats.totalReconciliations}`);
    console.log(`👥 Contacts processed: ${stats.contactsProcessed}`);
    console.log(`✅ Successfully updated: ${stats.updated}`);
    console.log(`✅ Already correct: ${stats.alreadyCorrect}`);
    console.log(`⏭️  Skipped (already has renewal_date): ${stats.skippedExisting}`);
    console.log(`ℹ️  No change needed: ${stats.noChange}`);
    console.log(`❌ Errors: ${stats.errors}`);
    
    if (!dryRun && stats.updated > 0) {
      console.log(`\n🎉 Successfully updated ${stats.updated} renewal dates from reconciliation data!`);
    } else if (dryRun && stats.updated > 0) {
      console.log(`\n🔍 DRY RUN: Would update ${stats.updated} renewal dates from reconciliation data`);
    } else if (stats.alreadyCorrect > 0) {
      console.log(`\n✅ All ${stats.alreadyCorrect} contacts already have correct renewal dates!`);
    } else {
      console.log('\n✅ No updates needed or possible!');
    }
    
  } catch (error) {
    console.error('\n💥 Script failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Script interrupted by user');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Script terminated');
  await prisma.$disconnect();
  process.exit(0);
});

if (require.main === module) {
  main().catch(console.error);
}