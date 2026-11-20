import { BadRequestException } from "@nestjs/common";
import type {
  AdminCreatePlanRequest,
  AdminPlan,
  AdminUpdatePlanRequest,
  LocalizedText,
  SubscriptionPlan,
  SubscriptionPlanId,
  SubscriptionStatus,
} from "@booking/shared-types";
import type { Prisma } from "../../generated/prisma/index.js";
import { SUPPORTED_CONTENT_LOCALES, validateLocalizedText } from "../common/i18n-validation.js";

/**
 * R470/R550: a plan as billing uses it. The plans themselves live in the
 * `subscription_plan` table, edited by the platform admin (PlanCatalog);
 * these are the pure rules over them. `offered` = an owner can choose it now;
 * a salon already on a plan that is no longer offered keeps renewing on it.
 */
export interface PlanDefinition extends SubscriptionPlan {
  offered: boolean;
}

type PlanRow = Prisma.SubscriptionPlanGetPayload<Record<string, never>>;

export function toPlanDefinition(row: PlanRow): PlanDefinition {
  return {
    id: row.id,
    name: row.name,
    nameI18n: toLocalizedText(row.nameI18n),
    price: row.price.toFixed(2),
    maxLocations: row.maxLocations,
    prioritySupport: row.prioritySupport,
    offered: row.offered,
  };
}

/** The `name_i18n` column as the wire carries it: an object of strings, or null. */
function toLocalizedText(value: Prisma.JsonValue): LocalizedText | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const entries = Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string");
  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

/** What a new salon is put on until its owner chooses — so it can't be deleted (R550). */
export const DEFAULT_PLAN: SubscriptionPlanId = "early";

export function planIn(plans: readonly PlanDefinition[], id: unknown): PlanDefinition | undefined {
  return plans.find((plan) => plan.id === id);
}

/** The wire shape, without the internal `offered` flag. */
export function toWirePlan({ offered: _offered, ...plan }: PlanDefinition): SubscriptionPlan {
  return plan;
}

export function toAdminPlan(plan: PlanDefinition): AdminPlan {
  return { ...plan };
}

/** "60.00" GEL → 6000 tetri, the integer Flitt takes. */
export function toMinorUnits(amount: string): number {
  return Math.round(Number(amount) * 100);
}

export interface LocationLimitFacts {
  status: SubscriptionStatus;
  planId: string;
  nextPlanId: string | null;
  cancelAtPeriodEnd: boolean;
  /** Whether a payment provider is configured — without one nobody can upgrade. */
  billingAvailable: boolean;
}

/**
 * R540: how many active locations the salon may have now; null = no limit.
 * None on the free trial (no plan chosen yet), on free use, or where nobody
 * could pay to lift it. Otherwise the limit of the plan the salon renews on:
 * a switch waiting for the next renewal counts at once — an upgrade's room is
 * usable now (the bigger plan is charged at renewal), and a downgrade was only
 * accepted because the salon already fits it. A cancelled subscription renews
 * on nothing, so its current plan's limit holds.
 */
export function locationLimit(facts: LocationLimitFacts, plans: readonly PlanDefinition[]): number | null {
  if (!facts.billingAvailable || facts.status === "free" || facts.status === "trial") return null;
  const renewsOn = facts.cancelAtPeriodEnd ? facts.planId : (facts.nextPlanId ?? facts.planId);
  return planIn(plans, renewsOn)?.maxLocations ?? null;
}

/** R540: whether `active` locations fit a plan (for paying for it, or switching to it). */
export function planFits(plan: SubscriptionPlan, active: number): boolean {
  return plan.maxLocations === null || active <= plan.maxLocations;
}

const PRICE = /^\d{1,6}(\.\d{1,2})?$/;
const MAX_LOCATIONS = 1000;
/** Also the column's CHECK (20261120120000_plan_names). */
export const PLAN_NAME_MAX = 60;
/** What the admin API accepts as a plan id in a URL; ids made by planIdFrom fit it. */
export const PLAN_ID = /^[a-z][a-z0-9_]{0,31}$/;

function validName(value: unknown): string {
  const name = typeof value === "string" ? value.trim() : "";
  if (name.length < 1 || name.length > PLAN_NAME_MAX) throw new BadRequestException(`name must be 1–${PLAN_NAME_MAX} characters`);
  return name;
}

/** Georgian and Russian names; English goes in `name`, so an "en" entry is dropped. */
function validNameI18n(value: unknown) {
  return validateLocalizedText(value, "nameI18n", SUPPORTED_CONTENT_LOCALES, PLAN_NAME_MAX);
}

function validPrice(value: unknown): string {
  const price = typeof value === "string" ? value.trim() : "";
  if (!PRICE.test(price) || Number(price) < 1) throw new BadRequestException("price must be at least 1.00 GEL, with up to two decimals");
  return price;
}

function validMaxLocations(value: unknown): number | null {
  if (value !== null && (!Number.isInteger(value) || (value as number) < 1 || (value as number) > MAX_LOCATIONS)) {
    throw new BadRequestException(`maxLocations must be a whole number, 1–${MAX_LOCATIONS}, or null for no limit`);
  }
  return value as number | null;
}

function validFlag(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") throw new BadRequestException(`${field} must be true or false`);
  return value;
}

/**
 * R550: an admin's edit of one plan, checked field by field. Only what is sent
 * changes. Throws a 400 naming the field for anything out of range.
 */
export function validatePlanUpdate(body: AdminUpdatePlanRequest | null | undefined): Prisma.SubscriptionPlanUpdateInput {
  const data: Prisma.SubscriptionPlanUpdateInput = {};
  if (!body || typeof body !== "object") throw new BadRequestException("Nothing to change");

  if (body.name !== undefined) data.name = validName(body.name);
  if (body.nameI18n !== undefined) data.nameI18n = validNameI18n(body.nameI18n);
  if (body.price !== undefined) data.price = validPrice(body.price);
  if (body.maxLocations !== undefined) data.maxLocations = validMaxLocations(body.maxLocations);
  for (const field of ["prioritySupport", "offered"] as const) {
    if (body[field] !== undefined) data[field] = validFlag(body[field], field);
  }
  if (Object.keys(data).length === 0) throw new BadRequestException("Nothing to change");
  return data;
}

/** R550: a new plan as the admin describes it, checked field by field; its id and position are the catalog's to give. */
export function validatePlanCreate(body: AdminCreatePlanRequest | null | undefined): Omit<Prisma.SubscriptionPlanCreateInput, "id"> {
  if (!body || typeof body !== "object") throw new BadRequestException("Describe the plan");
  return {
    name: validName(body.name),
    nameI18n: validNameI18n(body.nameI18n),
    price: validPrice(body.price),
    maxLocations: validMaxLocations(body.maxLocations === undefined ? null : body.maxLocations),
    prioritySupport: validFlag(body.prioritySupport ?? false, "prioritySupport"),
    offered: validFlag(body.offered ?? false, "offered"),
  };
}

/**
 * R550: a new plan's id, made from its English name ("Studio Plus" → "studio_plus")
 * and kept off the ids already taken ("studio_plus_2"). It names the plan in
 * logs and payment descriptions; a name that gives nothing usable becomes "plan".
 */
export function planIdFrom(name: string, taken: ReadonlySet<string>): string {
  const slug = name
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24)
    .replace(/_+$/g, "");
  const base = /^[a-z]/.test(slug) ? slug : slug ? `plan_${slug}`.slice(0, 24) : "plan";
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}_${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}
