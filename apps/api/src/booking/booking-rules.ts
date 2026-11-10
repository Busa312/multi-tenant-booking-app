// Twins of packages/shared-types/src/booking.ts. The API can only `import type`
// from shared-types (it runs compiled JS and can't load that package's raw
// TypeScript at runtime), so these values are repeated here — change both.

// R210: services in one booking
export const MAX_SERVICES_PER_BOOKING = 5;

// R220: the gap choices an owner may pick, in minutes. 0 = strictly back to back.
export const VISIT_GAP_OPTIONS: readonly number[] = [0, 5, 10, 15, 20, 30, 45, 60];

// R220: the planner tries gaps in these steps, smallest first, up to the tenant's
// maximum. Every option above is a multiple of it.
export const VISIT_GAP_STEP_MINUTES = 5;
