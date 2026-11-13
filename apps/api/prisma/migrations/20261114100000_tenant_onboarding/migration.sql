-- R420: the guided setup's own state. Whether a step is *done* is never stored —
-- it is read from the salon's data (a location exists, hours are set, …). Only
-- what the data can't say is kept: which steps the owner chose to skip, and
-- whether they finished or dismissed the setup.
ALTER TABLE "tenant" ADD COLUMN "onboarding_skipped" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "tenant" ADD COLUMN "onboarding_dismissed_at" TIMESTAMPTZ;
