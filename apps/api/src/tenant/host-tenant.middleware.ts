import { Injectable, NestMiddleware } from "@nestjs/common";
import type { FastifyRequest, FastifyReply } from "fastify";
import { TenantContextService } from "./tenant-context.service.js";
import { TenantResolverService } from "./tenant-resolver.service.js";

export function protocolFor(headers: Record<string, unknown>, host: string): "http" | "https" {
  const forwarded = String(headers["x-forwarded-proto"] ?? "")
    .split(",")[0]
    ?.trim()
    .toLowerCase();
  if (forwarded === "http" || forwarded === "https") {
    return forwarded;
  }

  const hostname = host.split(":")[0]?.toLowerCase() ?? "";
  const isLoopback =
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname === "::1";
  return isLoopback ? "http" : "https";
}

@Injectable()
export class HostTenantMiddleware implements NestMiddleware {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly tenantResolver: TenantResolverService,
  ) {}

  async use(req: FastifyRequest["raw"], _res: FastifyReply["raw"], next: (error?: unknown) => void) {
    try {
      const host = (req.headers["x-forwarded-host"] as string | undefined) ?? req.headers.host;
      if (!host) {
        throw new Error("Request missing Host header");
      }
      const tenantId = await this.tenantResolver.resolveTenantIdByHost(host);

      this.tenantContext.update({ tenantId, host, protocol: protocolFor(req.headers, host) });
      next();
    } catch (err) {
      next(err);
    }
  }
}
