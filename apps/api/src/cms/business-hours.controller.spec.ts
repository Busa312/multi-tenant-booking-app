import { BadRequestException, ForbiddenException } from "@nestjs/common";
import type { UpsertBusinessHoursRequest } from "@booking/shared-types";
import { BusinessHoursController } from "./business-hours.controller.js";
import type { PrismaService } from "../prisma/prisma.service.js";
import type { TenantContextService } from "../tenant/tenant-context.service.js";

const TENANT_ID = "11111111-1111-1111-1111-111111111111";
const NINA = "22222222-2222-2222-2222-222222222222";

interface CreatedRow {
  tenantId: string;
  professionalId: string | null;
  dayOfWeek: number;
  startTime: Date;
  endTime: Date;
  isDayOff: boolean;
}

function setup(context: { role: "owner" | "professional"; professionalId?: string }) {
  const created: CreatedRow[] = [];
  const tx = {
    businessHours: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      create: jest.fn(({ data }: { data: CreatedRow }) => {
        created.push(data);
        return Promise.resolve({ id: "row-1", ...data });
      }),
    },
  };
  const prisma = { forTenant: (fn: (client: typeof tx) => unknown) => fn(tx) } as unknown as PrismaService;
  const tenantContext = { current: { tenantId: TENANT_ID, ...context } } as unknown as TenantContextService;
  return { controller: new BusinessHoursController(prisma, tenantContext), created, tx };
}

const monday = (extra: Partial<UpsertBusinessHoursRequest> = {}): UpsertBusinessHoursRequest => ({
  dayOfWeek: 1,
  startTime: "10:00",
  endTime: "19:00",
  ...extra,
});

// R460
describe("BusinessHoursController — days off", () => {
  it("stores a professional's day off with no working window, whatever times were sent", async () => {
    const { controller, created } = setup({ role: "owner" });

    const saved = await controller.upsert(monday({ professionalId: NINA, isDayOff: true }));

    expect(created[0]).toMatchObject({ professionalId: NINA, isDayOff: true });
    expect(saved).toMatchObject({ professionalId: NINA, startTime: "00:00", endTime: "00:00", isDayOff: true });
  });

  it("replaces whatever that professional had on that weekday", async () => {
    const { controller, tx } = setup({ role: "owner" });

    await controller.upsert(monday({ professionalId: NINA, isDayOff: true }));

    expect(tx.businessHours.deleteMany).toHaveBeenCalledWith({
      where: { tenantId: TENANT_ID, professionalId: NINA, dayOfWeek: 1 },
    });
  });

  it("refuses a day off for the whole salon: a closed day is simply no hours", async () => {
    const { controller, created } = setup({ role: "owner" });

    await expect(controller.upsert(monday({ isDayOff: true }))).rejects.toBeInstanceOf(BadRequestException);
    expect(created).toHaveLength(0);
  });

  it("refuses a non-boolean flag", async () => {
    const { controller } = setup({ role: "owner" });
    const body = { ...monday({ professionalId: NINA }), isDayOff: "yes" } as unknown as UpsertBusinessHoursRequest;

    await expect(controller.upsert(body)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("keeps ordinary hours as working hours", async () => {
    const { controller } = setup({ role: "owner" });

    const saved = await controller.upsert(monday({ professionalId: NINA }));

    expect(saved).toMatchObject({ startTime: "10:00", endTime: "19:00", isDayOff: false });
  });

  it("lets a professional login mark only its own days off", async () => {
    const own = setup({ role: "professional", professionalId: NINA });
    await expect(own.controller.upsert(monday({ professionalId: NINA, isDayOff: true }))).resolves.toMatchObject({
      isDayOff: true,
    });

    const other = setup({ role: "professional", professionalId: "someone-else" });
    await expect(other.controller.upsert(monday({ professionalId: NINA, isDayOff: true }))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
