-- R280–R300: per-salon booking policies for customers booking online.
ALTER TABLE "tenant"
  ADD COLUMN "min_booking_notice_minutes" SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN "max_booking_advance_days"   SMALLINT NOT NULL DEFAULT 365,
  ADD COLUMN "change_cutoff_hours"        SMALLINT NOT NULL DEFAULT 0,
  ADD CONSTRAINT "tenant_min_booking_notice_range" CHECK ("min_booking_notice_minutes" BETWEEN 0 AND 2880),
  ADD CONSTRAINT "tenant_max_booking_advance_range" CHECK ("max_booking_advance_days" BETWEEN 1 AND 365),
  ADD CONSTRAINT "tenant_change_cutoff_range" CHECK ("change_cutoff_hours" BETWEEN 0 AND 168);

-- R320: server-side session revocation; R310: forgot-password tokens.
ALTER TABLE "tenant_user"
  ADD COLUMN "session_version"           INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "password_reset_token_hash" TEXT,
  ADD COLUMN "password_reset_expires_at" TIMESTAMPTZ;

CREATE UNIQUE INDEX "tenant_user_password_reset_token_hash_key" ON "tenant_user"("password_reset_token_hash");
