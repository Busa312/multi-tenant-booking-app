-- R630: the salon keeps one home-visit fee, now always a number (0 = none),
-- and each service says whether it applies (on by default, so a salon's fee
-- keeps applying to everything it applied to before).

-- The old rule (> 0) goes first: "no fee" becomes 0 below.
ALTER TABLE "tenant" DROP CONSTRAINT "tenant_home_visit_fee_check";
UPDATE "tenant" SET "home_visit_fee" = 0 WHERE "home_visit_fee" IS NULL;
ALTER TABLE "tenant" ALTER COLUMN "home_visit_fee" SET DEFAULT 0;
ALTER TABLE "tenant" ALTER COLUMN "home_visit_fee" SET NOT NULL;
ALTER TABLE "tenant" ADD CONSTRAINT "tenant_home_visit_fee_check" CHECK ("home_visit_fee" >= 0);

ALTER TABLE "service" ADD COLUMN "home_visit_fee_applies" BOOLEAN NOT NULL DEFAULT true;
