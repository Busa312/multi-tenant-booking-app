-- R470–R490: salons paying the platform (system_design.md §12b). Hand-written
-- so the RLS policies ship with the tables.

CREATE TABLE "subscription" (
    "id"                   UUID        NOT NULL,
    "tenant_id"            UUID        NOT NULL,
    "plan_id"              TEXT        NOT NULL,
    "next_plan_id"         TEXT,
    "trial_ends_at"        TIMESTAMPTZ NOT NULL,
    "paid_through"         TIMESTAMPTZ,
    "cancel_at_period_end" BOOLEAN     NOT NULL DEFAULT false,
    "free"                 BOOLEAN     NOT NULL DEFAULT false,
    "rectoken"             TEXT,
    "card_masked"          TEXT,
    "card_brand"           TEXT,
    "failed_attempts"      INTEGER     NOT NULL DEFAULT 0,
    "retry_at"             TIMESTAMPTZ,
    "created_at"           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "subscription_plan_check" CHECK ("plan_id" IN ('early', 'standard', 'pro')),
    CONSTRAINT "subscription_next_plan_check" CHECK ("next_plan_id" IS NULL OR "next_plan_id" IN ('early', 'standard', 'pro'))
);

CREATE UNIQUE INDEX "subscription_tenant_id_key" ON "subscription"("tenant_id");
CREATE INDEX "subscription_tenant_id_idx" ON "subscription"("tenant_id");
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "subscription_payment" (
    "id"               UUID          NOT NULL,
    "tenant_id"        UUID          NOT NULL,
    "order_id"         TEXT          NOT NULL,
    "kind"             TEXT          NOT NULL,
    "plan_id"          TEXT,
    "amount"           DECIMAL(10,2) NOT NULL,
    "period_start"     TIMESTAMPTZ,
    "period_end"       TIMESTAMPTZ,
    "status"           TEXT          NOT NULL DEFAULT 'pending',
    "flitt_payment_id" TEXT,
    "card_masked"      TEXT,
    "failure_reason"   TEXT,
    "created_at"       TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settled_at"       TIMESTAMPTZ,

    CONSTRAINT "subscription_payment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "subscription_payment_kind_check" CHECK ("kind" IN ('signup', 'renewal', 'card')),
    CONSTRAINT "subscription_payment_status_check" CHECK ("status" IN ('pending', 'approved', 'declined', 'expired'))
);

-- Order ids are global at Flitt, so unique across tenants too.
CREATE UNIQUE INDEX "subscription_payment_order_id_key" ON "subscription_payment"("order_id");
CREATE INDEX "subscription_payment_tenant_id_idx" ON "subscription_payment"("tenant_id");
CREATE INDEX "subscription_payment_tenant_id_created_at_idx" ON "subscription_payment"("tenant_id", "created_at");
ALTER TABLE "subscription_payment" ADD CONSTRAINT "subscription_payment_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS, same shape as every other policy (see *_enable_rls). Fails closed.
ALTER TABLE "subscription" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "subscription"
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "subscription_payment" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "subscription_payment"
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- R480: salons that existed before billing get a 14-day trial from rollout.
-- Run as the owner role, so RLS doesn't apply here.
INSERT INTO "subscription" ("id", "tenant_id", "plan_id", "trial_ends_at", "updated_at")
SELECT gen_random_uuid(), "id", 'early', CURRENT_TIMESTAMP + INTERVAL '14 days', CURRENT_TIMESTAMP
FROM "tenant";
