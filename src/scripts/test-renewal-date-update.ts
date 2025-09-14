#!/usr/bin/env tsx

/**
 * Test script to verify that reconciliation properly updates the renewal_date field
 * 
 * This script simulates the renewal date update logic without doing a full reconciliation
 * 
 * Usage: npm run test-renewal-update -- --contact=CONTACT_ID --dry-run
 */

import { prisma } from '../lib/prisma';

interface TestOptions {
  contactId?: string;
  dryRun?: boolean;
}

/**
 * Simulate the renewal date update logic from ReconciliationService
 */
async function testRenewalDateUpdate(contactId: string, dryRun: boolean = false): Promise<void> {
  try {
    console.log(`📋 Testing renewal date update for contact ${contactId}${dryRun ? ' (DRY RUN)' : ''}`);
    
    // Step 1: Get current contact data
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        renewal_date: true,
        customFields: true
      }
    });
    
    if (!contact) {
      throw new Error(`Contact ${contactId} not found`);
    }
    
    const displayName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email || contactId;
    console.log(`👤 Contact: ${displayName}`);
    console.log(`📅 Current renewal_date: ${contact.renewal_date || 'null'}`);
    
    // Check customFields for renewal date
    let customFieldRenewalDate = null;
    const renewalFieldId = 'cWMPNiNAfReHOumOhBB2';
    
    if (contact.customFields) {
      if (Array.isArray(contact.customFields)) {
        const renewalField = contact.customFields.find((field: any) => field.id === renewalFieldId);
        customFieldRenewalDate = renewalField?.value || null;
      } else if (typeof contact.customFields === 'object') {
        customFieldRenewalDate = (contact.customFields as any)[renewalFieldId] || null;
      }
    }
    
    console.log(`🔧 CustomFields renewal date: ${customFieldRenewalDate || 'null'}`);
    
    // Step 2: Simulate a payment date (today) and calculate new renewal date
    const simulatedPaymentDate = new Date();
    const newRenewalDate = new Date(simulatedPaymentDate);
    newRenewalDate.setFullYear(newRenewalDate.getFullYear() + 1);
    const renewalDateString = newRenewalDate.toISOString().split('T')[0];
    
    console.log(`💳 Simulated payment date: ${simulatedPaymentDate.toISOString().split('T')[0]}`);
    console.log(`📅 Calculated new renewal date: ${renewalDateString}`);
    
    // Step 3: Update the database (if not dry run)
    if (!dryRun) {
      // Update the customFields JSON to include the new renewal date
      let updatedCustomFields = contact.customFields || {};
      
      // Handle both array and object formats of customFields
      if (Array.isArray(updatedCustomFields)) {
        // If it's an array format, update or add the renewal date field
        const existingFieldIndex = updatedCustomFields.findIndex((field: any) => field.id === renewalFieldId);
        if (existingFieldIndex >= 0) {
          // Update existing field
          updatedCustomFields[existingFieldIndex].value = renewalDateString;
        } else {
          // Add new field
          updatedCustomFields.push({ id: renewalFieldId, value: renewalDateString });
        }
      } else {
        // If it's an object format, just set the field
        updatedCustomFields = {
          ...updatedCustomFields,
          [renewalFieldId]: renewalDateString
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
      
      console.log(`✅ Successfully updated database renewal_date and customFields for contact ${contactId}`);
      
      // Verify the update
      const updatedContact = await prisma.contact.findUnique({
        where: { id: contactId },
        select: { renewal_date: true, customFields: true }
      });
      
      console.log(`📋 Verification - renewal_date: ${updatedContact?.renewal_date}`);
      console.log(`📋 Verification - customFields updated: ${JSON.stringify(updatedContact?.customFields, null, 2)}`);
      
    } else {
      console.log(`🔍 DRY RUN - Would update renewal_date to ${renewalDateString}`);
    }
    
  } catch (error) {
    console.error(`❌ Error testing renewal date update:`, error);
    throw error;
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  // Parse command line arguments
  const dryRun = args.includes('--dry-run') || args.includes('-d');
  const contactIdArg = args.find(arg => arg.startsWith('--contact='));
  const contactId = contactIdArg ? contactIdArg.split('=')[1] : undefined;
  const showHelp = args.includes('--help') || args.includes('-h');
  
  if (showHelp) {
    console.log('🧪 Test Renewal Date Update Script - Help');
    console.log('==========================================');
    console.log('Usage: npm run test-renewal-update -- [options]');
    console.log('');
    console.log('Options:');
    console.log('  --contact=ID      Test with specific contact ID (required)');
    console.log('  --dry-run, -d     Preview changes without making them');
    console.log('  --help, -h        Show this help message');
    console.log('');
    console.log('Examples:');
    console.log('  npm run test-renewal-update -- --contact=abc123 --dry-run');
    console.log('  npm run test-renewal-update -- --contact=abc123');
    return;
  }
  
  if (!contactId) {
    console.log('❌ Contact ID is required. Use --contact=CONTACT_ID');
    console.log('Use --help for more information');
    return;
  }
  
  console.log('🧪 Test Renewal Date Update Script');
  console.log('===================================');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE UPDATE'}`);
  console.log(`Contact ID: ${contactId}`);
  console.log('===================================\n');
  
  if (dryRun) {
    console.log('⚠️  DRY RUN MODE - No actual changes will be made');
  } else {
    console.log('🔴 LIVE MODE - Changes will be permanent');
    console.log('Press Ctrl+C to cancel, or wait 3 seconds to continue...');
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  
  try {
    await testRenewalDateUpdate(contactId, dryRun);
    console.log('\n🎉 Test completed successfully!');
    
  } catch (error) {
    console.error('\n💥 Test failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Test interrupted by user');
  await prisma.$disconnect();
  process.exit(0);
});

if (require.main === module) {
  main().catch(console.error);
}