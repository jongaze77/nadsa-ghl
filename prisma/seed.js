const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  // Create admin user
  const hashedPassword = await bcrypt.hash('newPassword1!', 10);
  await prisma.user.upsert({
    where: { username: 'valeriegaze' },
    update: {},
    create: {
      username: 'valeriegaze',
      password: hashedPassword,
      role: 'admin',
    },
  });

  console.log('Database seeded successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });