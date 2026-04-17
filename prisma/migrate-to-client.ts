/**
 * migrate-to-client.ts
 *
 * One-time data migration: introduces the Client entity and rewires all
 * existing data (Compounds, Visits, SRS, member Users) to the Client that
 * belongs to owner@blueinnovation.dev.
 *
 * Uses pg directly — no dependency on the generated Prisma client.
 *
 * Run with:
 *   npm run migrate:client
 *
 * After it completes successfully, run:
 *   npx prisma migrate dev --name add-client-entity
 */

import 'dotenv/config';
import pg from 'pg';
import { v4 as uuidv4 } from 'uuid';

const ADMIN_EMAIL = 'med.wael.gharbi@gmail.com';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL! });

// ── helpers ────────────────────────────────────────────────────────────────────

async function query<T extends pg.QueryResultRow>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await pool.query<T>(sql, params);
  return result.rows;
}

async function execute(sql: string, params: unknown[] = []): Promise<number> {
  const result = await pool.query(sql, params);
  return result.rowCount ?? 0;
}

async function columnExists(table: string, column: string): Promise<boolean> {
  const rows = await query<{ count: string }>(
    `SELECT COUNT(*)::int as count
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    [table, column],
  );
  return Number(rows[0].count) > 0;
}

async function tableExists(table: string): Promise<boolean> {
  const rows = await query<{ count: string }>(
    `SELECT COUNT(*)::int as count
     FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = $1`,
    [table],
  );
  return Number(rows[0].count) > 0;
}

async function constraintExists(table: string, constraint: string): Promise<boolean> {
  const rows = await query<{ count: string }>(
    `SELECT COUNT(*)::int as count
     FROM information_schema.table_constraints
     WHERE table_schema = 'public' AND table_name = $1 AND constraint_name = $2`,
    [table, constraint],
  );
  return Number(rows[0].count) > 0;
}

// ── main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log('── Blue Innovation: Client migration ─────────────────────────────');

  // ── 1. Resolve the admin user ──────────────────────────────────────────────

  const adminUsers = await query<{
    id: string; name: string; campany: string | null; generatedToken: string;
  }>(
    `SELECT id, name, campany, "generatedToken" FROM "User" WHERE email = $1 LIMIT 1`,
    [ADMIN_EMAIL],
  );

  if (adminUsers.length === 0) {
    throw new Error(`User not found: ${ADMIN_EMAIL}`);
  }
  const adminUser = adminUsers[0];
  const clientName = adminUser.campany ?? adminUser.name;
  console.log(`✓ Admin user found: ${ADMIN_EMAIL} (id=${adminUser.id})`);

  // ── 2. Create Client table if it does not yet exist ────────────────────────

  if (!(await tableExists('Client'))) {
    console.log('  Creating Client table …');
    await execute(`
      CREATE TABLE "Client" (
        "id"         TEXT         NOT NULL,
        "clientName" TEXT         NOT NULL,
        "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "adminId"    TEXT         NOT NULL,
        CONSTRAINT "Client_pkey"         PRIMARY KEY ("id"),
        CONSTRAINT "Client_adminId_key"  UNIQUE ("adminId"),
        CONSTRAINT "Client_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id")
      )
    `);
    console.log('  ✓ Client table created');
  } else {
    console.log('  Client table already exists — skipping creation');
  }

  // ── 3. Upsert the Client record ────────────────────────────────────────────

  const existing = await query<{ id: string }>(
    `SELECT id FROM "Client" WHERE "adminId" = $1 LIMIT 1`,
    [adminUser.id],
  );

  let clientId: string;
  if (existing.length === 0) {
    clientId = uuidv4();
    await execute(
      `INSERT INTO "Client" ("id", "clientName", "adminId") VALUES ($1, $2, $3)`,
      [clientId, clientName, adminUser.id],
    );
    console.log(`✓ Client created: "${clientName}" (id=${clientId})`);
  } else {
    clientId = existing[0].id;
    console.log(`  Client already exists (id=${clientId}) — skipping creation`);
  }

  // ── 4. Compound ────────────────────────────────────────────────────────────

  const hasCompoundOwnerId  = await columnExists('Compound', 'ownerId');
  const hasCompoundClientId = await columnExists('Compound', 'clientId');

  if (!hasCompoundClientId) {
    await execute(`ALTER TABLE "Compound" ADD COLUMN "clientId" TEXT`);
    console.log('  Added Compound.clientId');
  }

  if (hasCompoundOwnerId) {
    const n = await execute(
      `UPDATE "Compound" SET "clientId" = $1 WHERE "ownerId" = $2 AND "clientId" IS NULL`,
      [clientId, adminUser.id],
    );
    console.log(`✓ Compound: backfilled ${n} rows (ownerId → clientId)`);
  }

  // Catch any remaining NULLs
  await execute(`UPDATE "Compound" SET "clientId" = $1 WHERE "clientId" IS NULL`, [clientId]);

  if (!(await constraintExists('Compound', 'Compound_clientId_fkey'))) {
    await execute(`ALTER TABLE "Compound" ALTER COLUMN "clientId" SET NOT NULL`);
    await execute(`
      ALTER TABLE "Compound"
        ADD CONSTRAINT "Compound_clientId_fkey"
          FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE
    `);
    console.log('  ✓ Compound.clientId → NOT NULL + FK');
  }

  if (hasCompoundOwnerId) {
    await execute(`ALTER TABLE "Compound" DROP CONSTRAINT IF EXISTS "Compound_ownerId_fkey"`);
    await execute(`ALTER TABLE "Compound" DROP COLUMN "ownerId"`);
    console.log('  ✓ Compound.ownerId dropped');
  }

  // ── 5. User (members) ──────────────────────────────────────────────────────

  const hasUserOwnerId  = await columnExists('User', 'ownerId');
  const hasUserClientId = await columnExists('User', 'clientId');

  if (!hasUserClientId) {
    await execute(`ALTER TABLE "User" ADD COLUMN "clientId" TEXT`);
    console.log('  Added User.clientId');
  }

  if (hasUserOwnerId) {
    const n = await execute(
      `UPDATE "User"
       SET "clientId" = $1
       WHERE "ownerId" = $2
         AND role IN ('GUARD', 'OPERATION', 'MANAGER')
         AND "clientId" IS NULL`,
      [clientId, adminUser.id],
    );
    console.log(`✓ Members: backfilled ${n} rows (ownerId → clientId)`);
  }

  if (!(await constraintExists('User', 'User_clientId_fkey'))) {
    await execute(`
      ALTER TABLE "User"
        ADD CONSTRAINT "User_clientId_fkey"
          FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL
    `);
    console.log('  ✓ User.clientId FK added');
  }

  if (hasUserOwnerId) {
    await execute(`ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_ownerId_fkey"`);
    await execute(`ALTER TABLE "User" DROP COLUMN "ownerId"`);
    console.log('  ✓ User.ownerId dropped');
  }

  // ── 6. Visit ───────────────────────────────────────────────────────────────

  const hasVisitUserToken = await columnExists('Visit', 'userToken');
  const hasVisitClientId  = await columnExists('Visit', 'clientId');

  if (!hasVisitClientId) {
    await execute(`ALTER TABLE "Visit" ADD COLUMN "clientId" TEXT`);
    console.log('  Added Visit.clientId');
  }

  if (hasVisitUserToken) {
    const n = await execute(
      `UPDATE "Visit"
       SET "clientId" = $1
       WHERE "userToken" = $2 AND "clientId" IS NULL`,
      [clientId, adminUser.generatedToken],
    );
    console.log(`✓ Visit: backfilled ${n} rows (userToken → clientId)`);

    // Any visits with other/null userTokens — assign to this client
    const rest = await execute(
      `UPDATE "Visit" SET "clientId" = $1 WHERE "clientId" IS NULL`,
      [clientId],
    );
    if (rest > 0) console.log(`  Visit: assigned ${rest} additional rows`);
  }

  if (!(await constraintExists('Visit', 'Visit_clientId_fkey'))) {
    await execute(`
      ALTER TABLE "Visit"
        ADD CONSTRAINT "Visit_clientId_fkey"
          FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL
    `);
    console.log('  ✓ Visit.clientId FK added');
  }

  if (hasVisitUserToken) {
    await execute(`ALTER TABLE "Visit" DROP CONSTRAINT IF EXISTS "Visit_userToken_fkey"`);
    await execute(`ALTER TABLE "Visit" DROP COLUMN "userToken"`);
    console.log('  ✓ Visit.userToken dropped');
  }

  // ── 7. srs ─────────────────────────────────────────────────────────────────

  const hasSrsUserToken = await columnExists('srs', 'userToken');
  const hasSrsClientId  = await columnExists('srs', 'clientId');

  if (!hasSrsClientId) {
    await execute(`ALTER TABLE "srs" ADD COLUMN "clientId" TEXT`);
    console.log('  Added srs.clientId');
  }

  if (hasSrsUserToken) {
    const n = await execute(
      `UPDATE "srs"
       SET "clientId" = $1
       WHERE "userToken" = $2 AND "clientId" IS NULL`,
      [clientId, adminUser.generatedToken],
    );
    console.log(`✓ SRS: backfilled ${n} rows (userToken → clientId)`);

    const rest = await execute(
      `UPDATE "srs" SET "clientId" = $1 WHERE "clientId" IS NULL`,
      [clientId],
    );
    if (rest > 0) console.log(`  SRS: assigned ${rest} additional rows`);
  }

  if (!(await constraintExists('srs', 'srs_clientId_fkey'))) {
    await execute(`
      ALTER TABLE "srs"
        ADD CONSTRAINT "srs_clientId_fkey"
          FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL
    `);
    console.log('  ✓ srs.clientId FK added');
  }

  if (hasSrsUserToken) {
    await execute(`ALTER TABLE "srs" DROP CONSTRAINT IF EXISTS "srs_userToken_fkey"`);
    await execute(`ALTER TABLE "srs" DROP COLUMN "userToken"`);
    console.log('  ✓ srs.userToken dropped');
  }

  // ── 8. Summary ─────────────────────────────────────────────────────────────

  const [[{ count: cCount }], [{ count: vCount }], [{ count: sCount }], [{ count: mCount }]] =
    await Promise.all([
      query<{ count: string }>(`SELECT COUNT(*)::int as count FROM "Compound" WHERE "clientId" = $1`, [clientId]),
      query<{ count: string }>(`SELECT COUNT(*)::int as count FROM "Visit"    WHERE "clientId" = $1`, [clientId]),
      query<{ count: string }>(`SELECT COUNT(*)::int as count FROM "srs"      WHERE "clientId" = $1`, [clientId]),
      query<{ count: string }>(`SELECT COUNT(*)::int as count FROM "User"     WHERE "clientId" = $1`, [clientId]),
    ]);

  console.log('\n── Migration complete ────────────────────────────────────────────');
  console.log(`   Client:    "${clientName}" (${clientId})`);
  console.log(`   Admin:     ${ADMIN_EMAIL}`);
  console.log(`   Compounds: ${cCount}`);
  console.log(`   Visits:    ${vCount}`);
  console.log(`   SRS:       ${sCount}`);
  console.log(`   Members:   ${mCount}`);
  console.log('\nNext step:');
  console.log('   npx prisma migrate dev --name add-client-entity');
}

main()
  .then(() => pool.end())
  .catch(async (e) => {
    console.error('\n✗ Migration failed:', e.message);
    await pool.end();
    process.exit(1);
  });
