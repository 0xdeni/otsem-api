const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({
      where: { email: 'deni.dudaev@hotmail.com' },
      select: { id: true, email: true, name: true },
    });
    if (!user) {
      console.log('ERROR: User not found');
      return;
    }
    console.log('Found user:', user.email, '(' + (user.name || 'no name') + ')');
    const hash = await bcrypt.hash('OtsemNewPass123!', 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hash, passwordChangedAt: new Date() },
    });
    console.log('Password updated successfully.');
  } finally {
    await prisma.$disconnect();
  }
}
main().catch(e => { console.error(e.message); process.exit(1); });
