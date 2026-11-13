import { BadRequestException, ConflictException, ForbiddenException, Injectable } from "@nestjs/common";
import type { BlockPhoneRequest, BlockedPhone, PhoneBlockedResponse } from "@booking/shared-types";
import { Prisma } from "../../generated/prisma/index.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { TenantContextService } from "../tenant/tenant-context.service.js";
import { phoneKey } from "../common/phone-key.js";
import { serializeBlockedPhone } from "../common/serializers.js";

const REASON_MAX = 200;

/**
 * Which of these phones this tenant has blocked, as phone keys — one query for
 * a whole page of appointments.
 */
export async function loadBlockedKeys(
  tx: Prisma.TransactionClient,
  tenantId: string,
  phoneNumbers: string[],
): Promise<Set<string>> {
  const keys = [...new Set(phoneNumbers.map(phoneKey).filter((key) => key !== ""))];
  if (keys.length === 0) {
    return new Set();
  }
  const rows = await tx.blockedPhone.findMany({
    where: { tenantId, phoneKey: { in: keys } },
    select: { phoneKey: true },
  });
  return new Set(rows.map((row) => row.phoneKey));
}

/**
 * R380: phone numbers a salon has stopped from booking online.
 *
 * A block belongs to one tenant: every query here is scoped by `tenantId` and
 * runs through `forTenant`, so RLS backs it up — a number blocked by one salon
 * books freely at every other, and no salon can see another's list. It stops
 * the public site only; staff can still book that customer from the CMS.
 */
@Injectable()
export class BlockedPhoneService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async list(): Promise<BlockedPhone[]> {
    const { tenantId } = this.tenantContext.current;
    const rows = await this.prisma.forTenant((tx) =>
      tx.blockedPhone.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" } }),
    );
    return rows.map(serializeBlockedPhone);
  }

  async block(body: BlockPhoneRequest, createdByUserId: string | null): Promise<BlockedPhone> {
    const { tenantId } = this.tenantContext.current;
    const phoneNumber = typeof body.phoneNumber === "string" ? body.phoneNumber.trim() : "";
    const key = phoneKey(phoneNumber);
    if (key === "") {
      throw new BadRequestException("phoneNumber must contain a phone number");
    }
    const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, REASON_MAX) : "";

    try {
      const row = await this.prisma.forTenant((tx) =>
        tx.blockedPhone.create({
          data: { tenantId, phoneNumber, phoneKey: key, reason: reason || null, createdByUserId },
        }),
      );
      return serializeBlockedPhone(row);
    } catch (error) {
      // The (tenant, phone key) unique index: this salon already blocked it
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("this number is already blocked");
      }
      throw error;
    }
  }

  /** Unblocks by number, however it is spelled. Unblocking a number that isn't blocked is not an error. */
  async unblock(phoneNumber: string): Promise<void> {
    const { tenantId } = this.tenantContext.current;
    const key = phoneKey(phoneNumber);
    if (key === "") {
      throw new BadRequestException("phoneNumber must contain a phone number");
    }
    await this.prisma.forTenant((tx) => tx.blockedPhone.deleteMany({ where: { tenantId, phoneKey: key } }));
  }

  async isBlocked(phoneNumber: string): Promise<boolean> {
    const { tenantId } = this.tenantContext.current;
    const blocked = await this.prisma.forTenant((tx) => loadBlockedKeys(tx, tenantId, [phoneNumber]));
    return blocked.size > 0;
  }

  /** The public booking flow's gate: 403 `phone_blocked` for a number this salon has blocked. */
  async assertNotBlocked(phoneNumber: string): Promise<void> {
    if (typeof phoneNumber === "string" && (await this.isBlocked(phoneNumber))) {
      const body: PhoneBlockedResponse = { code: "phone_blocked" };
      throw new ForbiddenException(body);
    }
  }
}
