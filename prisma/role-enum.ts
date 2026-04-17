/**
 * Deployment script: migrate User.role from plain VARCHAR → UserRole enum
 *
 * Safe to re-run at any time (fully idempotent).
 *
 * Steps:
 *  1. Create the UserRole enum type in Postgres (skip if already exists)
 *  2. Rename any legacy role values  (OWNER → CLIENT)
 *  3. Cast the column to the enum type (skip if already an enum)
 *  4. Set the column DEFAULT to CLIENT
 *
 * Usage:
 *   npx tsx prisma/role-enum.ts
 */

import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/client';

const pool = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter: pool });

async function main() {
  console.log('Starting role enum migration …\n');

  // ── Step 1: create the enum type if it does not exist yet ──────────────────
  console.log('[1/4] Creating UserRole enum type …');

  const enumExists = await prisma.$queryRaw<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM pg_type WHERE typname = 'UserRole'
    ) AS exists;
  `;

  if (enumExists[0].exists) {
    console.log('      → already exists, skipping creation.');
  } else {
    await prisma.$executeRaw`
      CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'CLIENT', 'GUARD', 'OPERATION', 'MANAGER');
    `;
    console.log('      → created.');
  }

  // ── Step 2: rename legacy role values ──────────────────────────────────────
  console.log('\n[2/4] Renaming legacy role values (OWNER → CLIENT) …');

  // If the column is already an enum we cannot UPDATE with a plain string —
  // but we haven't cast it yet, so this runs while it is still text.
  const columnIsText = await prisma.$queryRaw<{ is_text: boolean }[]>`
    SELECT data_type = 'character varying' OR data_type = 'text' AS is_text
    FROM information_schema.columns
    WHERE table_name = 'User' AND column_name = 'role';
  `;

  if (columnIsText[0]?.is_text) {
    const result = await prisma.$executeRaw`
      UPDATE "User" SET role = 'CLIENT' WHERE role = 'OWNER';
    `;
    console.log(`      → updated ${result} row(s).`);
  } else {
    // Column is already an enum — use enum cast
    const result = await prisma.$executeRaw`
      UPDATE "User" SET role = 'CLIENT'::"UserRole" WHERE role = 'CLIENT'::"UserRole";
    `;
    console.log(`      → column already enum, no OWNER rows expected (${result} row(s) touched).`);
  }

  // ── Step 3: cast the column to the enum type ───────────────────────────────
  console.log('\n[3/4] Casting User.role column to UserRole enum …');

  const colType = await prisma.$queryRaw<{ udt_name: string }[]>`
    SELECT udt_name
    FROM information_schema.columns
    WHERE table_name = 'User' AND column_name = 'role';
  `;

  const alreadyEnum = colType[0]?.udt_name === 'UserRole';

  if (alreadyEnum) {
    console.log('      → already UserRole enum, skipping ALTER.');
  } else {
    // DROP the current DEFAULT first (it is a plain string literal and would
    // fail the cast), then restore it after the ALTER.
    await prisma.$executeRaw`
      ALTER TABLE "User" ALTER COLUMN role DROP DEFAULT;
    `;
    await prisma.$executeRaw`
      ALTER TABLE "User"
        ALTER COLUMN role TYPE "UserRole"
        USING role::"UserRole";
    `;
    console.log('      → column cast to UserRole enum.');
  }

  // ── Step 4: ensure DEFAULT is set correctly ─────────────────────────────────
  console.log('\n[4/4] Setting column DEFAULT to CLIENT …');

  await prisma.$executeRaw`
    ALTER TABLE "User"
      ALTER COLUMN role SET DEFAULT 'CLIENT'::"UserRole";
  `;
  console.log('      → default set.');

  console.log('\nMigration complete.');
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (e) => {
    console.error('\nMigration failed:', e.message ?? e);
    await prisma.$disconnect();
    process.exit(1);
  });
