-- R250: a customer's short hold on the time they picked, one row per segment of
-- the planned visit. Hand-written so the RLS policy ships with the table.

CREATE TABLE "slot_hold" (
    "id"              UUID        NOT NULL,
    "tenant_id"       UUID        NOT NULL,
    "hold_id"         UUID        NOT NULL,
    "professional_id" UUID        NOT NULL,
    "start_at"        TIMESTAMPTZ NOT NULL,
    "end_at"          TIMESTAMPTZ NOT NULL,
    "expires_at"      TIMESTAMPTZ NOT NULL,
    "created_at"      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "slot_hold_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "slot_hold_window" CHECK ("end_at" > "start_at")
);

CREATE INDEX "slot_hold_tenant_id_idx" ON "slot_hold"("tenant_id");
CREATE INDEX "slot_hold_hold_id_idx" ON "slot_hold"("hold_id");
CREATE INDEX "slot_hold_professional_id_start_at_idx" ON "slot_hold"("professional_id", "start_at");

ALTER TABLE "slot_hold" ADD CONSTRAINT "slot_hold_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "slot_hold" ADD CONSTRAINT "slot_hold_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "professional"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS, same shape as every other policy (see *_enable_rls). Fails closed: with
-- no app.tenant_id set the table reads as empty. The booking_app runtime role
-- gets access through docker/postgres/init.sql's ALTER DEFAULT PRIVILEGES.
ALTER TABLE "slot_hold" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "slot_hold"
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
