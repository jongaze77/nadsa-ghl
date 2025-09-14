#!/usr/bin/env tsx

/**
 * Script to sync renewal_date field from customFields JSON
 * 
 * This script extracts renewal dates from the customFields JSON (field cWMPNiNAfReHOumOhBB2)
 * and updates the renewal_date column in the Contact table.
 * 
 * Useful after reconciliation process to ensure data export works properly.
 * 
 * Usage: npm run sync-renewal-dates-from-json
 */

import { prisma } from '../lib/prisma';

const RENEWAL_DATE_FIELD_ID = 'cWMPNiNAfReHOumOhBB2';

interface SyncOptions {
  dryRun?: boolean;
  limit?: number;
  contactId?: string; // Sync specific contact only
}

interface SyncStats {
  total: number;
  updated: number;
  noChange: number;
  errors: number;
  alreadyCorrect: number;
}

/**
 * Extract renewal date from customFields JSON
 */
function extractRenewalDateFromCustomFields(customFields: any): string | null {
  if (!customFields) return null;
  
  try {
    if (Array.isArray(customFields)) {
      // Array format: [{ id: "cWMPNiNAfReHOumOhBB2", value: "2025-12-31" }]
      const renewalField = customFields.find((field: any) => field.id === RENEWAL_DATE_FIELD_ID);
      return renewalField?.value || null;
    } else if (typeof customFields === 'object') {
      // Object format: { "cWMPNiNAfReHOumOhBB2": "2025-12-31" }
      return customFields[RENEWAL_DATE_FIELD_ID] || null;
    }
  } catch (error) {
    console.error('Error extracting renewal date from customFields:', error);
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
 * Sync renewal dates from JSON to database field
 */
async function syncRenewalDatesFromJson(options: SyncOptions): Promise<SyncStats> {
  const { dryRun = false, limit, contactId } = options;
  const stats: SyncStats = {
    total: 0,
    updated: 0,
    noChange: 0,
    errors: 0,
    alreadyCorrect: 0
  };
  
  try {
    console.log('📋 Starting renewal date sync from customFields JSON...');
    
    // Build query conditions
    const whereCondition: any = {
      customFields: { not: null } // Only contacts with customFields data
    };
    
    if (contactId) {
      whereCondition.id = contactId;
    }
    
    // Get contacts that have customFields
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
    console.log(`📊 Found ${contacts.length} contacts with customFields data${limit ? ` (limited to ${limit})` : ''}`);
    
    if (contacts.length === 0) {
      console.log('✅ No contacts found with customFields data');
      return stats;
    }
    
    for (const contact of contacts) {
      const displayName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email || contact.id;
      
      try {
        console.log(`\n👤 Processing: ${displayName} (${contact.id})`);
        console.log(`   Current renewal_date: ${contact.renewal_date || 'null'}`);
        
        // Extract renewal date from customFields JSON
        const jsonRenewalDate = extractRenewalDateFromCustomFields(contact.customFields);
        console.log(`   JSON renewal date: ${jsonRenewalDate || 'null'}`);
        
        if (!jsonRenewalDate) {
          console.log(`   ℹ️  No renewal date found in customFields JSON - skipping`);
          stats.noChange++;
          continue;
        }
        
        // Validate and normalize the date
        const normalizedDate = validateAndNormalizeDate(jsonRenewalDate);
        if (!normalizedDate) {
          console.log(`   ⚠️  Invalid date format in JSON: "${jsonRenewalDate}" - skipping`);
          stats.errors++;
          continue;
        }
        
        // Check if renewal_date field already matches
        if (contact.renewal_date === normalizedDate) {
          console.log(`   ✅ Already correct - renewal_date matches JSON date`);
          stats.alreadyCorrect++;
          continue;
        }
        
        // Show what will be updated
        console.log(`   📅 Will update: "${contact.renewal_date || 'null'}" -> "${normalizedDate}"`);
        
        if (!dryRun) {
          // Update the renewal_date field
          await prisma.contact.update({
            where: { id: contact.id },
            data: {
              renewal_date: normalizedDate,
              updatedAt: new Date()
            }
          });
          
          console.log(`   ✅ Updated renewal_date to ${normalizedDate}`);
          stats.updated++;
        } else {
          console.log(`   🔍 Would update renewal_date to ${normalizedDate} (DRY RUN)`);
          stats.updated++; // Count as "would update" in dry run
        }
        
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
  const showHelp = args.includes('--help') || args.includes('-h');
  
  if (showHelp) {
    console.log('📋 Sync Renewal Dates from JSON Script - Help');
    console.log('=============================================');
    console.log('Usage: npm run sync-renewal-dates-from-json -- [options]');
    console.log('');
    console.log('This script extracts renewal dates from the customFields JSON');
    console.log('(field cWMPNiNAfReHOumOhBB2) and updates the renewal_date column.');
    console.log('');
    console.log('Options:');
    console.log('  --dry-run, -d     Preview changes without making them');
    console.log('  --limit=N         Limit processing to first N contacts');
    console.log('  --contact=ID      Process only the specified contact ID');
    console.log('  --help, -h        Show this help message');
    console.log('');
    console.log('Examples:');
    console.log('  npm run sync-renewal-dates-from-json -- --dry-run');
    console.log('  npm run sync-renewal-dates-from-json -- --limit=10');
    console.log('  npm run sync-renewal-dates-from-json -- --contact=abc123');
    console.log('  npm run sync-renewal-dates-from-json -- --dry-run --limit=5');
    return;
  }
  
  const options: SyncOptions = { dryRun, limit, contactId };
  
  console.log('📋 Sync Renewal Dates from JSON Script');
  console.log('=======================================');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE UPDATE'}`);
  if (limit) console.log(`Limit: ${limit} contacts`);
  if (contactId) console.log(`Target: Single contact ${contactId}`);
  console.log('=======================================\n');
  
  if (dryRun) {
    console.log('⚠️  DRY RUN MODE - No actual changes will be made');
  } else {
    console.log('🔴 LIVE MODE - Changes will be permanent');
    console.log('Press Ctrl+C to cancel, or wait 3 seconds to continue...');
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  
  try {
    const stats = await syncRenewalDatesFromJson(options);
    
    console.log('\n📊 SYNC SUMMARY');
    console.log('================');
    console.log(`📋 Total contacts processed: ${stats.total}`);
    console.log(`✅ Successfully updated: ${stats.updated}`);
    console.log(`✅ Already correct: ${stats.alreadyCorrect}`);
    console.log(`ℹ️  No change needed: ${stats.noChange}`);
    console.log(`❌ Errors: ${stats.errors}`);
    
    if (!dryRun && stats.updated > 0) {
      console.log(`\n🎉 Successfully synced ${stats.updated} renewal dates from JSON to database field!`);
    } else if (dryRun && stats.updated > 0) {
      console.log(`\n🔍 DRY RUN: Would sync ${stats.updated} renewal dates from JSON to database field`);
    } else {
      console.log('\n✅ No updates needed - all renewal_date fields are already in sync!');
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