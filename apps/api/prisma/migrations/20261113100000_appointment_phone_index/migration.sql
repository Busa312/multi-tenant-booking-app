-- R360: a customer's past visits are looked up by phone for every page of
-- appointments the CMS lists (the no-show history).
CREATE INDEX "appointment_tenant_id_phone_number_start_at_idx" ON "appointment"("tenant_id", "phone_number", "start_at");
