import { Prisma } from "../../generated/prisma/index.js";
import { summarizeAppointments } from "./appointment-summaries.js";
import type { PrismaAppointmentSummary } from "./serializers.js";

const TENANT_ID = "11111111-1111-1111-1111-111111111111";
const NOW = new Date("2026-11-13T08:00:00.000Z");

const appointment = (id: string, phoneNumber: string): PrismaAppointmentSummary =>
  ({
    id,
    tenantId: TENANT_ID,
    professionalId: null,
    locationId: null,
    userName: id,
    phoneNumber,
    // as the API stores it: a 9-digit Georgian mobile gains its country code
    phoneKey: `995${phoneNumber}`,
    email: "",
    startAt: NOW,
    endAt: NOW,
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
  }) as unknown as PrismaAppointmentSummary;

function setup() {
  const tx = {
    appointment: {
      findMany: jest.fn().mockResolvedValue([
        { id: "h1", visitId: null, phoneKey: "995598550594", status: "no_show", startAt: new Date("2026-11-01T08:00:00Z") },
      ]),
    },
    blockedPhone: { findMany: jest.fn().mockResolvedValue([{ phoneKey: "995598550594" }]) },
  };
  return { tx, client: tx as unknown as Prisma.TransactionClient };
}

describe("summarizeAppointments", () => {
  // R360, R380
  it("gives each appointment its own customer's record", async () => {
    const { client } = setup();

    const [flagged, clean] = await summarizeAppointments(client, TENANT_ID, [
      appointment("flagged", "598550594"),
      appointment("clean", "598550595"),
    ]);

    expect(flagged).toMatchObject({ noShowHistory: { missed: 1, of: 1 }, phoneBlocked: true });
    expect(clean).toMatchObject({ noShowHistory: null, phoneBlocked: false });
  });

  // The isolation rule: what one salon knows about a customer is read from that
  // salon's rows only. (RLS enforces the same thing in Postgres; see rls.int-spec.ts.)
  it("reads the no-show history and the blocks of this tenant only", async () => {
    const { tx, client } = setup();

    await summarizeAppointments(client, TENANT_ID, [appointment("a", "598550594")]);

    expect(tx.appointment.findMany.mock.calls[0]?.[0].where.tenantId).toBe(TENANT_ID);
    expect(tx.blockedPhone.findMany.mock.calls[0]?.[0].where.tenantId).toBe(TENANT_ID);
  });

  it("asks nothing of the database for an empty page", async () => {
    const { tx, client } = setup();

    expect(await summarizeAppointments(client, TENANT_ID, [])).toEqual([]);
    expect(tx.appointment.findMany).not.toHaveBeenCalled();
    expect(tx.blockedPhone.findMany).not.toHaveBeenCalled();
  });
});
