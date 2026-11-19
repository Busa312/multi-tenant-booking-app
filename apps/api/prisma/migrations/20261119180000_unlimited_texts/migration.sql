-- R500: texts are unlimited on every plan, so a plan no longer carries an
-- allowance. Payments recorded under the old allowance keep their
-- extra_texts* columns; nothing writes them any more.
ALTER TABLE "subscription_plan" DROP CONSTRAINT "subscription_plan_sms_check";
ALTER TABLE "subscription_plan" DROP COLUMN "sms_included";
