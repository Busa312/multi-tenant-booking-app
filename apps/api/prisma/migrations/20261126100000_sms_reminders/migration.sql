-- R610: a reminder text before each visit, with a link to confirm or cancel.
-- No new table, so no new RLS policy: the existing `tenant` and `appointment`
-- policies cover the new columns.

ALTER TABLE "tenant" ADD COLUMN "reminder_hours_before" SMALLINT NOT NULL DEFAULT 24;
ALTER TABLE "tenant" ADD CONSTRAINT "tenant_reminder_hours_before_check"
  CHECK ("reminder_hours_before" IN (0, 2, 12, 24, 48));

ALTER TABLE "appointment" ADD COLUMN "reminder_sent_at" TIMESTAMPTZ;
ALTER TABLE "appointment" ADD COLUMN "confirmed_at" TIMESTAMPTZ;

-- The scheduler's read: booked, not yet reminded, starting soon. Partial, so
-- it stays as small as the bookings still waiting for a reminder. Not
-- expressible in the Prisma schema.
CREATE INDEX "appointment_reminder_due_idx" ON "appointment" ("tenant_id", "start_at")
  WHERE "status" = 'booked' AND "reminder_sent_at" IS NULL;

-- R500: reminders are counted as their own kind of text.
ALTER TABLE "sms_message" DROP CONSTRAINT "sms_message_kind_check";
ALTER TABLE "sms_message" ADD CONSTRAINT "sms_message_kind_check" CHECK ("kind" IN ('otp', 'manage_link', 'reminder'));
