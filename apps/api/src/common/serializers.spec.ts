import { Prisma } from "../../generated/prisma/index.js";
import {
  serializeAppointment,
  serializeAppointmentSummary,
  serializeProfessional,
  serializeService,
  serializeTenant,
  serializeTimeOff,
  type PrismaAppointmentSummary,
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
  service: { name: "Haircut" },
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
  accessTokenHash: null,
  accessTokenExpiresAt: null,
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
  professional: { name: "Levan" },
  location: null,
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
            line({ serviceId: "s1", position: 0, service: { name: "Haircut" } }),
            line({ serviceId: "s2", position: 1, service: { name: "Beard trim" } }),
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

  it("never exposes the magic-link token or its expiry", () => {
    const result = serializeAppointment(
      prismaAppointment({
        accessTokenHash: "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8",
        accessTokenExpiresAt: new Date("2026-08-06T05:30:00Z"),
      }),
    );

    expect(result).not.toHaveProperty("accessTokenHash");
    expect(result).not.toHaveProperty("accessTokenExpiresAt");
  });
});

describe("serializeAppointmentSummary", () => {
  it("flattens the joined professional name", () => {
    const result = serializeAppointmentSummary(prismaAppointmentSummary());

    expect(result.professionalName).toBe("Levan");
  });

  it("reports an unassigned appointment's professional as null", () => {
    const result = serializeAppointmentSummary(
      prismaAppointmentSummary({ ...prismaAppointment({ professionalId: null }), professional: null }),
    );

    expect(result.professionalName).toBeNull();
  });

  it("reduces the magic link to a boolean and leaks no token hash", () => {
    const withLink = serializeAppointmentSummary(
      prismaAppointmentSummary({ ...prismaAppointment({ accessTokenHash: "deadbeef" }) }),
    );
    const withoutLink = serializeAppointmentSummary(prismaAppointmentSummary());

    expect(withLink.hasMagicLink).toBe(true);
    expect(withoutLink.hasMagicLink).toBe(false);
    expect(withLink).not.toHaveProperty("accessTokenHash");
    expect(JSON.stringify(withLink)).not.toContain("deadbeef");
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
