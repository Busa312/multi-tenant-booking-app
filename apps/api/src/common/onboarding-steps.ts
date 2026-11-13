import type { OnboardingStepId } from "@booking/shared-types";

/**
 * R420: the setup's steps, in order. The API's copy of shared-types'
 * ONBOARDING_STEPS (it may only import types from there) — one copy for the
 * service and the Swagger docs alike, so only two lists need to agree.
 */
export const ONBOARDING_STEP_ORDER: readonly OnboardingStepId[] = ["locations", "hours", "services", "team", "site", "live"];
