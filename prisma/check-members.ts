import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/client';

const pool = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter: pool });

async function main() {
  const ownerId = '8a79491d-ed40-4a92-b2c3-b22195877113'; // med.wael.gharbi@gmail.com

  const members = await (prisma.user as any).findMany({
    where: { ownerId },
    orderBy: { createdAt: 'desc' },
  });

  console.log('Member count:', members.length);
  for (const m of members) {
    console.log(' ', m.email, '| role:', m.role, '| ownerId:', m.ownerId);
  }
}

main().finally(() => prisma.$disconnect());
