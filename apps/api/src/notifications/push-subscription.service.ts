import { BadRequestException, ConflictException, Injectable } from "@nestjs/common";
import type { JwtClaims, PushEndpointTakenResponse, SavePushSubscriptionRequest } from "@booking/shared-types";
import { Prisma } from "../../generated/prisma/index.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { TenantContextService } from "../tenant/tenant-context.service.js";

const ENDPOINT_MAX = 2048;
const KEY_MAX = 256;
const USER_AGENT_MAX = 300;

/**
 * The browsers' push services. The API POSTs to whatever endpoint a device
 * registers, so anything else is refused: otherwise a signed-in user could
 * point it at an internal address.
 */
const PUSH_SERVICE_HOSTS: readonly RegExp[] = [
  /^fcm\.googleapis\.com$/, // Chrome, Edge on Android, most Chromium browsers
  /^android\.googleapis\.com$/,
  /^([a-z0-9-]+\.)*push\.apple\.com$/, // Safari, iOS 16.4+ home-screen apps
  /^([a-z0-9-]+\.)*push\.services\.mozilla\.com$/, // Firefox
  /^([a-z0-9-]+\.)*notify\.windows\.com$/, // Edge on Windows
];

/** R620: only https URLs on a known push service. */
export function isPushServiceEndpoint(value: unknown): value is string {
  if (typeof value !== "string" || value.length > ENDPOINT_MAX) return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.port !== "" || url.username !== "" || url.password !== "") return false;
  return PUSH_SERVICE_HOSTS.some((host) => host.test(url.hostname));
}

const isKey = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= KEY_MAX && /^[A-Za-z0-9_=-]+$/.test(value);

/**
 * R620: the devices a CMS user switched push notifications on for. A device
 * belongs to whoever last switched it on there (a shared tablet changes hands
 * at sign-in), stamped with that user's session version, so ending their
 * sessions (R320) silences it.
 */
@Injectable()
export class PushSubscriptionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async save(user: JwtClaims, body: SavePushSubscriptionRequest, userAgent: string | undefined): Promise<void> {
    const { tenantId } = this.tenantContext.current;
    const endpoint = body?.endpoint;
    const p256dh = body?.keys?.p256dh;
    const auth = body?.keys?.auth;
    if (!isPushServiceEndpoint(endpoint)) throw new BadRequestException("endpoint must be a browser push service URL");
    if (!isKey(p256dh) || !isKey(auth)) throw new BadRequestException("keys.p256dh and keys.auth are required");
    const locale = body.locale;
    if (locale !== "en" && locale !== "ka" && locale !== "ru") throw new BadRequestException("locale must be en, ka or ru");

    const data = {
      tenantUserId: user.sub,
      p256dh,
      auth,
      locale,
      sessionVersion: user.sv,
      userAgent: userAgent?.slice(0, USER_AGENT_MAX) || null,
    };
    try {
      await this.prisma.forTenant(async (tx) => {
        const existing = await tx.pushSubscription.findFirst({ where: { tenantId, endpoint }, select: { id: true } });
        if (existing) {
          await tx.pushSubscription.update({ where: { id: existing.id, tenantId }, data });
        } else {
          await tx.pushSubscription.create({ data: { ...data, tenantId, endpoint } });
        }
      });
    } catch (error) {
      // The endpoint is unique platform-wide, and RLS hides other salons' rows:
      // this browser is still registered under a login at another salon.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const taken: PushEndpointTakenResponse = { code: "push_endpoint_taken" };
        throw new ConflictException(taken);
      }
      throw error;
    }
  }

  /** Only the caller's own device; switching off one that isn't on is not an error. */
  async remove(user: JwtClaims, endpoint: unknown): Promise<void> {
    if (typeof endpoint !== "string" || endpoint.length === 0) return;
    const { tenantId } = this.tenantContext.current;
    await this.prisma.forTenant((tx) =>
      tx.pushSubscription.deleteMany({ where: { tenantId, tenantUserId: user.sub, endpoint } }),
    );
  }
}
