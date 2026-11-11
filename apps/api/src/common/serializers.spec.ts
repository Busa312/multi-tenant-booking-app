import { Prisma } from "../../generated/prisma/index.js";
import {
  serializeAppointment,
  serializeAppointmentSummary,
  serializeProfessional,
  serializeService,
  serializeTenant,
  serializeTimeOff,
  serializeVisit,
  type PrismaAppointmentSummary,
  type PrismaVisit,
} from "./serializers.js";

const TENANT_ID = "11111111-1111-1111-1111-111111111111";

const prismaTenant = (overrides: Partial<Parameters<typeof serializeTenant>[0]> = {}) => ({
  id: TENANT_ID,
  name: "Salon Rustaveli",
  timezone: "Asia/Tbilisi",
  subdomain: "rustaveli",
  customDomain: null,
  domainVerifiedAt: null,
  configJson: { primaryColor: "#0f172a" } as Prisma.JsonValue,
  maxVisitGapMinutes: 0,
  minBookingNoticeMinutes: 0,
  maxBookingAdvanceDays: 365,
  changeCutoffHours: 0,
  createdAt: new Date("2026-01-02T03:04:05.678Z"),
  ...overrides,
});

const line = (overrides: Partial<Parameters<typeof serializeAppointment>[0]["services"][number]> = {}) => ({
  id: "llllllll-llll-llll-llll-llllllllllll",
  tenantId: TENANT_ID,
  appointmentId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  serviceId: "ssssssss-ssss-ssss-ssss-ssssssssssss",
  position: 0,
  durationMinutes: 30,
  price: new Prisma.Decimal("45.50"),
  service: { name: "Haircut", nameI18n: null },
  ...overrides,
});

const prismaAppointment = (overrides: Partial<Parameters<typeof serializeAppointment>[0]> = {}) => ({
  id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  tenantId: TENANT_ID,
  services: [line()],
  professionalId: "pppppppp-pppp-pppp-pppp-pppppppppppp",
  locationId: null,
  userName: "ნინო",
  phoneNumber: "+995555123456",
  email: "nino@example.com",
  startAt: new Date("2026-08-05T05:00:00Z"),
  endAt: new Date("2026-08-05T05:30:00Z"),
  price: new Prisma.Decimal("45.50"),
  status: "booked" as const,
  visitId: null,
  createdByUserId: null,
  notes: null,
  createdAt: new Date("2026-08-01T10:00:00Z"),
  updatedAt: new Date("2026-08-02T11:00:00Z"),
  ...overrides,
});

const prismaAppointmentSummary = (
  overrides: Partial<PrismaAppointmentSummary> = {},
): PrismaAppointmentSummary => ({
  ...prismaAppointment(),
  professional: { name: "Levan", nameI18n: { ka: "ლევანი" } },
  location: null,
  visit: null,
  ...overrides,
});

describe("serializeTenant", () => {
  it("renders every Date as an ISO string", () => {
    const result = serializeTenant(prismaTenant({ domainVerifiedAt: new Date("2026-02-03T00:00:00Z") }));

    expect(result.createdAt).toBe("2026-01-02T03:04:05.678Z");
    expect(result.domainVerifiedAt).toBe("2026-02-03T00:00:00.000Z");
  });

  it("keeps an unverified domain as null rather than an empty string", () => {
    expect(serializeTenant(prismaTenant()).domainVerifiedAt).toBeNull();
  });

  it("passes the config JSON through unchanged", () => {
    expect(serializeTenant(prismaTenant()).configJson).toEqual({ primaryColor: "#0f172a" });
  });
});

describe("serializeProfessional", () => {
  it("maps the row onto the wire shape", () => {
    const result = serializeProfessional({
      id: "pppppppp-pppp-pppp-pppp-pppppppppppp",
      tenantId: TENANT_ID,
      nameI18n: null,
      locationId: null,
      name: "Levan",
      isActive: false,
      createdAt: new Date("2026-01-02T03:04:05Z"),
    });

    expect(result).toEqual({
      id: "pppppppp-pppp-pppp-pppp-pppppppppppp",
      tenantId: TENANT_ID,
      nameI18n: null,
      locationId: null,
      name: "Levan",
      isActive: false,
      createdAt: "2026-01-02T03:04:05.000Z",
    });
  });
});

describe("serializeService", () => {
  const service = (price: Prisma.Decimal) => ({
    id: "ssssssss-ssss-ssss-ssss-ssssssssssss",
    tenantId: TENANT_ID,
    name: "Haircut",
    nameI18n: null,
    description: null,
    descriptionI18n: null,
    durationMinutes: 30,
    price,
    isActive: true,
    createdAt: new Date("2026-01-02T03:04:05Z"),
  });

  it("sends price as a string, never a float — Decimal must not go through JSON as a number", () => {
    const result = serializeService(service(new Prisma.Decimal("45.50")));

    expect(typeof result.price).toBe("string");
    expect(result.price).toBe("45.5");
  });

  it("keeps precision a float would lose", () => {
    expect(serializeService(service(new Prisma.Decimal("12345678.91"))).price).toBe("12345678.91");
  });

  it("serializes a zero price without an exponent", () => {
    expect(serializeService(service(new Prisma.Decimal("0.00"))).price).toBe("0");
  });
});

describe("serializeTimeOff", () => {
  it("renders the window as ISO strings and keeps a missing reason null", () => {
    const result = serializeTimeOff({
      id: "oooooooo-oooo-oooo-oooo-oooooooooooo",
      tenantId: TENANT_ID,
      professionalId: null,
      startAt: new Date("2026-08-05T06:00:00Z"),
      endAt: new Date("2026-08-05T10:00:00Z"),
      reason: null,
    });

    expect(result).toEqual({
      id: "oooooooo-oooo-oooo-oooo-oooooooooooo",
      tenantId: TENANT_ID,
      professionalId: null,
      startAt: "2026-08-05T06:00:00.000Z",
      endAt: "2026-08-05T10:00:00.000Z",
      reason: null,
    });
  });
});

describe("serializeAppointment", () => {
  it("converts times and price to strings", () => {
    const result = serializeAppointment(prismaAppointment());

    expect(result.startAt).toBe("2026-08-05T05:00:00.000Z");
    expect(result.endAt).toBe("2026-08-05T05:30:00.000Z");
    expect(result.price).toBe("45.5");
  });

  describe("service lines", () => {
    it("renders each line with its live name and its snapshotted numbers", () => {
      const result = serializeAppointment(prismaAppointment());

      expect(result.services).toEqual([
        {
          serviceId: "ssssssss-ssss-ssss-ssss-ssssssssssss",
          name: "Haircut",
          nameI18n: null,
          durationMinutes: 30,
          price: "45.5",
        },
      ]);
    });

    it("sends each line's price as a string, never a float", () => {
      const result = serializeAppointment(
        prismaAppointment({ services: [line({ price: new Prisma.Decimal("12345678.91") })] }),
      );

      expect(result.services[0]?.price).toBe("12345678.91");
    });

    it("keeps the lines in the order the include asked for", () => {
      const result = serializeAppointment(
        prismaAppointment({
          services: [
            line({ serviceId: "s1", position: 0, service: { name: "Haircut", nameI18n: null } }),
            line({ serviceId: "s2", position: 1, service: { name: "Beard trim", nameI18n: null } }),
          ],
        }),
      );

      expect(result.services.map((entry) => entry.name)).toEqual(["Haircut", "Beard trim"]);
    });

    it("serializes an appointment with no lines as an empty array", () => {
      const result = serializeAppointment(prismaAppointment({ services: [] }));

      expect(result.services).toEqual([]);
    });

    it("exposes no internal line ids", () => {
      const result = serializeAppointment(prismaAppointment());

      expect(result.services[0]).not.toHaveProperty("id");
      expect(result.services[0]).not.toHaveProperty("appointmentId");
      expect(result.services[0]).not.toHaveProperty("position");
    });
  });

});

describe("serializeAppointmentSummary", () => {
  it("flattens the joined professional name", () => {
    const result = serializeAppointmentSummary(prismaAppointmentSummary());

    expect(result.professionalName).toBe("Levan");
  });

  // R160: the CMS picks the name for its own language from these
  it("carries the professional's and the branch's name translations", () => {
    const result = serializeAppointmentSummary(
      prismaAppointmentSummary({ location: { name: "Vake", nameI18n: { ka: "ვაკე" } } }),
    );

    expect(result.professionalNameI18n).toEqual({ ka: "ლევანი" });
    expect(result.locationNameI18n).toEqual({ ka: "ვაკე" });
  });

  it("reports an unassigned appointment's professional as null", () => {
    const result = serializeAppointmentSummary(
      prismaAppointmentSummary({ ...prismaAppointment({ professionalId: null }), professional: null }),
    );

    expect(result.professionalName).toBeNull();
  });

  // R230: the link lives on the visit
  it("reduces the visit's magic link to a boolean and leaks no token hash", () => {
    const withLink = serializeAppointmentSummary(
      prismaAppointmentSummary({ ...prismaAppointment({ visitId: "v1" }), visit: { accessTokenHash: "deadbeef" } }),
    );
    const cancelledVisit = serializeAppointmentSummary(
      prismaAppointmentSummary({ ...prismaAppointment({ visitId: "v1" }), visit: { accessTokenHash: null } }),
    );
    const staffBooking = serializeAppointmentSummary(prismaAppointmentSummary());

    expect(withLink.hasMagicLink).toBe(true);
    expect(cancelledVisit.hasMagicLink).toBe(false);
    expect(staffBooking.hasMagicLink).toBe(false);
    expect(JSON.stringify(withLink)).not.toContain("deadbeef");
  });

  // R200: staff can see an appointment is one segment of a customer visit
  it("carries the visit id, null for a staff booking", () => {
    expect(serializeAppointmentSummary(prismaAppointmentSummary({ visitId: "v1" })).visitId).toBe("v1");
    expect(serializeAppointmentSummary(prismaAppointmentSummary()).visitId).toBeNull();
  });

  it("carries the staff-only fields the plain appointment shape omits", () => {
    const result = serializeAppointmentSummary(
      prismaAppointmentSummary({
        ...prismaAppointment({ createdByUserId: "uuuuuuuu-uuuu-uuuu-uuuu-uuuuuuuuuuuu", notes: "regular client" }),
      }),
    );

    expect(result.createdByUserId).toBe("uuuuuuuu-uuuu-uuuu-uuuu-uuuuuuuuuuuu");
    expect(result.notes).toBe("regular client");
  });
});

// R230: what the customer's magic link shows
describe("serializeVisit", () => {
  const segment = (overrides: Partial<PrismaVisit["appointments"][number]> = {}) => ({
    ...prismaAppointment({ visitId: "v1" }),
    professional: { name: "Nina", nameI18n: null },
    location: { name: "Vake", nameI18n: { ka: "ვაკე" } },
    ...overrides,
  });
  const visit = (appointments: PrismaVisit["appointments"]): PrismaVisit => ({
    id: "v1",
    tenantId: TENANT_ID,
    accessTokenHash: "deadbeef",
    accessTokenExpiresAt: new Date("2026-08-06T05:30:00Z"),
    createdAt: new Date("2026-08-01T10:00:00Z"),
    updatedAt: new Date("2026-08-01T10:00:00Z"),
    appointments,
  });

  const colour = segment({
    id: "a1",
    startAt: new Date("2026-08-05T05:00:00Z"),
    endAt: new Date("2026-08-05T06:30:00Z"),
    price: new Prisma.Decimal("120.00"),
    professional: { name: "Dato", nameI18n: { ka: "დათო" } },
  });
  const cut = segment({
    id: "a2",
    startAt: new Date("2026-08-05T06:30:00Z"),
    endAt: new Date("2026-08-05T07:15:00Z"),
    price: new Prisma.Decimal("40.10"),
  });

  it("spans every segment, sums their prices exactly, and names who does each", () => {
    const result = serializeVisit(visit([colour, cut]));

    expect(result.startAt).toBe("2026-08-05T05:00:00.000Z");
    expect(result.endAt).toBe("2026-08-05T07:15:00.000Z");
    expect(result.price).toBe("160.1");
    expect(result.locationName).toBe("Vake");
    expect(result.segments.map((s) => [s.appointmentId, s.professionalName])).toEqual([
      ["a1", "Dato"],
      ["a2", "Nina"],
    ]);
  });

  // R160: the public site picks the visitor's language from these
  it("carries the translations of the branch, each professional and each service", () => {
    const translated = segment({
      ...colour,
      services: [line({ service: { name: "Colour", nameI18n: { ka: "შეღებვა" } } })],
    });
    const result = serializeVisit(visit([translated, cut]));

    expect(result.locationNameI18n).toEqual({ ka: "ვაკე" });
    expect(result.segments.map((s) => s.professionalNameI18n)).toEqual([{ ka: "დათო" }, null]);
    expect(result.segments[0]?.services[0]?.nameI18n).toEqual({ ka: "შეღებვა" });
  });

  it("leaves a staff-cancelled segment out of the times and price, but still lists it", () => {
    const result = serializeVisit(visit([colour, { ...cut, status: "cancelled" }]));

    expect(result.status).toBe("booked");
    expect(result.endAt).toBe("2026-08-05T06:30:00.000Z");
    expect(result.price).toBe("120");
    expect(result.segments).toHaveLength(2);
  });

  it("is cancelled only when every segment is", () => {
    expect(serializeVisit(visit([{ ...colour, status: "cancelled" }, cut])).status).toBe("booked");
    const all = serializeVisit(visit([{ ...colour, status: "cancelled" }, { ...cut, status: "cancelled" }]));
    expect(all.status).toBe("cancelled");
    // With nothing live, it describes what was booked.
    expect(all.price).toBe("160.1");
  });

  it("never exposes the token hash", () => {
    expect(JSON.stringify(serializeVisit(visit([colour])))).not.toContain("deadbeef");
  });
});
