import { createHash } from "node:crypto";
import { ConflictException, NotFoundException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { Prisma } from "../../generated/prisma/index.js";
import type { MailService } from "../notifications/mail.service.js";
import type { PrismaService } from "../prisma/prisma.service.js";
import type { TenantContextService } from "../tenant/tenant-context.service.js";
import { OwnerSetupLinkService } from "./owner-setup-link.service.js";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

const owner = (overrides: Record<string, unknown> = {}) => ({
  id: "u1",
  email: "owner@example.ge",
  role: "owner",
  isActive: true,
  lastLoginAt: null,
  ...overrides,
});

const setup = (options: { owner?: ReturnType<typeof owner> | null; emailed?: boolean } = {}) => {
  const tx = {
    tenantUser: {
      findFirst: jest.fn().mockResolvedValue(options.owner === undefined ? owner() : options.owner),
      update: jest.fn().mockResolvedValue({}),
    },
    tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ name: "Vake Nails", subdomain: "vake-nails" }) },
  };
  const prisma = {
    forTenant: jest.fn((fn: (tx: Prisma.TransactionClient) => Promise<unknown>) => fn(tx as unknown as Prisma.TransactionClient)),
  } as unknown as PrismaService;
  const mail = { send: jest.fn().mockResolvedValue(options.emailed ?? true), configured: options.emailed ?? true };
  const config = { get: (key: string) => (key === "CMS_URL" ? "https://cms.example.ge/" : undefined) } as unknown as ConfigService;
  const service = new OwnerSetupLinkService(
    prisma,
    { current: { tenantId: TENANT_ID } } as unknown as TenantContextService,
    mail as unknown as MailService,
    config,
  );
  return { service, tx, mail };
};

const linkIn = (text: string) => text.match(/https:\/\/cms\.example\.ge\/set-password\/\S+/)?.[0] ?? "";

// R430
describe("OwnerSetupLinkService", () => {
  it("stores only the hash of a fresh 7-day token on the owner, and emails the link", async () => {
    const { service, tx, mail } = setup();

    const result = await service.sendFresh();

    const data = tx.tenantUser.update.mock.calls[0]?.[0]?.data as { inviteTokenHash: string; inviteTokenExpiresAt: Date };
    const sent = mail.send.mock.calls[0]?.[0] as { to: string; content: { text: string } };
    const url = linkIn(sent.content.text);
    const token = decodeURIComponent(url.split("/").at(-1) ?? "");
    expect(url.startsWith(`https://cms.example.ge/set-password/${TENANT_ID}/`)).toBe(true);
    expect(data.inviteTokenHash).toBe(sha256(token));
    expect(data.inviteTokenExpiresAt.getTime() - Date.now()).toBeGreaterThan(7 * 24 * 3600_000 - 60_000);
    expect(sent.to).toBe("owner@example.ge");
    // Emailed: the link doesn't come back to the admin
    expect(result).toEqual({ email: "owner@example.ge", emailed: true, url: null, expiresAt: data.inviteTokenExpiresAt.toISOString() });
  });

  it("hands the link back when it couldn't be emailed, so the admin can pass it on", async () => {
    const { service, mail } = setup({ emailed: false });

    const result = await service.sendFresh();

    const sent = mail.send.mock.calls[0]?.[0] as { content: { text: string } };
    expect(result.emailed).toBe(false);
    expect(result.url).toBe(linkIn(sent.content.text));
  });

  it("welcomes an owner who never signed in, and sends one who has a new-password link instead", async () => {
    const first = setup();
    await first.service.sendFresh();
    expect((first.mail.send.mock.calls[0]?.[0] as { content: { subject: string } }).content.subject).toContain("Your salon is ready");

    const returning = setup({ owner: owner({ lastLoginAt: new Date() }) });
    await returning.service.sendFresh();
    expect((returning.mail.send.mock.calls[0]?.[0] as { content: { subject: string } }).content.subject).toContain("Set a new password");
  });

  it("refuses a salon with no owner, or whose owner's login is off, and sends nothing", async () => {
    const none = setup({ owner: null });
    await expect(none.service.sendFresh()).rejects.toThrow(NotFoundException);
    expect(none.mail.send).not.toHaveBeenCalled();

    const off = setup({ owner: owner({ isActive: false }) });
    await expect(off.service.sendFresh()).rejects.toThrow(ConflictException);
    expect(off.tx.tenantUser.update).not.toHaveBeenCalled();
  });
});
