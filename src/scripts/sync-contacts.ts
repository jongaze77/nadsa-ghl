require('dotenv').config({ path: '.env.local' });
import { fetchAllContactsFromGHL, mapGHLContactToPrisma } from '../lib/ghl-api';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

async function main() {
  try {
    console.log('Starting contact sync...');
    const contacts = await fetchAllContactsFromGHL();
    
    for (const contact of contacts.contacts) {
      const prismaContact = mapGHLContactToPrisma(contact);
      const existingContact = await prisma.contact.findUnique({
        where: { id: contact.id }
      });

      const contactData = {
        ...prismaContact,
        id: contact.id,
        customFields: prismaContact.customFields as Prisma.InputJsonValue
      };

      if (existingContact) {
        await prisma.contact.update({
          where: { id: contact.id },
          data: contactData
        });
        console.log(`Updated contact: ${contact.id}`);
      } else {
        await prisma.contact.create({
          data: contactData
        });
        console.log(`Created contact: ${contact.id}`);
      }
    }

    console.log('Contact sync completed successfully');
  } catch (error) {
    console.error('Error syncing contacts:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main(); 