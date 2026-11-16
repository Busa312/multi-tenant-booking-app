-- R460: a professional can have recurring days off. A day-off row is the
-- professional's own row for that weekday (so the organisation's hours are not
-- inherited) and carries no working window.
ALTER TABLE "business_hours" ADD COLUMN "is_day_off" BOOLEAN NOT NULL DEFAULT false;

-- Hand-written (not expressible in the Prisma DSL): only a professional can
-- have a day off — a closed organisation day is simply no row — and a day off
-- holds no hours, so any code reading the times alone still sees no window.
ALTER TABLE "business_hours" ADD CONSTRAINT "business_hours_day_off_check"
  CHECK (NOT "is_day_off" OR ("professional_id" IS NOT NULL AND "start_time" = '00:00' AND "end_time" = '00:00'));
