import { BadRequestException, Injectable } from "@nestjs/common";
import type {
  OnboardingStatus,
  OnboardingStepId,
  TenantConfig,
  UpdateOnboardingRequest,
} from "@booking/shared-types";
import { PrismaService } from "../prisma/prisma.service.js";
import { TenantContextService } from "../tenant/tenant-context.service.js";
import { ONBOARDING_STEP_ORDER } from "../common/onboarding-steps.js";


const isStep = (value: unknown): value is OnboardingStepId =>
  typeof value === "string" && (ONBOARDING_STEP_ORDER as readonly string[]).includes(value);

/** What the salon's data says, step by step. */
export interface OnboardingFacts {
  locations: number;
  /** Tenant-wide business-hours rows. */
  tenantHours: number;
  activeServices: number;
  activeProfessionals: number;
  config: TenantConfig;
  skipped: readonly string[];
  dismissed: boolean;
  finished: boolean;
}

/**
 * Which steps are done, from the data alone — so the setup can never claim a
 * step is finished when it isn't, and anything done elsewhere in the CMS counts.
 * "live" is the one step the data can't show: it is done when the owner
 * finishes the setup — not merely hides it.
 */
export function onboardingStatus(facts: OnboardingFacts): OnboardingStatus {
  const done: Record<OnboardingStepId, boolean> = {
    locations: facts.locations > 0,
    hours: facts.tenantHours > 0,
    services: facts.activeServices > 0,
    team: facts.activeProfessionals > 0,
    site: facts.config.colors !== undefined || facts.config.copy !== undefined,
    live: facts.finished,
  };
  const steps = ONBOARDING_STEP_ORDER.map((id) => ({
    id,
    done: done[id],
    // A step finished after being skipped is simply done.
    skipped: !done[id] && facts.skipped.includes(id),
  }));
  return {
    steps,
    dismissed: facts.dismissed,
    firstRun: !facts.dismissed && steps.every((step) => !step.done && !step.skipped),
  };
}

@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async status(): Promise<OnboardingStatus> {
    const { tenantId } = this.tenantContext.current;
    return this.prisma.forTenant(async (tx) => {
      const [tenant, locations, tenantHours, activeServices, activeProfessionals] = await Promise.all([
        tx.tenant.findUniqueOrThrow({
          where: { id: tenantId },
          select: { configJson: true, onboardingSkipped: true, onboardingDismissedAt: true, onboardingFinishedAt: true },
        }),
        tx.location.count({ where: { tenantId } }),
        tx.businessHours.count({ where: { tenantId, professionalId: null } }),
        tx.service.count({ where: { tenantId, isActive: true } }),
        tx.professional.count({ where: { tenantId, isActive: true } }),
      ]);
      return onboardingStatus({
        locations,
        tenantHours,
        activeServices,
        activeProfessionals,
        config: (tenant.configJson ?? {}) as TenantConfig,
        skipped: tenant.onboardingSkipped,
        dismissed: tenant.onboardingDismissedAt !== null,
        finished: tenant.onboardingFinishedAt !== null,
      });
    });
  }

  async update(body: UpdateOnboardingRequest): Promise<OnboardingStatus> {
    const { tenantId } = this.tenantContext.current;
    const { skip, unskip, dismissed, finished } = body ?? {};
    if (skip !== undefined && !isStep(skip)) throw new BadRequestException("skip must be a setup step");
    if (unskip !== undefined && !isStep(unskip)) throw new BadRequestException("unskip must be a setup step");
    if (dismissed !== undefined && typeof dismissed !== "boolean") throw new BadRequestException("dismissed must be a boolean");
    if (finished !== undefined && finished !== true) throw new BadRequestException("finished can only be true");

    await this.prisma.forTenant(async (tx) => {
      // The skip list is read, changed and written back: two tabs skipping
      // different steps at once must not lose one of them.
      await tx.$queryRaw`SELECT id FROM tenant WHERE id = ${tenantId}::uuid FOR UPDATE`;
      const tenant = await tx.tenant.findUniqueOrThrow({
        where: { id: tenantId },
        select: { onboardingSkipped: true, onboardingDismissedAt: true, onboardingFinishedAt: true },
      });
      const skipped = new Set(tenant.onboardingSkipped);
      if (skip) skipped.add(skip);
      if (unskip) skipped.delete(unskip);
      await tx.tenant.update({
        where: { id: tenantId },
        data: {
          // Kept in step order, unknown values dropped.
          onboardingSkipped: ONBOARDING_STEP_ORDER.filter((id) => skipped.has(id)),
          ...(dismissed === undefined
            ? {}
            : { onboardingDismissedAt: dismissed ? (tenant.onboardingDismissedAt ?? new Date()) : null }),
          // Finishing also hides it; the first time is the one recorded.
          ...(finished
            ? {
                onboardingFinishedAt: tenant.onboardingFinishedAt ?? new Date(),
                onboardingDismissedAt: tenant.onboardingDismissedAt ?? new Date(),
              }
            : {}),
        },
      });
    });
    return this.status();
  }
}
