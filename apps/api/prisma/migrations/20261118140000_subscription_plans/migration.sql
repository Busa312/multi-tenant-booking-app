-- R550: the plans move from code into a table the platform admin edits.
-- Platform-wide (no tenant_id, so no RLS): every salon reads the same rows.
-- booking_app gets access through docker/postgres/init.sql's DEFAULT PRIVILEGES.
CREATE TABLE "subscription_plan" (
    "id"               TEXT          NOT NULL,
    "price"            DECIMAL(10,2) NOT NULL,
    "sms_included"     INTEGER       NOT NULL,
    "max_locations"    INTEGER,
    "priority_support" BOOLEAN       NOT NULL DEFAULT false,
    "offered"          BOOLEAN       NOT NULL DEFAULT false,
    "position"         INTEGER       NOT NULL DEFAULT 0,
    "updated_at"       TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_plan_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "subscription_plan_price_check" CHECK ("price" > 0),
    CONSTRAINT "subscription_plan_sms_check" CHECK ("sms_included" >= 0),
    CONSTRAINT "subscription_plan_locations_check" CHECK ("max_locations" IS NULL OR "max_locations" >= 1)
);

-- The values billing/plans.ts held until now (R470/R540).
INSERT INTO "subscription_plan" ("id", "price", "sms_included", "max_locations", "priority_support", "offered", "position") VALUES
    ('early',     60.00,  600,  1,    false, true,  0),
    ('early_pro', 90.00,  1000, 3,    false, true,  1),
    ('standard',  90.00,  600,  1,    false, false, 2),
    ('pro',       150.00, 1500, NULL, true,  true,  3);

-- A stored plan id must name a plan: the foreign keys replace the lists of ids.
ALTER TABLE "subscription" DROP CONSTRAINT "subscription_plan_check";
ALTER TABLE "subscription" DROP CONSTRAINT "subscription_next_plan_check";

ALTER TABLE "subscription" ADD CONSTRAINT "subscription_plan_id_fkey"
    FOREIGN KEY ("plan_id") REFERENCES "subscription_plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_next_plan_id_fkey"
    FOREIGN KEY ("next_plan_id") REFERENCES "subscription_plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "subscription_payment" ADD CONSTRAINT "subscription_payment_plan_id_fkey"
    FOREIGN KEY ("plan_id") REFERENCES "subscription_plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
