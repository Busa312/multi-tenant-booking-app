-- R200–R240: a customer booking becomes a *visit* — one or more ordinary
-- single-professional appointments booked back to back — and the magic link
-- moves from the appointment to the visit, so one link manages every segment.
--
-- Hand-written rather than left to `prisma migrate dev`: the token columns have
-- to be copied onto visits *before* they are dropped (the generated script
-- drops first, which would kill every live customer link), and RLS isn't
-- expressible in the Prisma DSL.

-- 1. The visit table.
CREATE TABLE "visit" (
    "id"                      UUID        NOT NULL,
    "tenant_id"               UUID        NOT NULL,
    "access_token_hash"       TEXT,
    "access_token_expires_at" TIMESTAMPTZ,
    "created_at"              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"              TIMESTAMPTZ NOT NULL,

    CONSTRAINT "visit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "visit_access_token_hash_key" ON "visit"("access_token_hash");
CREATE INDEX "visit_tenant_id_idx" ON "visit"("tenant_id");

ALTER TABLE "visit" ADD CONSTRAINT "visit_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 2. R220: the per-tenant gap allowance. The range is enforced here because
-- Prisma can't express a CHECK; the CMS endpoint validates it too.
ALTER TABLE "tenant" ADD COLUMN "max_visit_gap_minutes" SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE "tenant" ADD CONSTRAINT "tenant_max_visit_gap_minutes_range"
    CHECK ("max_visit_gap_minutes" BETWEEN 0 AND 60);

-- 3. Appointments point at their visit. Nullable: staff-created bookings never
-- had a link (R70) and so have no visit. RESTRICT on delete — a visit is the
-- customer's record and isn't removed while it has segments.
ALTER TABLE "appointment" ADD COLUMN "visit_id" UUID;
CREATE INDEX "appointment_visit_id_idx" ON "appointment"("visit_id");
ALTER TABLE "appointment" ADD CONSTRAINT "appointment_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "visit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 4. Backfill, before the token columns go: every appointment that currently
-- holds a link becomes a visit of one, keeping its hash and expiry — so every
-- link already in a customer's inbox keeps working. The visit reuses the
-- appointment's id purely to make the join below trivial (different tables, so
-- no collision). Appointments without a link (staff bookings, or customer
-- bookings already cancelled, whose link was cleared) get no visit.
INSERT INTO "visit" ("id", "tenant_id", "access_token_hash", "access_token_expires_at", "created_at", "updated_at")
SELECT a."id", a."tenant_id", a."access_token_hash", a."access_token_expires_at", a."created_at", CURRENT_TIMESTAMP
FROM "appointment" a
WHERE a."access_token_hash" IS NOT NULL;

UPDATE "appointment" SET "visit_id" = "id" WHERE "access_token_hash" IS NOT NULL;

-- 5. RLS, same shape as every other policy (see *_enable_rls). Fails closed:
-- with no app.tenant_id set the table reads as empty. The booking_app runtime
-- role is granted access to new tables by docker/postgres/init.sql's ALTER
-- DEFAULT PRIVILEGES.
ALTER TABLE "visit" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "visit"
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- 6. The link now lives only on the visit.
DROP INDEX "appointment_access_token_hash_key";
ALTER TABLE "appointment" DROP COLUMN "access_token_hash",
                          DROP COLUMN "access_token_expires_at";
