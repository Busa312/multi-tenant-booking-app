-- Service.isActive: public-visibility / bookability toggle (R60), mirroring
-- Professional.is_active — deactivating hides the service from the public
-- listing and from new bookings without breaking the appointment.service_id
-- references that historical rows depend on. Existing rows default to true so
-- everything currently offered stays offered.
ALTER TABLE "service" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;

-- Service.description: shown on the public site's service listing. Nullable
-- because it's optional per R30, and because every pre-existing row has none.
-- The per-locale (JSONB) variant of name/description is owned by the
-- Translations ticket; this is the plain single-value column it will build on.
ALTER TABLE "service" ADD COLUMN "description" TEXT;
