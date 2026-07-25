-- Professional.isActive: bookable/public-visible toggle (R60), independent
-- of TenantUser.isActive (CMS login toggle) — no auto-cascade between them.
ALTER TABLE "professional" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;

-- Invite-to-CMS (R50): a hashed, expiring token stored on the TenantUser row
-- created at invite time, cleared once the professional sets a real password.
ALTER TABLE "tenant_user" ADD COLUMN "invite_token_hash" TEXT;
ALTER TABLE "tenant_user" ADD COLUMN "invite_token_expires_at" TIMESTAMPTZ;
CREATE UNIQUE INDEX "tenant_user_invite_token_hash_key" ON "tenant_user"("invite_token_hash");
