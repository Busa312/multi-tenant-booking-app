import { randomBytes } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import type {
  AdminTenantSummary,
  AdminUpdateSubscriptionRequest,
  CheckoutResponse,
  ConfirmPaymentResponse,
  SubscriptionOverview,
  SubscriptionPaymentKind,
  SubscriptionPaymentStatus,
  SubscriptionPaymentSummary,
  SubscriptionPlanId,
  UpdateSubscriptionRequest,
} from "@booking/shared-types";
import type { Prisma, Subscription, SubscriptionPayment } from "../../generated/prisma/index.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { TenantContextService } from "../tenant/tenant-context.service.js";
import { RevalidationService } from "../cms/revalidation.service.js";
import { addCycle, TRIAL_MS } from "./billing-config.js";
import { FlittClient, FlittError, type FlittOrder } from "./flitt.client.js";
import { DEFAULT_PLAN, planById, PLANS, toMinorUnits, toWirePlan } from "./plans.js";
import { matchesPayment, settle } from "./settle-payment.js";
import { EXTRA_TEXT_PRICE, extraTexts, usageWindow } from "./sms-usage.js";
import { deriveStatus, nextPeriodStart, renewalDue, type DerivedStatus } from "./subscription-status.js";

/** R470: the card check's amount, refunded by Flitt at once. */
const CARD_CHECK_AMOUNT = "1.00";
/** How long a renewal in flight keeps other instances off the subscription. */
const RENEWAL_LEASE_MS = 10 * 60_000;
/** A renewal Flitt can't tell us about for this long never reached it. */
const LOST_RENEWAL_MS = 60 * 60_000;
/** Invoices shown on the subscription page. */
const PAYMENTS_SHOWN = 36;
/** A renewal Flitt is still processing is asked about again this often, this many times. */
const PROCESSING_CHECK_MS = 3000;
const PROCESSING_CHECKS = 3;
const FINAL_STATUSES = new Set(["approved", "declined", "expired", "reversed"]);

export type CheckoutLang = "ka" | "en";

/** `<tenant id>.<kind>.<suffix>`: what lets a callback find its tenant (system_design.md §12b). */
export function orderIdFor(tenantId: string, kind: SubscriptionPaymentKind, suffix: string): string {
  return `${tenantId}.${kind}.${suffix}`;
}

const ORDER_ID = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.(signup|renewal|card)\.[A-Za-z0-9-]{1,64}$/;

/** The tenant an order id belongs to, or null if it isn't one of ours. */
export function tenantOfOrder(orderId: unknown): string | null {
  return typeof orderId === "string" ? (ORDER_ID.exec(orderId)?.[1] ?? null) : null;
}

const toSummary = (payment: SubscriptionPayment): SubscriptionPaymentSummary => ({
  id: payment.id,
  orderId: payment.orderId,
  kind: payment.kind as SubscriptionPaymentKind,
  planId: payment.planId as SubscriptionPlanId | null,
  amount: payment.amount.toFixed(2),
  status: payment.status as SubscriptionPaymentStatus,
  periodStart: payment.periodStart?.toISOString() ?? null,
  periodEnd: payment.periodEnd?.toISOString() ?? null,
  extraTexts: payment.extraTexts,
  extraTextsAmount: payment.extraTextsAmount.toFixed(2),
  cardMasked: payment.cardMasked,
  failureReason: payment.failureReason,
  createdAt: payment.createdAt.toISOString(),
});

/**
 * R470–R490: salons paying the platform (system_design.md §12b). Every method
 * runs in the current tenant's context — a request's, or one the scheduler or
 * the Flitt callback opens with `TenantContextService.runWithTenant`.
 */
@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  /** Wait between status checks of a renewal still processing (shortened by tests). */
  processingCheckMs = PROCESSING_CHECK_MS;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly flitt: FlittClient,
    private readonly revalidation: RevalidationService,
  ) {}

  private get config() {
    return this.flitt.config;
  }

  /**
   * R490's safety valve: a server with no payment provider pauses nobody —
   * nobody there could pay to lift it (e.g. deployed before the merchant exists).
   */
  private derive(subscription: Subscription, now = new Date()): DerivedStatus {
    const derived = deriveStatus(subscription, now, this.config.graceMs);
    return this.flitt.configured ? derived : { ...derived, bookingPaused: false };
  }

  /**
   * The tenant's subscription, created on first sight for a salon that has none
   * (one made before billing existed, or outside onboarding): its trial counts
   * from the salon's creation.
   */
  async subscriptionIn(tx: Prisma.TransactionClient, tenantId: string): Promise<Subscription> {
    const existing = await tx.subscription.findUnique({ where: { tenantId } });
    if (existing) return existing;
    const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { createdAt: true } });
    // ON CONFLICT DO NOTHING: two requests meeting a missing row at once (two
    // bookings, say) must both carry on, not have one fail on the unique index.
    await tx.subscription.createMany({
      data: [{ tenantId, planId: DEFAULT_PLAN, trialEndsAt: new Date(tenant.createdAt.getTime() + TRIAL_MS) }],
      skipDuplicates: true,
    });
    return tx.subscription.findUniqueOrThrow({ where: { tenantId } });
  }

  /** R490: whether this salon's booking site is paused. */
  async bookingPausedIn(tx: Prisma.TransactionClient, tenantId: string): Promise<boolean> {
    return this.derive(await this.subscriptionIn(tx, tenantId)).bookingPaused;
  }

  /** R490: refuses a new online booking or hold while the salon is lapsed. */
  async assertBookableIn(tx: Prisma.TransactionClient, tenantId: string): Promise<void> {
    if (await this.bookingPausedIn(tx, tenantId)) {
      throw new ForbiddenException({ code: "booking_paused", message: "This business isn't taking online bookings right now." });
    }
  }

  async overview(): Promise<SubscriptionOverview> {
    const { tenantId } = this.tenantContext.current;
    const now = new Date();
    const { subscription, payments, sms } = await this.prisma.forTenant(async (tx) => {
      const current = await this.subscriptionIn(tx, tenantId);
      return {
        subscription: current,
        sms: await this.smsUsageIn(tx, tenantId, current, now),
        payments: await tx.subscriptionPayment.findMany({
        where: {
          tenantId,
          // A checkout still open on Flitt's page is usually one the owner walked
          // away from; it isn't an invoice unless it gets paid (it still settles
          // if Flitt's result comes in). A pending renewal is a real charge.
          NOT: { status: "pending", kind: { in: ["signup", "card"] } },
        },
          orderBy: { createdAt: "desc" },
          take: PAYMENTS_SHOWN,
        }),
      };
    });
    const derived = this.derive(subscription, now);
    return {
      status: derived.status,
      planId: subscription.planId as SubscriptionPlanId,
      nextPlanId: subscription.nextPlanId as SubscriptionPlanId | null,
      trialEndsAt: subscription.trialEndsAt.toISOString(),
      paidThrough: subscription.paidThrough?.toISOString() ?? null,
      graceEndsAt: derived.graceEndsAt?.toISOString() ?? null,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      bookingPaused: derived.bookingPaused,
      card: subscription.cardMasked ? { masked: subscription.cardMasked, brand: subscription.cardBrand } : null,
      plans: PLANS.filter((plan) => plan.offered || plan.id === subscription.planId || plan.id === subscription.nextPlanId).map(toWirePlan),
      payments: payments.map(toSummary),
      sms,
      billingAvailable: this.flitt.configured,
    };
  }

  /** R500: texts used in the current usage window (billing month, or calendar month outside one), and what's extra. */
  private async smsUsageIn(tx: Prisma.TransactionClient, tenantId: string, subscription: Subscription, now: Date): Promise<SubscriptionOverview["sms"]> {
    const { timezone } = await tx.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { timezone: true } });
    const window = usageWindow({
      derived: this.derive(subscription, now),
      paidThrough: subscription.paidThrough,
      currentPeriodStart: subscription.paidThrough ? await this.periodStartIn(tx, tenantId, subscription.paidThrough) : null,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      now,
      cycle: this.config.cycle,
      timeZone: timezone,
    });
    const used = await this.textsIn(tx, tenantId, window.start, window.end);
    const included = planById(subscription.planId)?.smsIncluded ?? 0;
    const extra = extraTexts(used, included);
    return {
      used,
      included,
      periodStart: window.start.toISOString(),
      periodEnd: window.end.toISOString(),
      billingMonth: window.kind === "billing",
      billable: window.billable,
      extra: extra.count,
      extraAmount: extra.amount,
      extraTextPrice: EXTRA_TEXT_PRICE,
    };
  }

  /** SMS parts the provider accepted in [start, end). */
  private async textsIn(tx: Prisma.TransactionClient, tenantId: string, start: Date, end: Date): Promise<number> {
    const { _sum } = await tx.smsMessage.aggregate({ where: { tenantId, sentAt: { gte: start, lt: end } }, _sum: { parts: true } });
    return _sum.parts ?? 0;
  }

  /** Where the paid month ending at `paidThrough` began: the start of the payment that bought it. */
  private async periodStartIn(tx: Prisma.TransactionClient, tenantId: string, paidThrough: Date): Promise<Date | null> {
    const payment = await tx.subscriptionPayment.findFirst({
      where: { tenantId, status: "approved", kind: { in: ["signup", "renewal"] }, periodEnd: paidThrough },
      orderBy: { settledAt: "desc" },
      select: { periodStart: true },
    });
    return payment?.periodStart ?? null;
  }

  /**
   * R470: Flitt's payment page for a month of `planId`. Only when the salon
   * isn't already paid up — a paying salon switches plan instead. The month
   * starts when the trial or paid month ends (nothing is lost by paying early),
   * or now if the salon has lapsed.
   */
  async startCheckout(planId: unknown, apiOrigin: string, lang: CheckoutLang): Promise<CheckoutResponse> {
    const plan = planById(planId);
    if (!plan?.offered) throw new BadRequestException("planId must be one of the offered plans");
    this.assertConfigured();
    const { tenantId } = this.tenantContext.current;
    const now = new Date();

    const orderId = await this.prisma.forTenant(async (tx) => {
      const subscription = await this.subscriptionIn(tx, tenantId);
      const derived = this.derive(subscription, now);
      if (derived.status === "free") throw new ConflictException("This salon is on free use; there's nothing to pay.");
      if (derived.status === "active") throw new ConflictException("This salon is paid up. Switch plan instead.");
      const periodStart = nextPeriodStart(derived, now);
      const id = orderIdFor(tenantId, "signup", randomBytes(9).toString("base64url").replace(/_/g, "-"));
      await tx.subscriptionPayment.create({
        data: {
          tenantId,
          orderId: id,
          kind: "signup",
          planId: plan.id,
          amount: plan.price,
          periodStart,
          periodEnd: addCycle(periodStart, this.config.cycle),
        },
      });
      return id;
    });

    const checkoutUrl = await this.checkoutPage(orderId, toMinorUnits(plan.price), `Subscription: ${plan.id} plan`, apiOrigin, lang, false);
    return { checkoutUrl, orderId };
  }

  /**
   * R470: replacing the saved card — a 1 GEL check on Flitt's page, refunded at
   * once, whose token replaces the old one. For a salon that pays (active, or
   * past due: the next retry then uses the new card).
   */
  async startCardChange(apiOrigin: string, lang: CheckoutLang): Promise<CheckoutResponse> {
    this.assertConfigured();
    const { tenantId } = this.tenantContext.current;
    const orderId = await this.prisma.forTenant(async (tx) => {
      const subscription = await this.subscriptionIn(tx, tenantId);
      const { status } = this.derive(subscription);
      if (!subscription.paidThrough || (status !== "active" && status !== "past_due")) {
        throw new ConflictException("Choose a plan and pay first; the card is saved with that payment.");
      }
      const id = orderIdFor(tenantId, "card", randomBytes(9).toString("base64url").replace(/_/g, "-"));
      await tx.subscriptionPayment.create({ data: { tenantId, orderId: id, kind: "card", amount: CARD_CHECK_AMOUNT } });
      return id;
    });

    const checkoutUrl = await this.checkoutPage(orderId, toMinorUnits(CARD_CHECK_AMOUNT), "Card check (refunded)", apiOrigin, lang, true);
    return { checkoutUrl, orderId };
  }

  /** R470: a plan switch for the next renewal, and cancelling or resuming it. Only for a salon that pays. */
  async update(body: UpdateSubscriptionRequest): Promise<SubscriptionOverview> {
    const { tenantId } = this.tenantContext.current;
    const planId = body?.planId;
    const cancel = body?.cancelAtPeriodEnd;
    if (cancel !== undefined && typeof cancel !== "boolean") throw new BadRequestException("cancelAtPeriodEnd must be true or false");

    await this.prisma.forTenant(async (tx) => {
      const subscription = await this.subscriptionIn(tx, tenantId);
      if (this.derive(subscription).status !== "active") {
        throw new ConflictException("Only a paid-up subscription can be changed. Choose a plan and pay instead.");
      }
      const data: Prisma.SubscriptionUpdateInput = {};
      if (planId !== undefined) {
        const plan = planById(planId);
        if (!plan || (!plan.offered && plan.id !== subscription.planId)) throw new BadRequestException("planId must be one of the offered plans");
        data.nextPlanId = plan.id === subscription.planId ? null : plan.id;
      }
      if (cancel !== undefined) data.cancelAtPeriodEnd = cancel;
      await tx.subscription.update({ where: { tenantId }, data });
    });
    return this.overview();
  }

  /**
   * The payer is back from Flitt's page: ask Flitt how that order went and
   * apply it — so it works even where Flitt's callback can't reach (local
   * development), and the owner doesn't wait on it.
   */
  async confirm(orderId: string): Promise<ConfirmPaymentResponse> {
    const { tenantId } = this.tenantContext.current;
    if (tenantOfOrder(orderId) !== tenantId) throw new NotFoundException("No such payment");
    const payment = await this.prisma.forTenant((tx) => tx.subscriptionPayment.findUnique({ where: { orderId } }));
    if (!payment) throw new NotFoundException("No such payment");
    if (payment.status === "pending" && this.flitt.configured) {
      try {
        await this.applyOrder(await this.flitt.status(orderId));
      } catch (error) {
        // The callback will settle it; the page shows "pending" meanwhile.
        this.logger.warn(`status check for ${orderId} failed: ${(error as Error).message}`);
      }
    }
    const settled = await this.prisma.forTenant((tx) => tx.subscriptionPayment.findUniqueOrThrow({ where: { orderId } }));
    return { payment: toSummary(settled), subscription: await this.overview() };
  }

  /**
   * Applies an authenticated Flitt result (callback, renewal answer or status
   * check) to the payment it's for. Safe to call any number of times.
   */
  async applyOrder(order: FlittOrder): Promise<void> {
    const { tenantId } = this.tenantContext.current;
    const orderId = order.order_id;
    if (typeof orderId !== "string" || tenantOfOrder(orderId) !== tenantId) return;
    const now = new Date();

    const paidMonth = await this.prisma.forTenant(async (tx) => {
      const payment = await tx.subscriptionPayment.findUnique({ where: { orderId } });
      if (!payment) {
        this.logger.warn(`Flitt result for unknown order ${orderId}`);
        return false;
      }
      if (!matchesPayment(order, { amount: payment.amount.toFixed(2) })) {
        this.logger.error(`Flitt result for ${orderId} doesn't match the payment (amount ${String(order.amount)} ${String(order.currency)}); ignored`);
        return false;
      }
      const subscription = await this.subscriptionIn(tx, tenantId);
      const settlement = settle(
        { kind: payment.kind as SubscriptionPaymentKind, status: payment.status as SubscriptionPaymentStatus, planId: payment.planId, amount: payment.amount.toFixed(2), periodStart: payment.periodStart },
        subscription,
        order,
        { now, cycle: this.config.cycle, retryMs: this.config.retryMs },
      );
      if (!settlement) return false;
      // Only from pending: if another result got here first, it already counted.
      const claimed = await tx.subscriptionPayment.updateMany({ where: { id: payment.id, status: "pending" }, data: settlement.payment });
      if (claimed.count === 0 || Object.keys(settlement.subscription).length === 0) return false;
      await tx.subscription.update({ where: { tenantId }, data: settlement.subscription });
      return settlement.subscription.paidThrough !== undefined;
    });
    // R490: a paused booking site opens again at once, not when its cache runs out.
    if (paidMonth) await this.refreshBookingSite();
  }

  /**
   * R470: charges this tenant's saved card if a renewal is due (the scheduler
   * calls it for every tenant). Never twice for one month: the subscription is
   * leased first, and the order id is the month plus the attempt number, which
   * both our unique index and Flitt refuse to repeat. A renewal whose outcome
   * we never heard is looked up rather than charged again.
   */
  async renewIfDue(now = new Date()): Promise<"none" | "settled" | "unknown"> {
    if (!this.flitt.configured) return "none";
    const { tenantId } = this.tenantContext.current;

    const claim = await this.prisma.forTenant(async (tx) => {
      const subscription = await tx.subscription.findUnique({ where: { tenantId } });
      if (!subscription?.paidThrough || !subscription.rectoken || !renewalDue(subscription, now, this.config.graceMs)) return null;
      const leased = await tx.subscription.updateMany({
        where: { tenantId, OR: [{ retryAt: null }, { retryAt: { lte: now } }] },
        data: { retryAt: new Date(now.getTime() + RENEWAL_LEASE_MS) },
      });
      if (leased.count !== 1) return null;

      const plan = planById(subscription.nextPlanId) ?? planById(subscription.planId) ?? planById(DEFAULT_PLAN);
      if (!plan) return null;
      const orderId = orderIdFor(tenantId, "renewal", `${subscription.paidThrough.getTime()}-${subscription.failedAttempts + 1}`);
      const existing = await tx.subscriptionPayment.findUnique({ where: { orderId } });
      if (existing) {
        return { orderId, existing: true, createdAt: existing.createdAt, amount: existing.amount.toFixed(2), description: "", rectoken: subscription.rectoken };
      }

      // R500: the month just ended's extra texts ride along, against the
      // allowance of the plan that month was paid for. That month is over, so
      // the count can't move: a retried renewal charges the same.
      const endedFrom = await this.periodStartIn(tx, tenantId, subscription.paidThrough);
      const allowance = planById(subscription.planId)?.smsIncluded ?? 0;
      const extra = endedFrom
        ? extraTexts(await this.textsIn(tx, tenantId, endedFrom, subscription.paidThrough), allowance)
        : extraTexts(0, allowance);
      const amount = ((toMinorUnits(plan.price) + extra.tetri) / 100).toFixed(2);

      await tx.subscriptionPayment.create({
        data: {
          tenantId,
          orderId,
          kind: "renewal",
          planId: plan.id,
          amount,
          periodStart: subscription.paidThrough,
          periodEnd: addCycle(subscription.paidThrough, this.config.cycle),
          extraTexts: extra.count,
          extraTextsAmount: extra.amount,
          extraTextsFrom: extra.count > 0 ? endedFrom : null,
        },
      });
      const description = `Subscription: ${plan.id} plan${extra.count > 0 ? ` + ${extra.count} extra texts` : ""}`;
      return { orderId, existing: false, createdAt: now, amount, description, rectoken: subscription.rectoken };
    });
    if (!claim) return "none";

    try {
      let order = claim.existing
        ? await this.flitt.status(claim.orderId)
        : await this.flitt.recurring({
            orderId: claim.orderId,
            amount: toMinorUnits(claim.amount),
            description: claim.description,
            rectoken: claim.rectoken,
            // The answer is synchronous; a callback is only a backup, and needs a known address.
            callbackUrl: this.config.apiPublicUrl ? this.callbackUrl(null) : undefined,
          });
      // Flitt can answer "processing" and settle moments later: ask again
      // shortly rather than leave it to the next pass after the lease.
      for (let check = 0; check < PROCESSING_CHECKS && !FINAL_STATUSES.has(String(order.order_status)); check++) {
        await new Promise((resolve) => setTimeout(resolve, this.processingCheckMs));
        order = await this.flitt.status(claim.orderId);
      }
      await this.applyOrder(order);
      return FINAL_STATUSES.has(String(order.order_status)) ? "settled" : "unknown";
    } catch (error) {
      if (claim.existing && error instanceof FlittError && Date.now() - claim.createdAt.getTime() > LOST_RENEWAL_MS) {
        // Flitt has no such order: the charge never reached it. Count it as a
        // failed attempt so the next one goes out under a new order id.
        await this.applyOrder({ order_id: claim.orderId, order_status: "expired", amount: toMinorUnits(claim.amount), currency: "GEL", response_description: "Not received by Flitt" });
        return "settled";
      }
      // Network trouble or a refusal: the payment stays pending, and once the
      // lease runs out the next tick looks it up.
      this.logger.warn(`renewal ${claim.orderId}: ${(error as Error).message}`);
      return "unknown";
    }
  }

  /** R430: one salon's subscription for the admin page. */
  async adminSummary(): Promise<AdminTenantSummary["subscription"]> {
    const { tenantId } = this.tenantContext.current;
    const now = new Date();
    const { subscription, sms } = await this.prisma.forTenant(async (tx) => {
      const current = await this.subscriptionIn(tx, tenantId);
      return { subscription: current, sms: await this.smsUsageIn(tx, tenantId, current, now) };
    });
    const derived = this.derive(subscription, now);
    return {
      // R500: so the platform sees who outgrows their plan
      smsUsed: sms.used,
      smsIncluded: sms.included,
      status: derived.status,
      planId: subscription.planId as SubscriptionPlanId,
      accessUntil: derived.accessUntil.toISOString(),
      paidThrough: subscription.paidThrough?.toISOString() ?? null,
      free: subscription.free,
    };
  }

  /** R430/R480: free use granted or taken back, or the trial extended, by the platform admin. */
  async adminUpdate(body: AdminUpdateSubscriptionRequest): Promise<AdminTenantSummary["subscription"]> {
    const { tenantId } = this.tenantContext.current;
    const free = body?.free;
    const days = body?.extendTrialDays;
    const endTrial = body?.endTrial;
    if (free !== undefined && typeof free !== "boolean") throw new BadRequestException("free must be true or false");
    if (endTrial !== undefined && typeof endTrial !== "boolean") throw new BadRequestException("endTrial must be true or false");
    if (endTrial && days !== undefined) throw new BadRequestException("Either extend the trial or end it, not both");
    if (days !== undefined && (!Number.isInteger(days) || days < 1 || days > 365)) {
      throw new BadRequestException("extendTrialDays must be a whole number of days, 1–365");
    }
    await this.prisma.forTenant(async (tx) => {
      const subscription = await this.subscriptionIn(tx, tenantId);
      const data: Prisma.SubscriptionUpdateInput = {};
      if (free !== undefined) data.free = free;
      if (days !== undefined) {
        const from = Math.max(Date.now(), subscription.trialEndsAt.getTime());
        data.trialEndsAt = new Date(from + days * 24 * 60 * 60_000);
      }
      if (endTrial && subscription.trialEndsAt.getTime() > Date.now()) data.trialEndsAt = new Date();
      await tx.subscription.update({ where: { tenantId }, data });
    });
    await this.refreshBookingSite();
    return this.adminSummary();
  }

  /** The booking site caches the tenant (with `bookingPaused`); best effort, never fails the caller. */
  private async refreshBookingSite(): Promise<void> {
    const { tenantId } = this.tenantContext.current;
    const tenant = await this.prisma.forTenant((tx) =>
      tx.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { subdomain: true, customDomain: true, domainVerifiedAt: true } }),
    );
    await this.revalidation.revalidateTenant({ ...tenant, domainVerifiedAt: tenant.domainVerifiedAt?.toISOString() ?? null });
  }

  private assertConfigured(): void {
    if (!this.flitt.configured) throw new ServiceUnavailableException("Payments aren't set up on this server yet.");
  }

  private base(apiOrigin: string | null): string {
    return this.config.apiPublicUrl ?? apiOrigin ?? "";
  }

  private callbackUrl(apiOrigin: string | null): string {
    return `${this.base(apiOrigin)}/billing/flitt/callback`;
  }

  private checkoutPage(orderId: string, amount: number, description: string, apiOrigin: string, lang: CheckoutLang, verification: boolean) {
    return this.flitt
      .checkoutUrl({
        orderId,
        amount,
        description,
        responseUrl: `${this.base(apiOrigin)}/billing/flitt/return?order=${encodeURIComponent(orderId)}`,
        callbackUrl: this.callbackUrl(apiOrigin),
        lang,
        verification,
      })
      .catch((error: unknown) => {
        this.logger.error(`checkout for ${orderId} failed: ${(error as Error).message}`);
        throw new ServiceUnavailableException("The payment page couldn't be opened. Try again in a moment.");
      });
  }
}
