-- R500: texts the SMS provider accepted, counted per salon. Only what usage
-- needs: no phone number, no message text. Hand-written so the RLS policy
-- ships with the table.

CREATE TABLE "sms_message" (
    "id"        UUID        NOT NULL,
    "tenant_id" UUID        NOT NULL,
    "kind"      TEXT        NOT NULL,
    "parts"     INTEGER     NOT NULL,
    "sent_at"   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sms_message_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "sms_message_kind_check" CHECK ("kind" IN ('otp', 'manage_link')),
    CONSTRAINT "sms_message_parts_check" CHECK ("parts" > 0)
);

CREATE INDEX "sms_message_tenant_id_idx" ON "sms_message"("tenant_id");
CREATE INDEX "sms_message_tenant_id_sent_at_idx" ON "sms_message"("tenant_id", "sent_at");
ALTER TABLE "sms_message" ADD CONSTRAINT "sms_message_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS, same shape as every other policy (see *_enable_rls). Fails closed.
ALTER TABLE "sms_message" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "sms_message"
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
