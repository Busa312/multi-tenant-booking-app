-- R380: phone numbers a salon has stopped from booking online. Hand-written so
-- the RLS policy ships with the table: a block belongs to one tenant and is
-- invisible to every other.

CREATE TABLE "blocked_phone" (
    "id"                 UUID        NOT NULL,
    "tenant_id"          UUID        NOT NULL,
    "phone_number"       TEXT        NOT NULL,
    "phone_key"          TEXT        NOT NULL,
    "reason"             TEXT,
    "created_by_user_id" UUID,
    "created_at"         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blocked_phone_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "blocked_phone_tenant_id_idx" ON "blocked_phone"("tenant_id");
-- One block per number per salon; the same number can be blocked by several salons.
CREATE UNIQUE INDEX "blocked_phone_tenant_id_phone_key_key" ON "blocked_phone"("tenant_id", "phone_key");

ALTER TABLE "blocked_phone" ADD CONSTRAINT "blocked_phone_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "blocked_phone" ADD CONSTRAINT "blocked_phone_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "tenant_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS, same shape as every other policy (see *_enable_rls). Fails closed: with
-- no app.tenant_id set the table reads as empty.
ALTER TABLE "blocked_phone" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "blocked_phone"
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
