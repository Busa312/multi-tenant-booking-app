import { Injectable, NestMiddleware } from "@nestjs/common";
import type { FastifyRequest, FastifyReply } from "fastify";
import { TenantContextService } from "./tenant-context.service.js";

/**
 * Applied to every route (see AppModule.configure) and registered first, so
 * it's the outermost thing wrapping a request. Opens the one AsyncLocalStorage
 * frame the request will use; HostTenantMiddleware/JwtAuthGuard only ever
 * mutate fields on it afterwards — see TenantContextService for why.
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(private readonly tenantContext: TenantContextService) {}

  use(_req: FastifyRequest["raw"], _res: FastifyReply["raw"], next: (error?: unknown) => void) {
    this.tenantContext.runWithNewContext(next);
  }
}
