import { Injectable } from "@nestjs/common";
import { AsyncLocalStorage } from "node:async_hooks";
import type { TenantUserRole } from "@booking/shared-types";

export interface TenantContext {
  tenantId?: string;
  role?: TenantUserRole;
  professionalId?: string;
}

/**
 * Request-scoped tenant identity, backed by AsyncLocalStorage rather than Nest's
 * REQUEST-scoped DI (which would force every consumer down the chain into
 * request scope too).
 *
 * RequestContextMiddleware opens exactly one `als.run({}, next)` per request,
 * globally, before anything else runs — everything downstream (HostTenantMiddleware
 * for public routes, JwtAuthGuard for CMS routes) just mutates fields on that
 * *same* store object via `update()`. Guards in Nest execute through an
 * internal RxJS pipeline, and re-entering AsyncLocalStorage mid-pipeline via
 * `enterWith` was observed to silently not propagate into the eventual
 * controller call — mutating an already-open store sidesteps that entirely.
 *
 * This is the *only* place tenant_id enters the request pipeline; everything
 * downstream (PrismaService.forTenant) reads it from here rather than being
 * passed tenant_id explicitly, so it's impossible to "forget" to scope a query.
 */
@Injectable()
export class TenantContextService {
  private readonly als = new AsyncLocalStorage<TenantContext>();

  runWithNewContext(next: () => void): void {
    this.als.run({}, next);
  }

  update(patch: TenantContext): void {
    Object.assign(this.store, patch);
  }

  get current(): Required<Pick<TenantContext, "tenantId">> & TenantContext {
    const { tenantId } = this.store;
    if (!tenantId) {
      throw new Error(
        "TenantContextService.current read before tenant_id was resolved. " +
          "Every route must go through HostTenantMiddleware or JwtAuthGuard.",
      );
    }
    return this.store as Required<Pick<TenantContext, "tenantId">> & TenantContext;
  }

  get currentOrNull(): (Required<Pick<TenantContext, "tenantId">> & TenantContext) | null {
    const store = this.als.getStore();
    return store?.tenantId ? (store as Required<Pick<TenantContext, "tenantId">> & TenantContext) : null;
  }

  private get store(): TenantContext {
    const store = this.als.getStore();
    if (!store) {
      throw new Error(
        "TenantContextService accessed outside of a request. " +
          "RequestContextMiddleware must be applied to every route (see AppModule.configure).",
      );
    }
    return store;
  }
}
