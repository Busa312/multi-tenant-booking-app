import { PrismaClient } from "../generated/prisma/index.js";
import { TenantContextService } from "../src/tenant/tenant-context.service.js";
/**
 * The migration owner — bypasses RLS, so it can set up and tear down fixtures
 * across tenants. Never what's under test.
 */
export declare const ownerClient: () => PrismaClient<{
    datasourceUrl: string | undefined;
}, never, import("../generated/prisma/runtime/library.js").DefaultArgs>;
/** Runs `fn` as if inside a request for `tenantId` (what the middleware/guard would do). */
export declare function asTenant<T>(context: TenantContextService, tenantId: string, fn: () => Promise<T>): Promise<T>;
export interface TenantFixture {
    tenantId: string;
    serviceId: string;
    professionalId: string;
}
/** A bookable tenant: one 60-minute service, one professional doing it, open 09–18 every day. */
export declare function createTenant(owner: PrismaClient, label: string): Promise<TenantFixture>;
/** Removes a fixture tenant and everything under it, children first (appointment → visit is RESTRICT). */
export declare function dropTenant(owner: PrismaClient, tenantId: string): Promise<void>;
/** YYYY-MM-DD in Tbilisi, `days` from today. */
export declare const tbilisiDate: (days: number) => string;
//# sourceMappingURL=fixtures.d.ts.map