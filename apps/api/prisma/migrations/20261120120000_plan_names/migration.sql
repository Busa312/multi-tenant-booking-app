-- R550: plans get their names here, so the platform admin can add, rename and
-- delete plans without a deploy. `name` is English (the platform's default
-- content locale); `name_i18n` holds the others ({"ka": …, "ru": …}), falling
-- back to `name` when one is missing. Seeded with the names the CMS and the
-- marketing site carried in their catalogs until now.
ALTER TABLE "subscription_plan" ADD COLUMN "name" TEXT;
ALTER TABLE "subscription_plan" ADD COLUMN "name_i18n" JSONB;

UPDATE "subscription_plan" SET "name" = 'Early adopter', "name_i18n" = '{"ka": "ადრეული მომხმარებელი", "ru": "Ранний доступ"}' WHERE "id" = 'early';
UPDATE "subscription_plan" SET "name" = 'Early Pro',     "name_i18n" = '{"ka": "ადრეული პრო", "ru": "Ранний Pro"}'              WHERE "id" = 'early_pro';
UPDATE "subscription_plan" SET "name" = 'Standard',      "name_i18n" = '{"ka": "სტანდარტი", "ru": "Стандарт"}'                  WHERE "id" = 'standard';
UPDATE "subscription_plan" SET "name" = 'Pro',           "name_i18n" = '{"ka": "პრო", "ru": "Pro"}'                              WHERE "id" = 'pro';
-- Any other row (a plan added by hand) is named after its id.
UPDATE "subscription_plan" SET "name" = "id" WHERE "name" IS NULL;

ALTER TABLE "subscription_plan" ALTER COLUMN "name" SET NOT NULL;
ALTER TABLE "subscription_plan" ADD CONSTRAINT "subscription_plan_name_check" CHECK (length(btrim("name")) BETWEEN 1 AND 60);
