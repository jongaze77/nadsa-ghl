#!/usr/bin/env tsx

/**
 * Script to clear renewal dates from both PostgreSQL database and GoHighLevel
 * 
 * This script will:
 * 1. Set renewal_date field to NULL in PostgreSQL Contact table
 * 2. Remove cWMPNiNAfReHOumOhBB2 from customFields JSON in PostgreSQL
 * 3. Update GHL to set cWMPNiNAfReHOumOhBB2 custom field to empty
 * 
 * Usage: npm run clear-renewal-dates
 */

import { prisma } from '../lib/prisma';
import { fetchContactFromGHL, fetchWithRetry } from '../lib/ghl-api';

const RENEWAL_DATE_FIELD_ID = 'cWMPNiNAfReHOumOhBB2';

interface ClearRenewalDatesOptions {
  dryRun?: boolean;
  limit?: number;
  contactId?: string; // Clear specific contact only
}

async function clearRenewalDatesInGHL(contactId: string, dryRun: boolean = false): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`[GHL] Processing contact ${contactId}${dryRun ? ' (DRY RUN)' : ''}`);
    
    // Fetch current contact from GHL
    const ghlContact = await fetchContactFromGHL(contactId);
    const contact = ghlContact.contact || ghlContact;
    const customFields = contact.customField || contact.customFields || [];
    
    // Check if renewal date field exists and has a value
    let renewalField = null;
    if (Array.isArray(customFields)) {
      renewalField = customFields.find((f: any) => f.id === RENEWAL_DATE_FIELD_ID);
    } else if (typeof customFields === 'object') {
      renewalField = { id: RENEWAL_DATE_FIELD_ID, value: customFields[RENEWAL_DATE_FIELD_ID] };
    }
    
    if (!renewalField?.value) {
      console.log(`[GHL] Contact ${contactId}: Renewal date field already empty, skipping GHL update`);
      return { success: true };
    }
    
    console.log(`[GHL] Contact ${contactId}: Found renewal date "${renewalField.value}", clearing it`);
    
    if (!dryRun) {
      // Clear the renewal date field by setting it to empty string
      // Use fetch directly since we're sending a custom field update structure
      const GHL_API_BASE = 'https://rest.gohighlevel.com/v1';
      const response = await fetchWithRetry(
        `${GHL_API_BASE}/contacts/${contactId}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            customField: {
              [RENEWAL_DATE_FIELD_ID]: ''
            }
          }),
        }
      );
      console.log(`[GHL] Contact ${contactId}: Successfully cleared renewal date field`);
    } else {
      console.log(`[GHL] Contact ${contactId}: Would clear renewal date "${renewalField.value}" (DRY RUN)`);
    }
    
    return { success: true };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[GHL] Failed to clear renewal date for contact ${contactId}:`, error);
    return { success: false, error: errorMessage };
  }
}

async function clearRenewalDatesInDatabase(options: ClearRenewalDatesOptions): Promise<void> {
  const { dryRun = false, limit, contactId } = options;
  
  try {
    console.log('🗄️  Starting database renewal date clearing...');
    
    // Build query conditions
    const whereCondition: any = {
      OR: [
        { renewal_date: { not: null } },
        { customFields: { path: [RENEWAL_DATE_FIELD_ID], not: null } }
      ]
    };
    
    if (contactId) {
      whereCondition.AND = [{ id: contactId }];
    }
    
    // First, get count of affected records
    const affectedCount = await prisma.contact.count({
      where: whereCondition
    });
    
    console.log(`📊 Found ${affectedCount} contacts with renewal date data`);
    
    if (affectedCount === 0) {
      console.log('✅ No contacts found with renewal date data to clear');
      return;
    }
    
    // Get the contacts that will be updated
    const contactsToUpdate = await prisma.contact.findMany({
      where: whereCondition,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        renewal_date: true,
        customFields: true
      },
      take: limit
    });
    
    console.log(`🎯 Processing ${contactsToUpdate.length} contacts${limit ? ` (limited to ${limit})` : ''}`);
    
    for (const contact of contactsToUpdate) {
      const displayName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email || contact.id;
      
      console.log(`\n👤 Processing contact: ${displayName} (${contact.id})`);
      console.log(`   Current renewal_date: ${contact.renewal_date || 'null'}`);
      
      // Check customFields for renewal date
      let customFieldsValue: any = contact.customFields;
      let hasRenewalInCustomFields = false;
      
      if (customFieldsValue && typeof customFieldsValue === 'object') {
        if (Array.isArray(customFieldsValue)) {
          hasRenewalInCustomFields = customFieldsValue.some((cf: any) => cf.id === RENEWAL_DATE_FIELD_ID && cf.value);
        } else {
          hasRenewalInCustomFields = Boolean(customFieldsValue[RENEWAL_DATE_FIELD_ID]);
        }
      }
      
      console.log(`   Has renewal in customFields: ${hasRenewalInCustomFields}`);
      
      if (!dryRun) {
        // Update the database
        const updateData: any = {
          renewal_date: null,
        };
        
        // Clear renewal date from customFields JSON if it exists
        if (hasRenewalInCustomFields && customFieldsValue) {
          if (Array.isArray(customFieldsValue)) {
            // Remove or clear the renewal date field from array
            customFieldsValue = customFieldsValue.filter((cf: any) => cf.id !== RENEWAL_DATE_FIELD_ID);
          } else {
            // Remove the renewal date field from object
            const { [RENEWAL_DATE_FIELD_ID]: removed, ...rest } = customFieldsValue;
            customFieldsValue = rest;
          }
          updateData.customFields = customFieldsValue;
        }
        
        await prisma.contact.update({
          where: { id: contact.id },
          data: updateData
        });
        
        console.log(`   ✅ Database updated`);
      } else {
        console.log(`   🔍 Would update database (DRY RUN)`);
      }
    }
    
    if (!dryRun) {
      console.log(`\n✅ Database update complete! Cleared renewal dates for ${contactsToUpdate.length} contacts`);
    } else {
      console.log(`\n🔍 DRY RUN complete! Would clear renewal dates for ${contactsToUpdate.length} contacts`);
    }
    
  } catch (error) {
    console.error('❌ Database update failed:', error);
    throw error;
  }
}

async function clearRenewalDatesInGHLBatch(options: ClearRenewalDatesOptions): Promise<void> {
  const { dryRun = false, limit, contactId } = options;
  
  try {
    console.log('\n🌐 Starting GHL renewal date clearing...');
    
    // Get contacts from database that we need to update in GHL
    const whereCondition: any = {};
    if (contactId) {
      whereCondition.id = contactId;
    }
    
    const contacts = await prisma.contact.findMany({
      where: whereCondition,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true
      },
      take: limit
    });
    
    console.log(`📋 Processing ${contacts.length} contacts in GHL${limit ? ` (limited to ${limit})` : ''}`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const contact of contacts) {
      const displayName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email || contact.id;
      console.log(`\n🌐 Processing GHL contact: ${displayName} (${contact.id})`);
      
      const result = await clearRenewalDatesInGHL(contact.id, dryRun);
      
      if (result.success) {
        successCount++;
      } else {
        errorCount++;
        console.error(`   ❌ Failed: ${result.error}`);
      }
      
      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`\n📊 GHL update summary:`);
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ❌ Failed: ${errorCount}`);
    
    if (!dryRun) {
      console.log(`✅ GHL update complete!`);
    } else {
      console.log(`🔍 GHL DRY RUN complete!`);
    }
    
  } catch (error) {
    console.error('❌ GHL batch update failed:', error);
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
  const dbOnly = args.includes('--db-only');
  const ghlOnly = args.includes('--ghl-only');
  const showHelp = args.includes('--help') || args.includes('-h');
  
  if (showHelp) {
    console.log('🚀 Clear Renewal Dates Script - Help');
    console.log('=====================================');
    console.log('Usage: npm run clear-renewal-dates -- [options]');
    console.log('');
    console.log('Options:');
    console.log('  --dry-run, -d     Preview changes without making them');
    console.log('  --limit=N         Limit processing to first N contacts');
    console.log('  --contact=ID      Process only the specified contact ID');
    console.log('  --db-only         Only update database, skip GHL updates');
    console.log('  --ghl-only        Only update GHL, skip database updates');
    console.log('  --help, -h        Show this help message');
    console.log('');
    console.log('Examples:');
    console.log('  npm run clear-renewal-dates -- --dry-run');
    console.log('  npm run clear-renewal-dates -- --limit=10');
    console.log('  npm run clear-renewal-dates -- --contact=abc123');
    console.log('  npm run clear-renewal-dates -- --db-only --dry-run');
    return;
  }
  
  const options: ClearRenewalDatesOptions = { dryRun, limit, contactId };
  
  console.log('🚀 Clear Renewal Dates Script');
  console.log('=====================================');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE UPDATE'}`);
  if (limit) console.log(`Limit: ${limit} contacts`);
  if (contactId) console.log(`Target: Single contact ${contactId}`);
  if (dbOnly) console.log(`Scope: Database only`);
  if (ghlOnly) console.log(`Scope: GHL only`);
  console.log('=====================================\n');
  
  if (dryRun) {
    console.log('⚠️  DRY RUN MODE - No actual changes will be made');
  } else {
    console.log('🔴 LIVE MODE - Changes will be permanent');
    console.log('Press Ctrl+C to cancel, or wait 3 seconds to continue...');
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  
  try {
    if (!ghlOnly) {
      await clearRenewalDatesInDatabase(options);
    }
    
    if (!dbOnly) {
      await clearRenewalDatesInGHLBatch(options);
    }
    
    console.log('\n🎉 Script completed successfully!');
    
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