#!/usr/bin/env tsx

/**
 * Script to sync renewal dates from GoHighLevel to local database
 * 
 * This script fetches renewal dates directly from GHL API and updates both:
 * 1. The renewal_date column in the Contact table
 * 2. The customFields JSON with the cWMPNiNAfReHOumOhBB2 field
 * 
 * Usage: npm run sync-renewal-dates-from-ghl
 */

import { prisma } from '../lib/prisma';
import { fetchContactFromGHL } from '../lib/ghl-api';

const RENEWAL_DATE_FIELD_ID = 'cWMPNiNAfReHOumOhBB2';

interface SyncOptions {
  dryRun?: boolean;
  limit?: number;
  contactId?: string;
  skipIfExists?: boolean; // Skip contacts that already have renewal_date
}

interface SyncStats {
  total: number;
  updated: number;
  noChange: number;
  errors: number;
  ghlNotFound: number;
  noRenewalInGhl: number;
  skippedExisting: number;
}

/**
 * Extract renewal date from GHL contact data
 */
function extractRenewalDateFromGHL(ghlContact: any): string | null {
  try {
    // Handle nested contact structure from GHL API response
    const contact = ghlContact.contact || ghlContact;
    const customFieldsData = contact.customField || contact.customFields || [];
    
    if (Array.isArray(customFieldsData)) {
      const renewalField = customFieldsData.find((f: any) => f.id === RENEWAL_DATE_FIELD_ID);
      return renewalField?.value || null;
    } else if (typeof customFieldsData === 'object') {
      return customFieldsData[RENEWAL_DATE_FIELD_ID] || null;
    }
  } catch (error) {
    console.error('Error extracting renewal date from GHL contact:', error);
  }
  
  return null;
}

/**
 * Validate and normalize date string
 */
function validateAndNormalizeDate(dateStr: string | null): string | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  
  const trimmed = dateStr.trim();
  if (!trimmed) return null;
  
  try {
    const date = new Date(trimmed);
    if (isNaN(date.getTime())) return null;
    
    // Return in YYYY-MM-DD format
    return date.toISOString().split('T')[0];
  } catch (error) {
    return null;
  }
}

/**
 * Update contact with renewal date from GHL
 */
async function updateContactRenewalDate(
  contactId: string, 
  renewalDateString: string, 
  currentCustomFields: any,
  dryRun: boolean
): Promise<boolean> {
  try {
    if (dryRun) {
      console.log(`   🔍 Would update database with renewal date: ${renewalDateString} (DRY RUN)`);
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
    
    console.log(`   ✅ Successfully updated database and customFields JSON`);
    return true;
    
  } catch (error) {
    console.error(`   ❌ Database update failed:`, error);
    return false;
  }
}

/**
 * Sync renewal dates from GHL to database
 */
async function syncRenewalDatesFromGHL(options: SyncOptions): Promise<SyncStats> {
  const { dryRun = false, limit, contactId, skipIfExists = false } = options;
  const stats: SyncStats = {
    total: 0,
    updated: 0,
    noChange: 0,
    errors: 0,
    ghlNotFound: 0,
    noRenewalInGhl: 0,
    skippedExisting: 0
  };
  
  try {
    console.log('🌐 Starting renewal date sync from GoHighLevel...');
    
    // Build query conditions
    const whereCondition: any = {};
    
    if (contactId) {
      whereCondition.id = contactId;
    }
    
    if (skipIfExists) {
      whereCondition.renewal_date = null; // Only contacts without renewal_date
    }
    
    // Get contacts to process
    const contacts = await prisma.contact.findMany({
      where: whereCondition,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        renewal_date: true,
        customFields: true
      },
      take: limit,
      orderBy: { updatedAt: 'desc' } // Most recently updated first
    });
    
    stats.total = contacts.length;
    console.log(`📊 Found ${contacts.length} contacts to process${limit ? ` (limited to ${limit})` : ''}${skipIfExists ? ' (null renewal_date only)' : ''}`);
    
    if (contacts.length === 0) {
      console.log('✅ No contacts found to process');
      return stats;
    }
    
    for (const contact of contacts) {
      const displayName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email || contact.id;
      
      try {
        console.log(`\n👤 Processing: ${displayName} (${contact.id})`);
        console.log(`   Current renewal_date: ${contact.renewal_date || 'null'}`);
        
        // Skip if contact already has renewal_date and skipIfExists is true
        if (skipIfExists && contact.renewal_date) {
          console.log(`   ⏭️  Already has renewal_date - skipping`);
          stats.skippedExisting++;
          continue;
        }
        
        // Fetch contact from GHL
        console.log(`   🌐 Fetching from GHL...`);
        let ghlContact;
        try {
          ghlContact = await fetchContactFromGHL(contact.id);
        } catch (ghlError) {
          console.log(`   ❌ GHL fetch failed: ${ghlError instanceof Error ? ghlError.message : 'Unknown error'}`);
          stats.ghlNotFound++;
          continue;
        }
        
        // Extract renewal date from GHL
        const ghlRenewalDate = extractRenewalDateFromGHL(ghlContact);
        console.log(`   🌐 GHL renewal date: ${ghlRenewalDate || 'null'}`);
        
        if (!ghlRenewalDate) {
          console.log(`   ℹ️  No renewal date found in GHL - skipping`);
          stats.noRenewalInGhl++;
          continue;
        }
        
        // Validate and normalize the date
        const normalizedDate = validateAndNormalizeDate(ghlRenewalDate);
        if (!normalizedDate) {
          console.log(`   ⚠️  Invalid date format in GHL: "${ghlRenewalDate}" - skipping`);
          stats.errors++;
          continue;
        }
        
        // Check if renewal_date field already matches
        if (contact.renewal_date === normalizedDate) {
          console.log(`   ✅ Already correct - renewal_date matches GHL date`);
          stats.noChange++;
          continue;
        }
        
        // Show what will be updated
        console.log(`   📅 Will update: "${contact.renewal_date || 'null'}" -> "${normalizedDate}"`);
        
        // Update the contact
        const success = await updateContactRenewalDate(
          contact.id, 
          normalizedDate, 
          contact.customFields,
          dryRun
        );
        
        if (success) {
          stats.updated++;
        } else {
          stats.errors++;
        }
        
        // Add a small delay to avoid rate limiting GHL API
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        console.error(`   ❌ Error processing contact ${contact.id}:`, error);
        stats.errors++;
      }
    }
    
    return stats;
    
  } catch (error) {
    console.error('❌ Sync process failed:', error);
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
    console.log('🌐 Sync Renewal Dates from GHL Script - Help');
    console.log('=============================================');
    console.log('Usage: npm run sync-renewal-dates-from-ghl -- [options]');
    console.log('');
    console.log('This script fetches renewal dates directly from GoHighLevel API');
    console.log('and updates both the renewal_date column and customFields JSON.');
    console.log('');
    console.log('Options:');
    console.log('  --dry-run, -d       Preview changes without making them');
    console.log('  --limit=N           Limit processing to first N contacts');
    console.log('  --contact=ID        Process only the specified contact ID');
    console.log('  --skip-existing     Only process contacts with null renewal_date');
    console.log('  --help, -h          Show this help message');
    console.log('');
    console.log('Examples:');
    console.log('  npm run sync-renewal-dates-from-ghl -- --dry-run');
    console.log('  npm run sync-renewal-dates-from-ghl -- --skip-existing --limit=10');
    console.log('  npm run sync-renewal-dates-from-ghl -- --contact=abc123');
    console.log('  npm run sync-renewal-dates-from-ghl -- --dry-run --limit=5');
    return;
  }
  
  // Check if GHL API is configured
  if (!process.env.GHL_API_KEY || !process.env.GHL_LOCATION_ID) {
    console.error('❌ GHL API not configured. Please set GHL_API_KEY and GHL_LOCATION_ID environment variables.');
    process.exit(1);
  }
  
  const options: SyncOptions = { dryRun, limit, contactId, skipIfExists };
  
  console.log('🌐 Sync Renewal Dates from GHL Script');
  console.log('======================================');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE UPDATE'}`);
  if (limit) console.log(`Limit: ${limit} contacts`);
  if (contactId) console.log(`Target: Single contact ${contactId}`);
  if (skipIfExists) console.log(`Filter: Only null renewal_date contacts`);
  console.log('======================================\n');
  
  if (dryRun) {
    console.log('⚠️  DRY RUN MODE - No actual changes will be made');
  } else {
    console.log('🔴 LIVE MODE - Changes will be permanent');
    console.log('🌐 This will make API calls to GoHighLevel');
    console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  
  try {
    const stats = await syncRenewalDatesFromGHL(options);
    
    console.log('\n📊 SYNC SUMMARY');
    console.log('================');
    console.log(`📋 Total contacts processed: ${stats.total}`);
    console.log(`✅ Successfully updated: ${stats.updated}`);
    console.log(`✅ Already correct: ${stats.noChange}`);
    console.log(`⏭️  Skipped (already has renewal_date): ${stats.skippedExisting}`);
    console.log(`ℹ️  No renewal date in GHL: ${stats.noRenewalInGhl}`);
    console.log(`🌐 GHL not found/error: ${stats.ghlNotFound}`);
    console.log(`❌ Errors: ${stats.errors}`);
    
    if (!dryRun && stats.updated > 0) {
      console.log(`\n🎉 Successfully synced ${stats.updated} renewal dates from GHL!`);
    } else if (dryRun && stats.updated > 0) {
      console.log(`\n🔍 DRY RUN: Would sync ${stats.updated} renewal dates from GHL`);
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