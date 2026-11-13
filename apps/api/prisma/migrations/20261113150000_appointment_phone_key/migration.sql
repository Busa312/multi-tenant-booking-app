-- One identity per phone number. Customers type their number however they
-- like, so "598550594" and "+995 598 55 05 94" used to be two customers for
-- the no-show history (R360), new-vs-returning (R370) and the lost-link
-- lookup. `phone_key` holds the number in one canonical spelling; the number
-- as typed stays in `phone_number`, for showing and for texting.

ALTER TABLE "appointment" ADD COLUMN "phone_key" TEXT NOT NULL DEFAULT '';

-- Backfill with the same rule as common/phone-key.ts: digits only; a leading
-- "00" dropped; a 9-digit Georgian mobile (5xx…) gains 995; anything that
-- doesn't then read as an international number (11–15 digits) keeps its bare digits.
UPDATE "appointment" AS a
SET "phone_key" = CASE
    WHEN length(n.e) = 9 AND left(n.e, 1) = '5' THEN '995' || n.e
    WHEN length(n.e) BETWEEN 11 AND 15 THEN n.e
    ELSE n.d
  END
FROM (
  SELECT id,
         regexp_replace(phone_number, '\D', '', 'g') AS d,
         regexp_replace(regexp_replace(phone_number, '\D', '', 'g'), '^00', '') AS e
  FROM "appointment"
) AS n
WHERE n.id = a.id;

ALTER TABLE "appointment" ALTER COLUMN "phone_key" DROP DEFAULT;

-- The lookup index moves to the column the lookups now use.
DROP INDEX "appointment_tenant_id_phone_number_start_at_idx";
CREATE INDEX "appointment_tenant_id_phone_key_start_at_idx" ON "appointment"("tenant_id", "phone_key", "start_at");
