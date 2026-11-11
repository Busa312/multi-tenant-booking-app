import { createHash } from "crypto";
import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import type { VisitSlot } from "@booking/shared-types";
import { PrismaService } from "../prisma/prisma.service.js";
import { RedisService } from "../redis/redis.service.js";

const TTL_SECONDS = 60;

interface Entry {
  /** The notice in force when computed — reapplied on read, against the clock then. */
  noticeMs: number;
  slots: VisitSlot[];
}

/**
 * The public visit-slot answer, cached for a minute per tenant and query
 * (system_design.md §8). Invalidation is wholesale and automatic: every
 * committed tenant-scoped write bumps the tenant's version (PrismaService
 * reports it), and the version is part of every key — so a booking, a hold, a
 * change of hours or staff all retire every cached day for that tenant, and
 * nothing that writes has to remember to.
 *
 * Load-shedding only. A stale entry can at worst offer a time that has just
 * gone; the booking re-checks under the day's lock (R260) and answers 409.
 * Redis down = every call computes, as before.
 */
@Injectable()
export class AvailabilityCacheService implements OnModuleInit {
  private readonly logger = new Logger(AvailabilityCacheService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  onModuleInit(): void {
    this.prisma.onTenantWrite((tenantId) => {
      this.redis.client.incr(versionKey(tenantId)).catch((error: unknown) => {
        this.logger.warn(`availability version bump failed for ${tenantId}: ${String(error)}`);
      });
    });
  }

  /**
   * The entry for this query, keyed by the tenant's version *now* — before
   * the caller reads the database. Storing under this same key afterwards is
   * what keeps a write that commits mid-computation from being masked: it
   * bumps the version, so this key is already stale and nobody reads it.
   * (Reading the version again at store time would file pre-write slots under
   * the post-write version.)
   */
  async lookup(tenantId: string, query: unknown): Promise<{ key: string | null; slots: VisitSlot[] | null }> {
    let key: string | null = null;
    try {
      const version = (await this.redis.client.get(versionKey(tenantId))) ?? "0";
      key = `avail:${tenantId}:${version}:${createHash("sha1").update(JSON.stringify(query)).digest("hex")}`;
      const raw = await this.redis.client.get(key);
      if (!raw) return { key, slots: null };
      const entry = JSON.parse(raw) as Entry;
      const earliest = Date.now() + entry.noticeMs;
      return { key, slots: entry.slots.filter((slot) => Date.parse(slot.startAt) >= earliest) };
    } catch {
      return { key, slots: null };
    }
  }

  /** Stores under the key `lookup` gave — never a freshly derived one. */
  async store(key: string | null, entry: Entry): Promise<void> {
    if (!key) return;
    try {
      await this.redis.client.set(key, JSON.stringify(entry), "EX", TTL_SECONDS);
    } catch {
      // Uncached; the next call computes again.
    }
  }
}

const versionKey = (tenantId: string) => `avail-version:${tenantId}`;
