import { PrismaClient } from '../prisma/generated/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter: pool });

async function backfill() {
  const visits = await prisma.visit.findMany({
    orderBy: { createdAt: 'asc' },
    select: { id: true, compound: true },
  });

  const slugSet: string[] = [];
  for (const v of visits) {
    if (v.compound && !slugSet.includes(v.compound)) slugSet.push(v.compound);
  }

  const compounds = await (prisma.compound as any).findMany({
    where: { slug: { in: slugSet } },
    select: { slug: true, name: true },
  });
  const nameMap: Record<string, string> = {};
  for (const c of compounds as Array<{ slug: string; name: string }>) {
    nameMap[c.slug] = c.name;
  }

  const counters: Record<string, number> = {};

  for (const visit of visits) {
    const slug = visit.compound || 'UNKNOWN';
    const name = nameMap[slug] || slug;
    counters[slug] = (counters[slug] || 0) + 1;
    const prefix = name.replace(/\s+/g, '').slice(0, 3).toUpperCase();
    const seq = String(counters[slug]).padStart(6, '0');
    const visitCode = `${prefix}_${seq}`;

    await prisma.visit.update({ where: { id: visit.id }, data: { visitCode } });
  }

  console.log(`Backfilled ${visits.length} visits`);
  await prisma.$disconnect();
}

backfill().catch((e) => {
  console.error(e);
  process.exit(1);
});
