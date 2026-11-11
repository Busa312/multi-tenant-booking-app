import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ConfigService } from "@nestjs/config";
import type { FastifyRequest } from "fastify";
import { Strategy } from "passport-jwt";
import type { JwtClaims } from "@booking/shared-types";
import { SESSION_COOKIE } from "../session-cookie.js";

/**
 * R320: the token is read from the httpOnly session cookie only. No
 * Authorization header: a token a script could put in a header is a token a
 * script could have stolen.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: (request: FastifyRequest) => request.cookies?.[SESSION_COOKIE] ?? null,
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>("JWT_SECRET"),
    });
  }

  // Return value becomes `request.user`.
  validate(payload: JwtClaims): JwtClaims {
    return payload;
  }
}
