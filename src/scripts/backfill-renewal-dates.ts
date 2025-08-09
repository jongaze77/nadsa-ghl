#!/usr/bin/env node

import { prisma } from '../lib/prisma';
import { FIELD_MAP } from '../lib/ghl-api';

async function backfillRenewalDates() {
  console.log('🔄 Starting renewal date backfill...');
  
  try {
    // Get all contacts with custom fields but no renewal_date
    const contactsToUpdate = await prisma.contact.findMany({
      where: {
        renewal_date: null,
        customFields: {
          not: null as any
        }
      }
    });

    console.log(`📊 Found ${contactsToUpdate.length} contacts to check for renewal dates`);

    let updatedCount = 0;

    for (const contact of contactsToUpdate) {
      let renewalDate: string | null = null;
      
      try {
        const customFields = contact.customFields;
        if (customFields && typeof customFields === 'object') {
          
          // Handle array format (GHL API format)
          if (Array.isArray(customFields)) {
            const renewalField = customFields.find((f: any) => f.id === 'cWMPNiNAfReHOumOhBB2');
            if (renewalField && typeof renewalField === 'object' && 'value' in renewalField) {
              renewalDate = String(renewalField.value);
            }
          }
          // Handle object format (flattened format)
          else if ('cWMPNiNAfReHOumOhBB2' in customFields) {
            renewalDate = (customFields as any)['cWMPNiNAfReHOumOhBB2'];
          }
          // Handle mapped field names
          else if ('renewal_date' in customFields) {
            renewalDate = (customFields as any)['renewal_date'];
          }
        }
        
        if (renewalDate) {
          await prisma.contact.update({
            where: { id: contact.id },
            data: { renewal_date: renewalDate }
          });
          
          console.log(`✅ Updated contact ${contact.id} (${contact.firstName} ${contact.lastName}) with renewal date: ${renewalDate}`);
          updatedCount++;
        }
        
      } catch (error) {
        console.error(`❌ Error processing contact ${contact.id}:`, error);
      }
    }

    console.log(`\n🎉 Backfill complete! Updated ${updatedCount} out of ${contactsToUpdate.length} contacts.`);
    
  } catch (error) {
    console.error('❌ Backfill failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  backfillRenewalDates();
}

export default backfillRenewalDates;