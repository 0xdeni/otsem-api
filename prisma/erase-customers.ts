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

  // Prisma cascade rules will delete: Account, Wallet, Transaction, Payout,
  // PixKey, PixLimits, Address, Ownership, CardTransaction, Chargeback,
  // KycUpgradeRequest, Conversion, AffiliateCommission
  // Payment/Deposit/Refund will have customerId set to NULL (SetNull)
  const result = await prisma.customer.deleteMany();

  console.log(`Erased ${result.count} customers and all related data.`);
}

main()
  .catch((e) => {
    console.error('Error erasing customers:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
