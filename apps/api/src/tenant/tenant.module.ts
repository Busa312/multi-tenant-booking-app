import { Global, Module } from "@nestjs/common";
import { TenantContextService } from "./tenant-context.service.js";
import { TenantResolverService } from "./tenant-resolver.service.js";
import { HostTenantMiddleware } from "./host-tenant.middleware.js";
import { RequestContextMiddleware } from "./request-context.middleware.js";

@Global()
@Module({
  providers: [TenantContextService, TenantResolverService, HostTenantMiddleware, RequestContextMiddleware],
  exports: [TenantContextService, TenantResolverService, HostTenantMiddleware, RequestContextMiddleware],
})
export class TenantModule {}
