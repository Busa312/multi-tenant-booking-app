import { ArgumentsHost, Catch, HttpException } from "@nestjs/common";
import { BaseExceptionFilter } from "@nestjs/core";
import type { FastifyRequest } from "fastify";
import * as Sentry from "@sentry/node";
import { TenantContextService } from "../tenant/tenant-context.service.js";

/**
 * Reports what's actually broken — 5xx and anything that isn't an HttpException
 * — and lets Nest answer as it always did. 4xx are the API working as designed
 * (a taken slot, a wrong code) and would only bury real errors.
 */
@Catch()
export class SentryExceptionFilter extends BaseExceptionFilter {
  constructor(
    applicationRef: ConstructorParameters<typeof BaseExceptionFilter>[0],
    private readonly tenantContext: TenantContextService,
  ) {
    super(applicationRef);
  }

  override catch(exception: unknown, host: ArgumentsHost): void {
    const status = exception instanceof HttpException ? exception.getStatus() : 500;
    if (status >= 500) {
      const request = host.switchToHttp().getRequest<FastifyRequest | undefined>();
      Sentry.withScope((scope) => {
        let tenantId: string | undefined;
        try {
          tenantId = this.tenantContext.currentOrNull?.tenantId;
        } catch {
          // Outside a request context — nothing to tag.
        }
        if (tenantId) scope.setTag("tenant_id", tenantId);
        if (request) scope.setTag("route", `${request.method} ${request.routeOptions?.url ?? request.url}`);
        Sentry.captureException(exception);
      });
    }
    super.catch(exception, host);
  }
}
