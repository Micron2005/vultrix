ALTER TABLE "User" ADD COLUMN "sessionNonce" TEXT;

UPDATE "User" u SET "isActive" = false
FROM "Organization" o
WHERE u."orgId" = o."id" AND o."accountType" = 'PERSONAL'
  AND u."id" <> (
    SELECT k."id" FROM "User" k WHERE k."orgId" = o."id"
    ORDER BY (k."role" = 'OWNER') DESC, k."createdAt" ASC, k."id" ASC LIMIT 1
  );
