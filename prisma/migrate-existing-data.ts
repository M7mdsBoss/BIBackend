/**
 * Run BEFORE `prisma db push` when the FK constraints for Visit/SRS are pending.
 *
 * What it does:
 *  1. Reads every unique compound name from Visit.compound + srs.compound
 *  2. Creates a Compound record (COMP_{slug}) for each, assigned to the first OWNER
 *  3. Reads every unique unit name from Visit.residentUnit + srs.unit
 *  4. Creates a Unit record (UNIT_{slug}) for each, linked to its compound
 *  5. Rewrites Visit.compound, Visit.residentUnit, srs.compound, srs.unit
 *     so they hold slugs instead of raw names
 *
 * Usage:
 *   npx tsx prisma/migrate-existing-data.ts
 */

import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/client';
import { v4 as uuidv4 } from 'uuid';

// ── Slug helpers (mirrors src/shared/slug.ts without Prisma dependency) ────────

function toBase(name: string, prefix: 'COMP' | 'UNIT'): string {
  const normalized = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `${prefix}_${normalized}`;
}

async function generateSlug(
  prisma: PrismaClient,
  name: string,
  prefix: 'COMP' | 'UNIT',
): Promise<string> {
  const base = toBase(name, prefix);
  let slug = base;
  let i = 2;
  while (true) {
    const exists =
      prefix === 'COMP'
        ? await (prisma.compound as any).findUnique({ where: { slug } })
        : await (prisma.unit as any).findUnique({ where: { slug } });
    if (!exists) break;
    slug = `${base}_${i++}`;
  }
  return slug;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const pool = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter: pool });

  // ── 1. Resolve owner for new Compound records ──────────────────────────────
  const owner = await prisma.user.findFirst({ where: { role: 'OWNER' as any, confirmed: true } });
  if (!owner) throw new Error('No confirmed OWNER user found. Register one first.');
  console.log(`Using owner: ${owner.email}`);

  // ── 2. Collect unique compound names ──────────────────────────────────────
  const [visitCompoundRows, srsCompoundRows] = await Promise.all([
    prisma.visit.findMany({
      where: { compound: { not: null } },
      select: { compound: true },
      distinct: ['compound'],
    }),
    (prisma.srs as any).findMany({
      where: { compound: { not: null } },
      select: { compound: true },
      distinct: ['compound'],
    }),
  ]);

  const compoundNames = new Set<string>([
    ...visitCompoundRows.map((r: any) => r.compound as string),
    ...srsCompoundRows.map((r: any) => r.compound as string),
  ]);

  console.log(`\nFound ${compoundNames.size} unique compound name(s): ${[...compoundNames].join(', ')}`);

  // ── 3. Create Compound records → build name→slug map ──────────────────────
  const compoundSlugMap = new Map<string, string>(); // raw name → COMP_slug

  for (const name of compoundNames) {
    const existing = await (prisma.compound as any).findFirst({ where: { name } });
    if (existing) {
      compoundSlugMap.set(name, existing.slug);
      console.log(`  Compound already exists: "${name}" → ${existing.slug}`);
    } else {
      const slug = await generateSlug(prisma, name, 'COMP');
      await (prisma.compound as any).create({
        data: { id: uuidv4(), name, slug, ownerId: owner.id },
      });
      compoundSlugMap.set(name, slug);
      console.log(`  Created compound: "${name}" → ${slug}`);
    }
  }

  // ── 4. Collect unique unit names with their associated compound name ────────
  const [visitUnitRows, srsUnitRows] = await Promise.all([
    prisma.visit.findMany({
      select: { residentUnit: true, compound: true },
      distinct: ['residentUnit'],
    }),
    (prisma.srs as any).findMany({
      where: { unit: { not: null } },
      select: { unit: true, compound: true },
      distinct: ['unit'],
    }),
  ]);

  // Map: unit raw name → compound raw name (first association wins)
  const unitCompoundMap = new Map<string, string | null>();
  for (const r of visitUnitRows) {
    if (r.residentUnit && !unitCompoundMap.has(r.residentUnit))
      unitCompoundMap.set(r.residentUnit, r.compound ?? null);
  }
  for (const r of srsUnitRows) {
    if (r.unit && !unitCompoundMap.has(r.unit))
      unitCompoundMap.set(r.unit, r.compound ?? null);
  }

  console.log(`\nFound ${unitCompoundMap.size} unique unit name(s).`);

  // ── 5. Create Unit records → build name→slug map ───────────────────────────
  const unitSlugMap = new Map<string, string>(); // raw name → UNIT_slug

  for (const [unitName, compoundName] of unitCompoundMap.entries()) {
    if (!unitName) continue;

    const compoundSlug = compoundName ? compoundSlugMap.get(compoundName) : null;
    const compound = compoundSlug
      ? await (prisma.compound as any).findUnique({ where: { slug: compoundSlug } })
      : null;

    if (!compound) {
      console.warn(`  Unit "${unitName}" has no matching compound — skipping`);
      continue;
    }

    const existing = await (prisma.unit as any).findFirst({
      where: { name: unitName, compoundId: compound.id },
    });

    if (existing) {
      unitSlugMap.set(unitName, existing.slug);
      console.log(`  Unit already exists: "${unitName}" → ${existing.slug}`);
    } else {
      const slug = await generateSlug(prisma, unitName, 'UNIT');
      await (prisma.unit as any).create({
        data: { id: uuidv4(), name: unitName, slug, compoundId: compound.id },
      });
      unitSlugMap.set(unitName, slug);
      console.log(`  Created unit: "${unitName}" → ${slug}`);
    }
  }

  // ── 6. Rewrite Visit rows ──────────────────────────────────────────────────
  console.log('\nUpdating Visit records...');
  const visits = await prisma.visit.findMany();
  let visitUpdated = 0;

  for (const visit of visits) {
    const data: any = {};

    if (visit.compound) {
      const slug = compoundSlugMap.get(visit.compound);
      // Already a slug → leave it; raw name → replace; no match → nullify
      if (slug) data.compound = slug;
      else if (!visit.compound.startsWith('COMP_')) data.compound = null;
    }

    const unitSlug = unitSlugMap.get(visit.residentUnit);
    if (unitSlug) data.residentUnit = unitSlug;

    if (Object.keys(data).length > 0) {
      await prisma.visit.update({ where: { id: visit.id }, data });
      visitUpdated++;
    }
  }
  console.log(`  Updated ${visitUpdated} / ${visits.length} Visit rows`);

  // ── 7. Rewrite SRS rows ────────────────────────────────────────────────────
  console.log('\nUpdating SRS records...');
  const srsRecords = await (prisma.srs as any).findMany();
  let srsUpdated = 0;

  for (const srs of srsRecords) {
    const data: any = {};

    if (srs.compound) {
      const slug = compoundSlugMap.get(srs.compound);
      if (slug) data.compound = slug;
      else if (!srs.compound.startsWith('COMP_')) data.compound = null;
    }

    if (srs.unit) {
      const slug = unitSlugMap.get(srs.unit);
      if (slug) data.unit = slug;
      else if (!srs.unit.startsWith('UNIT_')) data.unit = null;
    }

    if (Object.keys(data).length > 0) {
      await (prisma.srs as any).update({ where: { id: srs.id }, data });
      srsUpdated++;
    }
  }
  console.log(`  Updated ${srsUpdated} / ${srsRecords.length} SRS rows`);

  await prisma.$disconnect();
  console.log('\n✓ Migration complete. You can now run: npx prisma db push');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
