-- R630: services at the customer's address. No new table, so no new RLS
-- policy: the existing `service`, `tenant`, `appointment` and `slot_hold`
-- policies cover the new columns.

ALTER TABLE "service" ADD COLUMN "place" TEXT NOT NULL DEFAULT 'business';
ALTER TABLE "service" ADD CONSTRAINT "service_place_check" CHECK ("place" IN ('business', 'customer', 'either'));

ALTER TABLE "tenant" ADD COLUMN "travel_buffer_minutes" SMALLINT NOT NULL DEFAULT 30;
ALTER TABLE "tenant" ADD CONSTRAINT "tenant_travel_buffer_minutes_check"
  CHECK ("travel_buffer_minutes" IN (0, 15, 30, 45, 60, 90));
ALTER TABLE "tenant" ADD COLUMN "home_visit_fee" DECIMAL(10, 2);
ALTER TABLE "tenant" ADD CONSTRAINT "tenant_home_visit_fee_check" CHECK ("home_visit_fee" IS NULL OR "home_visit_fee" > 0);

ALTER TABLE "appointment" ADD COLUMN "place" TEXT NOT NULL DEFAULT 'business';
ALTER TABLE "appointment" ADD COLUMN "customer_address" TEXT;
ALTER TABLE "appointment" ADD COLUMN "customer_address_details" TEXT;
ALTER TABLE "appointment" ADD COLUMN "customer_address_note" TEXT;
ALTER TABLE "appointment" ADD COLUMN "travel_minutes" SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE "appointment" ADD COLUMN "home_visit_fee" DECIMAL(10, 2) NOT NULL DEFAULT 0;
ALTER TABLE "appointment" ADD CONSTRAINT "appointment_place_check" CHECK ("place" IN ('business', 'customer'));
-- An address exactly on a home visit; nothing else of a home visit at the business.
ALTER TABLE "appointment" ADD CONSTRAINT "appointment_customer_address_check" CHECK (
  ("place" = 'customer' AND "customer_address" IS NOT NULL)
  OR ("place" = 'business' AND "customer_address" IS NULL AND "customer_address_details" IS NULL
      AND "customer_address_note" IS NULL AND "travel_minutes" = 0 AND "home_visit_fee" = 0)
);
ALTER TABLE "appointment" ADD CONSTRAINT "appointment_travel_minutes_check" CHECK ("travel_minutes" BETWEEN 0 AND 90);
ALTER TABLE "appointment" ADD CONSTRAINT "appointment_home_visit_fee_check" CHECK ("home_visit_fee" >= 0);

ALTER TABLE "slot_hold" ADD COLUMN "travel_minutes" SMALLINT NOT NULL DEFAULT 0;
