-- R510: service categories and the salon's own order; R520: starting prices.
-- Hand-written so the RLS policy ships with the new table.

CREATE TABLE "service_category" (
    "id"         UUID        NOT NULL,
    "tenant_id"  UUID        NOT NULL,
    "name"       TEXT        NOT NULL,
    "name_i18n"  JSONB,
    "position"   INTEGER     NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_category_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "service_category_tenant_id_idx" ON "service_category"("tenant_id");
ALTER TABLE "service_category" ADD CONSTRAINT "service_category_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "service_category" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "service_category"
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- Deleting a category keeps its services, uncategorized.
ALTER TABLE "service" ADD COLUMN "category_id" UUID;
ALTER TABLE "service" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "service" ADD COLUMN "price_from" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "service" ADD CONSTRAINT "service_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "service_category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "service_category_id_idx" ON "service"("category_id");

-- Existing services keep the order they were created in.
UPDATE "service" AS s SET "position" = ordered.rn
FROM (SELECT "id", ROW_NUMBER() OVER (PARTITION BY "tenant_id" ORDER BY "created_at", "id") - 1 AS rn FROM "service") AS ordered
WHERE s."id" = ordered."id";

ALTER TABLE "appointment_service" ADD COLUMN "price_from" BOOLEAN NOT NULL DEFAULT false;
