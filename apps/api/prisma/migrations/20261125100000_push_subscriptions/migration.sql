-- R620: devices CMS users switched push notifications on for. Hand-written so
-- the RLS policy ships with the table.

CREATE TABLE "push_subscription" (
    "id"              UUID        NOT NULL,
    "tenant_id"       UUID        NOT NULL,
    "tenant_user_id"  UUID        NOT NULL,
    "endpoint"        TEXT        NOT NULL,
    "p256dh"          TEXT        NOT NULL,
    "auth"            TEXT        NOT NULL,
    "locale"          TEXT        NOT NULL,
    "session_version" INTEGER     NOT NULL,
    "user_agent"      TEXT,
    "created_at"      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_success_at" TIMESTAMPTZ,

    CONSTRAINT "push_subscription_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "push_subscription_locale_check" CHECK ("locale" IN ('en', 'ka', 'ru'))
);

CREATE UNIQUE INDEX "push_subscription_endpoint_key" ON "push_subscription"("endpoint");
CREATE INDEX "push_subscription_tenant_id_idx" ON "push_subscription"("tenant_id");
CREATE INDEX "push_subscription_tenant_id_tenant_user_id_idx" ON "push_subscription"("tenant_id", "tenant_user_id");
ALTER TABLE "push_subscription" ADD CONSTRAINT "push_subscription_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "push_subscription" ADD CONSTRAINT "push_subscription_tenant_user_id_fkey" FOREIGN KEY ("tenant_user_id") REFERENCES "tenant_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS, same shape as every other policy (see *_enable_rls). Fails closed.
ALTER TABLE "push_subscription" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "push_subscription"
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
