import { BadRequestException } from "@nestjs/common";
import { OnboardingService, onboardingStatus, type OnboardingFacts } from "./onboarding.service.js";
import type { PrismaService } from "../prisma/prisma.service.js";
import type { TenantContextService } from "../tenant/tenant-context.service.js";

const TENANT_ID = "11111111-1111-1111-1111-111111111111";

const nothing: OnboardingFacts = {
  locations: 0,
  tenantHours: 0,
  activeServices: 0,
  activeProfessionals: 0,
  config: {},
  skipped: [],
  dismissed: false,
  finished: false,
};

const byId = (facts: OnboardingFacts) =>
  Object.fromEntries(onboardingStatus(facts).steps.map((step) => [step.id, step]));

// R420
describe("onboardingStatus", () => {
  it("lists every step in order, none done, for a salon that hasn't started", () => {
    const status = onboardingStatus(nothing);

    expect(status.steps.map((step) => step.id)).toEqual(["locations", "hours", "services", "team", "site", "live"]);
    expect(status.steps.every((step) => !step.done && !step.skipped)).toBe(true);
    expect(status.firstRun).toBe(true);
  });

  it("reads each step's completion from the salon's data", () => {
    const steps = byId({
      ...nothing,
      locations: 1,
      tenantHours: 6,
      activeServices: 2,
      activeProfessionals: 1,
      config: { colors: { primary: "#000000" } },
    });

    expect(steps.locations?.done).toBe(true);
    expect(steps.hours?.done).toBe(true);
    expect(steps.services?.done).toBe(true);
    expect(steps.team?.done).toBe(true);
    expect(steps.site?.done).toBe(true);
    // the one step the data can't show
    expect(steps.live?.done).toBe(false);
  });

  it("counts site text as the booking site being set up, as well as colours", () => {
    expect(byId({ ...nothing, config: { copy: { title: "Hi" } } }).site?.done).toBe(true);
  });

  it("is done going live when the setup is finished", () => {
    const status = onboardingStatus({ ...nothing, dismissed: true, finished: true });

    expect(status.steps.find((step) => step.id === "live")?.done).toBe(true);
    expect(status.firstRun).toBe(false);
  });

  it("doesn't count hiding the setup as going live", () => {
    const status = onboardingStatus({ ...nothing, dismissed: true });

    expect(status.dismissed).toBe(true);
    expect(status.steps.find((step) => step.id === "live")?.done).toBe(false);
  });

  it("shows a skipped step as skipped until it is actually done", () => {
    expect(byId({ ...nothing, skipped: ["locations"] }).locations).toMatchObject({ done: false, skipped: true });
    expect(byId({ ...nothing, locations: 1, skipped: ["locations"] }).locations).toMatchObject({ done: true, skipped: false });
  });

  it("is no longer a first run once anything is done or skipped", () => {
    expect(onboardingStatus({ ...nothing, activeServices: 1 }).firstRun).toBe(false);
    expect(onboardingStatus({ ...nothing, skipped: ["site"] }).firstRun).toBe(false);
  });
});

function setup(tenant: { onboardingSkipped: string[]; onboardingDismissedAt: Date | null; onboardingFinishedAt?: Date | null }) {
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    tenant: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({ configJson: {}, onboardingFinishedAt: null, ...tenant }),
      update: jest.fn().mockResolvedValue({}),
    },
    location: { count: jest.fn().mockResolvedValue(0) },
    businessHours: { count: jest.fn().mockResolvedValue(0) },
    service: { count: jest.fn().mockResolvedValue(0) },
    professional: { count: jest.fn().mockResolvedValue(0) },
  };
  const prisma = { forTenant: (fn: (t: typeof tx) => unknown) => fn(tx) } as unknown as PrismaService;
  const tenantContext = { current: { tenantId: TENANT_ID } } as unknown as TenantContextService;
  return { tx, service: new OnboardingService(prisma, tenantContext) };
}

describe("OnboardingService.update", () => {
  it("adds and removes skips, keeping them in step order", async () => {
    const { tx, service } = setup({ onboardingSkipped: ["site"], onboardingDismissedAt: null });

    await service.update({ skip: "locations" });

    expect(tx.tenant.update).toHaveBeenCalledWith({
      where: { id: TENANT_ID },
      data: { onboardingSkipped: ["locations", "site"] },
    });

    await service.update({ unskip: "site" });
    expect(tx.tenant.update.mock.calls[1]?.[0].data.onboardingSkipped).toEqual([]);
  });

  it("records finishing once, and can bring the setup back", async () => {
    const earlier = new Date("2026-11-01T00:00:00Z");
    const { tx, service } = setup({ onboardingSkipped: [], onboardingDismissedAt: earlier });

    await service.update({ dismissed: true });
    expect(tx.tenant.update.mock.calls[0]?.[0].data.onboardingDismissedAt).toBe(earlier);

    await service.update({ dismissed: false });
    expect(tx.tenant.update.mock.calls[1]?.[0].data.onboardingDismissedAt).toBeNull();
  });

  it("finishing records it and hides the setup", async () => {
    const { tx, service } = setup({ onboardingSkipped: [], onboardingDismissedAt: null });

    await service.update({ finished: true });

    const data = tx.tenant.update.mock.calls[0]?.[0].data;
    expect(data.onboardingFinishedAt).toBeInstanceOf(Date);
    expect(data.onboardingDismissedAt).toBeInstanceOf(Date);
  });

  it("locks the salon's row before changing the skip list", async () => {
    const { tx, service } = setup({ onboardingSkipped: [], onboardingDismissedAt: null });

    await service.update({ skip: "site" });

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(tx.tenant.update.mock.invocationCallOrder[0] ?? 0);
  });

  it("refuses a step that doesn't exist", async () => {
    const { tx, service } = setup({ onboardingSkipped: [], onboardingDismissedAt: null });

    await expect(service.update({ skip: "payments" as never })).rejects.toThrow(BadRequestException);
    expect(tx.tenant.update).not.toHaveBeenCalled();
  });

  it("only reads and writes its own tenant", async () => {
    const { tx, service } = setup({ onboardingSkipped: [], onboardingDismissedAt: null });

    await service.update({ skip: "hours" });

    for (const counter of [tx.location.count, tx.businessHours.count, tx.service.count, tx.professional.count]) {
      expect(counter.mock.calls[0]?.[0].where.tenantId).toBe(TENANT_ID);
    }
    expect(tx.tenant.update.mock.calls[0]?.[0].where).toEqual({ id: TENANT_ID });
  });
});
