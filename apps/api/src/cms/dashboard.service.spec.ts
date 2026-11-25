import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { Prisma } from "../../generated/prisma/index.js";
import { DashboardService } from "./dashboard.service.js";
import type { PrismaService } from "../prisma/prisma.service.js";
import type { TenantContextService } from "../tenant/tenant-context.service.js";

const TENANT_ID = "11111111-1111-1111-1111-111111111111";
const LOCATION_ID = "22222222-2222-2222-2222-222222222222";
const NOW = new Date("2026-11-12T10:00:00.000Z");

function setup(context: { role: "owner" | "professional"; professionalId: string | null }) {
  const tx = {
    tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ timezone: "Asia/Tbilisi" }) },
    appointment: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    professional: { findMany: jest.fn().mockResolvedValue([{ id: "dato" }]) },
    businessHours: { findMany: jest.fn().mockResolvedValue([]) },
    timeOff: { findMany: jest.fn().mockResolvedValue([]) },
    // R380: nobody is blocked
    blockedPhone: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const prisma = { forTenant: (fn: (t: typeof tx) => unknown) => fn(tx) } as unknown as PrismaService;
  const tenantContext = { current: { tenantId: TENANT_ID, ...context } } as unknown as TenantContextService;
  return { tx, service: new DashboardService(prisma, tenantContext) };
}

// R370
describe("DashboardService", () => {
  it("returns seven days starting with the salon's today", async () => {
    const { service } = setup({ role: "owner", professionalId: null });
    const summary = await service.summary({}, NOW);
    expect(summary.week.map((day) => day.date)).toEqual([
      "2026-11-12",
      "2026-11-13",
      "2026-11-14",
      "2026-11-15",
      "2026-11-16",
      "2026-11-17",
      "2026-11-18",
    ]);
  });

  it("gives the owner a money figure", async () => {
    const { tx, service } = setup({ role: "owner", professionalId: null });
    tx.appointment.findMany.mockImplementation(async (args: { select?: { price?: boolean } }) =>
      args.select?.price
        ? [{ id: "a1", visitId: null, phoneKey: "995555000001", status: "completed", createdByUserId: null, price: new Prisma.Decimal("50"), startAt: new Date("2026-11-10T08:00:00Z") }]
        : [],
    );
    const summary = await service.summary({}, NOW);
    expect(summary.current.completedValue).toBe("50.00");
  });

  // R20: own appointments only, and no money
  it("scopes a professional login to their own appointments and withholds money", async () => {
    const { tx, service } = setup({ role: "professional", professionalId: "nina" });
    const summary = await service.summary({}, NOW);

    for (const [args] of tx.appointment.findMany.mock.calls as [{ where: { professionalId?: string } }][]) {
      expect(args.where.professionalId).toBe("nina");
    }
    expect(tx.professional.findMany).not.toHaveBeenCalled();
    expect(summary.current.completedValue).toBeNull();
    expect(summary.previous.completedValue).toBeNull();
  });

  it("refuses a professional login with no professional record", async () => {
    const { service } = setup({ role: "professional", professionalId: null });
    await expect(service.summary({}, NOW)).rejects.toBeInstanceOf(ForbiddenException);
  });

  // R150
  it("narrows appointments to the location tab, and rejects a malformed id", async () => {
    const { tx, service } = setup({ role: "owner", professionalId: null });
    await service.summary({ locationId: LOCATION_ID }, NOW);
    for (const [args] of tx.appointment.findMany.mock.calls as [{ where: { locationId?: string } }][]) {
      expect(args.where.locationId).toBe(LOCATION_ID);
    }
    await expect(service.summary({ locationId: "nope" }, NOW)).rejects.toBeInstanceOf(BadRequestException);
  });

  // R360: only upcoming bookings whose customer missed a recent visit are listed
  it("lists upcoming bookings from customers with a missed visit, and no others", async () => {
    const { tx, service } = setup({ role: "owner", professionalId: null });
    const upcoming = (id: string, phoneNumber: string) => ({
      id,
      tenantId: TENANT_ID,
      professionalId: "dato",
      locationId: null,
      userName: id,
      phoneNumber,
      phoneKey: phoneNumber.replace("+", ""),
      email: "",
      startAt: new Date("2026-11-13T08:00:00Z"),
      endAt: new Date("2026-11-13T09:00:00Z"),
      price: new Prisma.Decimal("50"),
      homeVisitFee: new Prisma.Decimal(0),
      status: "booked",
      visitId: null,
      createdByUserId: null,
      notes: null,
      createdAt: NOW,
      updatedAt: NOW,
      services: [],
      professional: null,
      location: null,
      visit: null,
    });
    tx.appointment.findMany.mockImplementation(
      async (args: { where: { status?: unknown; startAt?: { gte?: Date } }; select?: object; include?: object }) => {
        // the upcoming list: still booked, from now on
        if (args.include && args.where.status === "booked" && args.where.startAt?.gte) {
          return [upcoming("flaky", "+995555000001"), upcoming("reliable", "+995555000002")];
        }
        // the history lookup: finished appointments of those phones
        if (args.select && typeof args.where.status === "object") {
          return [
            { id: "h1", visitId: null, phoneKey: "995555000001", status: "no_show", startAt: new Date("2026-11-01T08:00:00Z") },
            { id: "h2", visitId: null, phoneKey: "995555000002", status: "completed", startAt: new Date("2026-11-01T08:00:00Z") },
          ];
        }
        return [];
      },
    );

    const summary = await service.summary({}, NOW);

    expect(summary.atRisk.map((appointment) => appointment.userName)).toEqual(["flaky"]);
    expect(summary.atRisk[0]?.noShowHistory).toEqual({ missed: 1, of: 1 });
    expect(summary.atRiskCount).toBe(1);
  });
});
