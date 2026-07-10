import { Injectable, NestMiddleware } from "@nestjs/common";
import type { FastifyRequest, FastifyReply } from "fastify";
import { TenantContextService } from "./tenant-context.service.js";
import { TenantResolverService } from "./tenant-resolver.service.js";

/** Applied to /public/* routes only — CMS routes get tenant identity from the JWT instead (see JwtAuthGuard). */
@Injectable()
export class HostTenantMiddleware implements NestMiddleware {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly tenantResolver: TenantResolverService,
  ) {}

  async use(req: FastifyRequest["raw"], _res: FastifyReply["raw"], next: (error?: unknown) => void) {
    try {
      // apps/public-site's server-side fetches forward the browser's original
      // hostname as x-forwarded-host, since their own outgoing request's Host
      // header would otherwise be the API's, not the tenant's (see api-client's
      // ApiClientOptions.getExtraHeaders). Direct browser requests use `host`.
      const host = (req.headers["x-forwarded-host"] as string | undefined) ?? req.headers.host;
      if (!host) {
        throw new Error("Request missing Host header");
      }
      const tenantId = await this.tenantResolver.resolveTenantIdByHost(host);
      this.tenantContext.update({ tenantId });
      next();
    } catch (err) {
      next(err);
    }
  }
}
