const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('test123', 10);
  await prisma.user.upsert({
    where: { username: 'valeriegaze' },
    update: {},
    create: {
      username: 'valeriegaze',
      password: hash,
      role: 'admin',
    },
  });
  console.log('Seeded user: valeriegaze / test123');
}
main().finally(() => prisma.$disconnect());