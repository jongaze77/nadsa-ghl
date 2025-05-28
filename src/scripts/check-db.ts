import { prisma } from '@/lib/prisma';

async function main() {
  try {
    const contacts = await prisma.contact.findMany();
    console.log(`Found ${contacts.length} contacts in the database`);
    
    for (const contact of contacts) {
      console.log(`Contact: ${contact.id} - ${contact.name || 'No name'}`);
    }
  } catch (error) {
    console.error('Error checking database:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main(); 