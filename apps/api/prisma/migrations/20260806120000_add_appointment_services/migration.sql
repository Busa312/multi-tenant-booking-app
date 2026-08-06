-- Multi-service bookings: an appointment covers one or more services.
--
-- The requirements doc already asked for this ("User can choose one or more
-- services", "filtered by chosen service(s) and duration") while the data model
-- gave `appointment` a single `service_id`. AvailabilityService has summed the
-- durations of a service *list* since day one; only persistence was singular.
-- This migration closes that gap.
--
-- Hand-written rather than left to `prisma migrate dev` because the backfill has
-- to sit between the generated CREATE and the generated DROP, and because the
-- RLS policy isn't expressible in the Prisma DSL.

-- 1. The join table. `position` is the order the services were chosen in.
CREATE TABLE "appointment_service" (
    "id"               UUID          NOT NULL,
    "tenant_id"        UUID          NOT NULL,
    "appointment_id"   UUID          NOT NULL,
    "service_id"       UUID          NOT NULL,
    "position"         SMALLINT      NOT NULL,
    "duration_minutes" INTEGER       NOT NULL,
    "price"            DECIMAL(10,2) NOT NULL,

    CONSTRAINT "appointment_service_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "appointment_service_tenant_id_idx" ON "appointment_service"("tenant_id");
CREATE INDEX "appointment_service_service_id_idx" ON "appointment_service"("service_id");
CREATE INDEX "appointment_service_appointment_id_idx" ON "appointment_service"("appointment_id");
CREATE UNIQUE INDEX "appointment_service_appointment_id_position_key" ON "appointment_service"("appointment_id", "position");

-- 2. Foreign keys. ON DELETE RESTRICT on service_id is load-bearing: it is the
-- database-level backstop behind the 409 that services.controller.ts returns for
-- a service with booking history. CASCADE here would make deleting a service
-- silently erase lines from historical appointments.
ALTER TABLE "appointment_service" ADD CONSTRAINT "appointment_service_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "appointment_service" ADD CONSTRAINT "appointment_service_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "appointment_service" ADD CONSTRAINT "appointment_service_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 3. Backfill, before the column goes away. Every existing appointment becomes
-- exactly one line at position 0.
--
-- duration_minutes comes from (end_at - start_at), NOT from
-- service.duration_minutes: end_at was computed as start_at + duration at
-- booking time, so the stored interval is the duration that was actually
-- booked. Reading the live service row instead would silently re-length every
-- historical appointment whose service has been edited since.
--
-- price comes from appointment.price: with exactly one line, the total is the
-- line, and that value is already the snapshot taken at booking time (R40).
INSERT INTO "appointment_service" ("id", "tenant_id", "appointment_id", "service_id", "position", "duration_minutes", "price")
SELECT
    gen_random_uuid(),
    a."tenant_id",
    a."id",
    a."service_id",
    0,
    (EXTRACT(EPOCH FROM (a."end_at" - a."start_at")) / 60)::int,
    a."price"
FROM "appointment" a;

-- 4. RLS, same shape as the *_enable_rls migration. Fails closed: with no
-- app.tenant_id set, current_setting returns NULL and tenant_id = NULL is never
-- true, so the table reads as empty rather than as everything. The policy binds
-- the non-owner booking_app role; ALTER DEFAULT PRIVILEGES in
-- docker/postgres/init.sql already grants that role access to new tables.
ALTER TABLE "appointment_service" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "appointment_service"
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- 5. Drop the old single-service column.
--
-- Note what this gives up: `service_id UUID NOT NULL` was a database-level
-- guarantee that every appointment had a service. A join table cannot express
-- "at least one row" without a deferred constraint trigger, so from here that
-- invariant is BookingService's to keep (and is pinned by a unit test).
ALTER TABLE "appointment" DROP CONSTRAINT "appointment_service_id_fkey";
ALTER TABLE "appointment" DROP COLUMN "service_id";
