// Booking limits the frontends need at runtime. apps/api can only `import type`
// from this package (it runs compiled JS), so it keeps twins of these values in
// apps/api/src/booking/booking-rules.ts — change both together.

// R210: services in one booking
export const MAX_SERVICES_PER_BOOKING = 5;

// R220: the gap choices offered to owners, in minutes. 0 = strictly back to back.
export const VISIT_GAP_OPTIONS = [0, 5, 10, 15, 20, 30, 45, 60] as const;
