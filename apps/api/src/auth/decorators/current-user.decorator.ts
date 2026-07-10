import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import type { JwtClaims } from "@booking/shared-types";

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): JwtClaims => {
  const request = ctx.switchToHttp().getRequest<FastifyRequest & { user: JwtClaims }>();
  return request.user;
});
