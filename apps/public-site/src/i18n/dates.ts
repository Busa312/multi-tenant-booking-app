// Day and month names now live in @booking/shared-types (dates.ts), so the CMS
// writes dates the same way the booking site does. Re-exported here so the
// site's imports stay where they were.
export { DATE_NAMES, type DateParts } from "@booking/shared-types";
