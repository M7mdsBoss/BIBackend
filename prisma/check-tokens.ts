import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/client';

const pool = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter: pool });

async function main() {
  const owners = await (prisma.user as any).findMany({
    where: { role: 'OWNER' },
    select: { email: true, generatedToken: true },
  });
  console.log('OWNERS:');
  for (const o of owners) console.log(' ', o.email, '→', o.generatedToken);

  const srsTokens = await (prisma.srs as any).groupBy({
    by: ['userToken'],
    _count: { _all: true },
  });
  console.log('\nSRS distinct userTokens:');
  for (const r of srsTokens) console.log(' ', r.userToken ?? 'NULL', '→ count:', r._count._all);
}

main().finally(() => prisma.$disconnect());
