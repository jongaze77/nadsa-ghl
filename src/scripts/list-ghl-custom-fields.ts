#!/usr/bin/env ts-node

// Load environment variables from .env.local (same as sync-contacts.ts)
require('dotenv').config({ path: '.env.local' });

import { fetchWithRetry, getApiKey, getLocationId } from '../lib/ghl-api';

const GHL_API_BASE = 'https://rest.gohighlevel.com/v1';

async function main() {
  try {
    console.log('🔍 Fetching all custom fields from GoHighLevel...\n');
    
    // Check if API credentials are loaded
    const apiKey = getApiKey();
    const locationId = getLocationId();
    
    if (!apiKey) {
      console.error('❌ GHL_API_KEY not found in environment variables');
      process.exit(1);
    }
    
    if (!locationId) {
      console.error('❌ GHL_LOCATION_ID not found in environment variables');
      process.exit(1);
    }
    
    console.log(`✅ API Key loaded: ${apiKey.substring(0, 10)}...`);
    console.log(`✅ Location ID: ${locationId}`);
    console.log();

    const response = await fetchWithRetry(`${GHL_API_BASE}/custom-fields/`, {
      method: 'GET'
    });

    const data = await response.json();
    
    console.log('📋 Raw API Response:');
    console.log(JSON.stringify(data, null, 2));
    console.log('\n');

    // Parse and display custom fields in a readable format
    if (data.customFields && Array.isArray(data.customFields)) {
      console.log('📝 Custom Fields Summary:');
      console.log('=' .repeat(80));
      
      data.customFields.forEach((field: any, index: number) => {
        console.log(`${index + 1}. Field Name: "${field.name || 'Unnamed'}"`);
        console.log(`   Field ID: ${field.id}`);
        console.log(`   Field Type: ${field.fieldType || 'unknown'}`);
        console.log(`   Options: ${field.options ? JSON.stringify(field.options) : 'none'}`);
        console.log('   ' + '-'.repeat(60));
      });

      console.log(`\n✅ Found ${data.customFields.length} custom fields total`);
      
      // Check for our specific fields
      console.log('\n🎯 Checking for reconciliation system fields:');
      const renewalField = data.customFields.find((f: any) => f.id === 'cWMPNiNAfReHOumOhBB2');
      const paymentDateField = data.customFields.find((f: any) => f.id === 'w52V1FONYrhH0LUqDjBs');
      const membershipTypeField = data.customFields.find((f: any) => f.id === 'gH97LlNC9Y4PlkKVlY8V');
      
      console.log(`Renewal Date Field (cWMPNiNAfReHOumOhBB2): ${renewalField ? `✅ Found - "${renewalField.name}"` : '❌ NOT FOUND'}`);
      console.log(`Payment Date Field (w52V1FONYrhH0LUqDjBs): ${paymentDateField ? `✅ Found - "${paymentDateField.name}"` : '❌ NOT FOUND'}`);
      console.log(`Membership Type Field (gH97LlNC9Y4PlkKVlY8V): ${membershipTypeField ? `✅ Found - "${membershipTypeField.name}"` : '❌ NOT FOUND'}`);
      
    } else {
      console.log('⚠️  No custom fields array found in response');
      console.log('Response structure:', Object.keys(data));
    }

  } catch (error) {
    console.error('❌ Error fetching custom fields:', error);
    process.exit(1);
  }
}

// Run the script
main().catch(console.error);