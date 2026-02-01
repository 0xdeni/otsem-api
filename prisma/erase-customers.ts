import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Counting existing customers...');
  const count = await prisma.customer.count();

  if (count === 0) {
    console.log('No customers found. Nothing to erase.');
    return;
  }

  console.log(`Found ${count} customers. Erasing all customers, accounts, and wallets...`);

  // Collect user IDs before deleting customers (Customer.userId → User.id)
  const userIds = (
    await prisma.customer.findMany({
      where: { userId: { not: null } },
      select: { userId: true },
    })
  ).map(c => c.userId).filter((uid): uid is string => uid !== null);

  // Prisma cascade rules will delete: Account, Wallet, Transaction, Payout,
  // PixKey, PixLimits, Address, Ownership, CardTransaction, Chargeback,
  // KycUpgradeRequest, Conversion, AffiliateCommission
  // Payment/Deposit/Refund will have customerId set to NULL (SetNull)
  const result = await prisma.customer.deleteMany();

  // Delete associated User records (except ADMIN) so emails can be reused
  if (userIds.length > 0) {
    const userResult = await prisma.user.deleteMany({
      where: { id: { in: userIds }, role: { not: 'ADMIN' } },
    });
    console.log(`Erased ${userResult.count} user accounts.`);
  }

  console.log(`Erased ${result.count} customers and all related data.`);
}

main()
  .catch((e) => {
    console.error('Error erasing customers:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
