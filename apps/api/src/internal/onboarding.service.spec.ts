import { BadRequestException, ConflictException } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { Prisma } from "../../generated/prisma/index.js";
import type { PrismaService } from "../prisma/prisma.service.js";
import { OnboardingService, validateOnboarding } from "./onboarding.service.js";
import type { IssuedOwnerLink, OwnerSetupLinkService } from "./owner-setup-link.service.js";

const valid = {
  name: "  Salon Rustaveli ",
  timezone: "Asia/Tbilisi",
  subdomain: "rustaveli",
  ownerEmail: " Owner@Example.GE ",
  ownerPassword: "a-long-enough-password",
};

// R430
describe("validateOnboarding", () => {
  it("accepts a valid salon, trimming and lowercasing the email", () => {
    expect(validateOnboarding(valid)).toEqual({
      name: "Salon Rustaveli",
      timezone: "Asia/Tbilisi",
      subdomain: "rustaveli",
      ownerEmail: "owner@example.ge",
      owner: { password: "a-long-enough-password" },
    });
  });

  it("accepts an emailed set-password link instead of a password", () => {
    const { ownerPassword: _password, ...noPassword } = valid;
    expect(validateOnboarding({ ...noPassword, emailSetupLink: true }).owner).toEqual({ emailSetupLink: true });
  });

  it("refuses both a password and a link: the owner would not know which counts", () => {
    expect(() => validateOnboarding({ ...valid, emailSetupLink: true })).toThrow(/either/);
  });

  it("refuses neither a password nor a link", () => {
    const { ownerPassword: _password, ...noPassword } = valid;
    expect(() => validateOnboarding(noPassword)).toThrow(/ownerPassword/);
  });

  it.each([
    ["uppercase", "Rustaveli"],
    ["a space", "salon one"],
    ["a leading hyphen", "-salon"],
    ["a trailing hyphen", "salon-"],
    ["a dot", "salon.ge"],
    ["nothing", ""],
    ["more than 63 characters", "a".repeat(64)],
  ])("refuses a subdomain with %s", (_case, subdomain) => {
    expect(() => validateOnboarding({ ...valid, subdomain })).toThrow(BadRequestException);
  });

  it("refuses a reserved subdomain", () => {
    expect(() => validateOnboarding({ ...valid, subdomain: "admin" })).toThrow(/reserved/);
  });

  it("accepts hyphens and digits inside a subdomain", () => {
    expect(validateOnboarding({ ...valid, subdomain: "salon-2-vake" }).subdomain).toBe("salon-2-vake");
  });

  it("refuses a password shorter than the CMS allows", () => {
    expect(() => validateOnboarding({ ...valid, ownerPassword: "pass123" })).toThrow(/ownerPassword/);
  });

  it("refuses an owner email that isn't one", () => {
    expect(() => validateOnboarding({ ...valid, ownerEmail: "owner" })).toThrow(/ownerEmail/);
  });

  it("refuses a time zone that doesn't exist", () => {
    expect(() => validateOnboarding({ ...valid, timezone: "string" })).toThrow(/timezone/);
  });

  it("refuses an empty salon name", () => {
    expect(() => validateOnboarding({ ...valid, name: "   " })).toThrow(/name/);
  });
});

// R430: creating a salon, with the owner's password set now or by an emailed link
describe("OnboardingService.onboardTenant", () => {
  const setup = (options: { taken?: boolean; emailed?: boolean } = {}) => {
    const tx = {
      tenant: { create: jest.fn().mockResolvedValue({ id: "t1", subdomain: "rustaveli" }) },
      tenantUser: {
        create: jest.fn(({ data }: { data: { email: string } }) => Promise.resolve({ id: "u1", email: data.email })),
      },
      subscription: { create: jest.fn().mockResolvedValue({}) },
      $executeRaw: jest.fn().mockResolvedValue(1),
    };
    const prisma = {
      client: {
        $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) => {
          if (options.taken) {
            throw new Prisma.PrismaClientKnownRequestError("taken", { code: "P2002", clientVersion: "test" });
          }
          return fn(tx);
        }),
      },
    } as unknown as PrismaService;
    const setupLinks = {
      deliver: jest.fn(async (link: IssuedOwnerLink) => ({
        email: link.email,
        emailed: options.emailed ?? true,
        url: options.emailed === false ? "https://cms.example.ge/set-password/t1/x" : null,
        expiresAt: link.expiresAt.toISOString(),
      })),
    };
    const service = new OnboardingService(prisma, setupLinks as unknown as OwnerSetupLinkService);
    return { service, tx, setupLinks };
  };
  const { ownerPassword: _password, ...byLink } = valid;

  it("with a password: stores its hash, issues no link and emails nothing", async () => {
    const { service, tx, setupLinks } = setup();

    const created = await service.onboardTenant(valid);

    const data = tx.tenantUser.create.mock.calls[0]?.[0]?.data as unknown as Record<string, unknown>;
    expect(await bcrypt.compare("a-long-enough-password", data.passwordHash as string)).toBe(true);
    expect(data.inviteTokenHash).toBeUndefined();
    expect(setupLinks.deliver).not.toHaveBeenCalled();
    expect(created.setupLink).toBeNull();
  });

  it("with a link: the owner gets an unknowable password and a 7-day token, emailed as a welcome", async () => {
    const { service, tx, setupLinks } = setup();

    const created = await service.onboardTenant({ ...byLink, emailSetupLink: true });

    const data = tx.tenantUser.create.mock.calls[0]?.[0]?.data as unknown as { inviteTokenHash: string; inviteTokenExpiresAt: Date };
    const link = setupLinks.deliver.mock.calls[0]?.[0] as IssuedOwnerLink;
    expect(data.inviteTokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(data.inviteTokenHash).not.toBe(link.token);
    expect(data.inviteTokenExpiresAt).toEqual(link.expiresAt);
    expect(link).toMatchObject({ tenantId: "t1", salonName: "Salon Rustaveli", workspace: "rustaveli", email: "owner@example.ge", firstTime: true });
    expect(created.setupLink).toMatchObject({ emailed: true, url: null });
  });

  it("passes the link back when it couldn't be emailed", async () => {
    const { service } = setup({ emailed: false });
    const created = await service.onboardTenant({ ...byLink, emailSetupLink: true });
    expect(created.setupLink).toMatchObject({ emailed: false, url: "https://cms.example.ge/set-password/t1/x" });
  });

  it("emails nothing when the salon wasn't created", async () => {
    const { service, setupLinks } = setup({ taken: true });
    await expect(service.onboardTenant({ ...byLink, emailSetupLink: true })).rejects.toThrow(ConflictException);
    expect(setupLinks.deliver).not.toHaveBeenCalled();
  });
});
