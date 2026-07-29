-- TBUK-010: distinguish a CMS-created appointment from a customer-created one.
-- created_by_user_id null = the customer booked on the public site (and owns a
-- magic-link token); set = a staff member created it from the CMS (no token,
-- R70). Nullable + ON DELETE SET NULL so removing a staff login never removes
-- booking history.
ALTER TABLE "appointment" ADD COLUMN "created_by_user_id" UUID;
ALTER TABLE "appointment" ADD COLUMN "notes" TEXT;

ALTER TABLE "appointment"
  ADD CONSTRAINT "appointment_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "tenant_user"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- No RLS change: `appointment` already carries the tenant_isolation policy from
-- the *_enable_rls migration, and these are plain columns on that same table.
