import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDatabase() {
  try {
    // Check if we can connect to the database
    await prisma.$connect();
    console.log('Successfully connected to database');

    // Count contacts
    const contactCount = await prisma.contact.count();
    console.log(`Total contacts in database: ${contactCount}`);

    // Get a sample contact if any exist
    if (contactCount > 0) {
      const sampleContact = await prisma.contact.findFirst();
      console.log('Sample contact:', JSON.stringify(sampleContact, null, 2));
    }

  } catch (error) {
    console.error('Error checking database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase(); 