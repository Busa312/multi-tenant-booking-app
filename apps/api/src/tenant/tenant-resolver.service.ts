import { Injectable, NotFoundException } from "@nestjs/common";
import { RedisService } from "../redis/redis.service.js";
import { PrismaService } from "../prisma/prisma.service.js";

const DOMAIN_CACHE_TTL_SECONDS = 300;
const DOMAIN_CACHE_KEY = (host: string) => `domain:${host}`;

/**
 * Host header -> tenant_id, per system_design.md §7/§8: Redis first (hot path
 * for every public-site request), falling back to Postgres on a cache miss
 * and repopulating the cache. Handles both subdomains and verified custom
 * domains identically — the caller only ever passes a hostname.
 */
@Injectable()
export class TenantResolverService {
  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  async resolveTenantIdByHost(host: string): Promise<string> {
    const hostname = host.split(":")[0]!.toLowerCase();

    const cached = await this.redis.client.get(DOMAIN_CACHE_KEY(hostname));
    if (cached) {
      return cached;
    }

    const subdomain = hostname.split(".")[0];
    const tenant = await this.prisma.client.tenant.findFirst({
      where: {
        OR: [{ subdomain }, { customDomain: hostname, domainVerifiedAt: { not: null } }],
      },
      select: { id: true },
    });

    if (!tenant) {
      throw new NotFoundException(`No tenant found for host "${hostname}"`);
    }

    await this.redis.client.set(DOMAIN_CACHE_KEY(hostname), tenant.id, "EX", DOMAIN_CACHE_TTL_SECONDS);
    return tenant.id;
  }

  async invalidate(host: string): Promise<void> {
    await this.redis.client.del(DOMAIN_CACHE_KEY(host.toLowerCase()));
  }
}
