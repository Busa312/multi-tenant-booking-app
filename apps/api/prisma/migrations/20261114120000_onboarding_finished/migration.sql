-- R420, continued.
--
-- 1. "Finished" is its own fact. Hiding the setup's dashboard card is not the
--    same as finishing the setup, and only finishing marks the last step
--    ("go live") done.
ALTER TABLE "tenant" ADD COLUMN "onboarding_finished_at" TIMESTAMPTZ;

-- 2. Salons that were already set up when the guided setup shipped never see
--    it: anyone with a service or a professional counts as finished. Brand-new,
--    empty salons are left alone and get the setup.
UPDATE "tenant" AS t
SET "onboarding_finished_at" = now(),
    "onboarding_dismissed_at" = COALESCE(t."onboarding_dismissed_at", now())
WHERE EXISTS (SELECT 1 FROM "service" s WHERE s."tenant_id" = t."id")
   OR EXISTS (SELECT 1 FROM "professional" p WHERE p."tenant_id" = t."id");
