-- R470/R540: the Early Pro plan. Plans themselves live in billing/plans.ts;
-- the database only checks that a stored id is one of them.
ALTER TABLE "subscription" DROP CONSTRAINT "subscription_plan_check";
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_plan_check"
    CHECK ("plan_id" IN ('early', 'early_pro', 'standard', 'pro'));

ALTER TABLE "subscription" DROP CONSTRAINT "subscription_next_plan_check";
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_next_plan_check"
    CHECK ("next_plan_id" IS NULL OR "next_plan_id" IN ('early', 'early_pro', 'standard', 'pro'));
