-- Step 1: normalise existing role values
UPDATE "User" SET role = 'OWNER' WHERE role IN ('User', 'user', '');
UPDATE "User" SET role = 'ADMIN' WHERE role IN ('Admin', 'admin');
UPDATE "User" SET role = 'GUARD' WHERE role IN ('Guard', 'guard');
UPDATE "User" SET role = 'OWNER' WHERE role NOT IN ('OWNER', 'GUARD', 'ADMIN', 'OPERATION');

-- Step 2: nullify Visit.compound values that don't match any Compound slug
UPDATE "Visit"
SET compound = NULL
WHERE compound IS NOT NULL
  AND compound NOT IN (SELECT slug FROM "Compound");

-- Step 3: nullify Visit.residentUnit values that don't match any Unit slug
UPDATE "Visit"
SET "residentUnit" = ''
WHERE "residentUnit" NOT IN (SELECT slug FROM "Unit");

-- Step 4: assign all Visit and SRS records to user fef9effc6cd6
UPDATE "Visit" SET "userToken" = 'fef9effc6cd6';
UPDATE "srs"   SET "userToken" = 'fef9effc6cd6';
