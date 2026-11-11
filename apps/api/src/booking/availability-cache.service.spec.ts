import { AvailabilityCacheService } from "./availability-cache.service.js";
import type { PrismaService } from "../prisma/prisma.service.js";
import type { RedisService } from "../redis/redis.service.js";

// system_design.md §8: versioned keys, bumped by every committed tenant write
const setup = () => {
  const store = new Map<string, string>();
  const client = {
    get: jest.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    set: jest.fn((key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve("OK");
    }),
    incr: jest.fn((key: string) => {
      const next = Number(store.get(key) ?? 0) + 1;
      store.set(key, String(next));
      return Promise.resolve(next);
    }),
  };
  let listener: (tenantId: string) => void = () => undefined;
  const prisma = { onTenantWrite: jest.fn((fn: (tenantId: string) => void) => (listener = fn)) };
  const cache = new AvailabilityCacheService(prisma as unknown as PrismaService, { client } as unknown as RedisService);
  cache.onModuleInit();
  return { cache, write: (tenantId: string) => listener(tenantId), client };
};

const slot = (startAt: string) => ({ startAt, endAt: startAt, segments: [] });
const query = { serviceIds: ["s1"], date: "2026-08-05" };

beforeEach(() => jest.useFakeTimers().setSystemTime(new Date("2026-08-05T06:00:00.000Z")));
afterEach(() => jest.useRealTimers());

const put = async (cache: AvailabilityCacheService, tenantId: string, entry: { noticeMs: number; slots: ReturnType<typeof slot>[] }) => {
  const { key } = await cache.lookup(tenantId, query);
  await cache.store(key, entry);
};

describe("AvailabilityCacheService", () => {
  it("answers a repeat of the same query from Redis", async () => {
    const { cache } = setup();
    await put(cache, "t1", { noticeMs: 0, slots: [slot("2026-08-05T09:00:00.000Z")] });

    await expect(cache.lookup("t1", query)).resolves.toMatchObject({ slots: [slot("2026-08-05T09:00:00.000Z")] });
    await expect(cache.lookup("t1", { ...query, date: "2026-08-06" })).resolves.toMatchObject({ slots: null });
    await expect(cache.lookup("t2", query)).resolves.toMatchObject({ slots: null });
  });

  it("forgets everything for a tenant the moment that tenant writes anything", async () => {
    const { cache, write } = setup();
    await put(cache, "t1", { noticeMs: 0, slots: [slot("2026-08-05T09:00:00.000Z")] });
    await put(cache, "t2", { noticeMs: 0, slots: [slot("2026-08-05T09:00:00.000Z")] });

    write("t1");
    await Promise.resolve();

    await expect(cache.lookup("t1", query)).resolves.toMatchObject({ slots: null });
    await expect(cache.lookup("t2", query)).resolves.not.toMatchObject({ slots: null });
  });

  // The race the review found: a write committing while slots are computed
  it("never files slots computed before a write under the version after it", async () => {
    const { cache, write } = setup();
    const { key } = await cache.lookup("t1", query); // reader starts: key fixed at version 0
    write("t1"); // a booking commits mid-computation → version 1
    await Promise.resolve();
    await cache.store(key, { noticeMs: 0, slots: [slot("2026-08-05T09:00:00.000Z")] }); // stale result stored

    // …under the old version, which nobody reads any more
    await expect(cache.lookup("t1", query)).resolves.toMatchObject({ slots: null });
  });

  it("drops cached times the clock (and the notice) has since passed", async () => {
    const { cache } = setup();
    await put(cache, "t1", {
      noticeMs: 60 * 60_000,
      slots: [slot("2026-08-05T06:30:00.000Z"), slot("2026-08-05T07:00:00.000Z")],
    });

    await expect(cache.lookup("t1", query)).resolves.toMatchObject({ slots: [slot("2026-08-05T07:00:00.000Z")] });
  });

  it("misses quietly when Redis is down — and then stores nothing", async () => {
    const { cache, client } = setup();
    client.get.mockRejectedValue(new Error("down"));

    const result = await cache.lookup("t1", query);
    await cache.store(result.key, { noticeMs: 0, slots: [] });

    expect(result).toEqual({ key: null, slots: null });
    expect(client.set).not.toHaveBeenCalled();
  });
});
