// Booking limits the frontends need at runtime. apps/api can only `import type`
// from this package (it runs compiled JS), so it keeps twins of these values in
// apps/api/src/booking/booking-rules.ts — change both together.

// R210: services in one booking
export const MAX_SERVICES_PER_BOOKING = 5;

// R220: the gap choices offered to owners, in minutes. 0 = strictly back to back.
export const VISIT_GAP_OPTIONS = [0, 5, 10, 15, 20, 30, 45, 60] as const;

// R280: minimum notice before an online booking may start, in minutes.
export const BOOKING_NOTICE_OPTIONS: readonly number[] = [0, 30, 60, 120, 180, 240, 720, 1440, 2880];

// R290: how far ahead customers may book online, in days.
export const BOOKING_ADVANCE_OPTIONS: readonly number[] = [7, 14, 30, 60, 90, 180, 365];

// R300: until how many hours before the visit a customer may change it online.
export const CHANGE_CUTOFF_OPTIONS: readonly number[] = [0, 1, 2, 3, 6, 12, 24, 48];

// R610: how many hours before a visit its reminder text goes out. 0 = off.
export const REMINDER_HOURS_OPTIONS: readonly number[] = [0, 2, 12, 24, 48];

// R630: minutes kept free before and after each home visit. 0 = none.
export const TRAVEL_BUFFER_OPTIONS: readonly number[] = [0, 15, 30, 45, 60, 90];

// R310: CMS password rules. bcrypt only reads the first 72 bytes, so longer
// passwords are refused rather than silently truncated.
export const MIN_PASSWORD_LENGTH = 10;
export const MAX_PASSWORD_BYTES = 72;
