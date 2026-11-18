-- R500: texts beyond a plan's allowance (0.07 GEL each) are charged with the
-- next renewal; the payment records how many, for how much, and from when.
ALTER TABLE "subscription_payment" ADD COLUMN "extra_texts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "subscription_payment" ADD COLUMN "extra_texts_amount" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "subscription_payment" ADD COLUMN "extra_texts_from" TIMESTAMPTZ;
ALTER TABLE "subscription_payment" ADD CONSTRAINT "subscription_payment_extra_texts_check"
  CHECK ("extra_texts" >= 0 AND "extra_texts_amount" >= 0 AND ("extra_texts" = 0 OR "kind" = 'renewal'));
