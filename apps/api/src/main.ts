// Must stay the first import: Sentry initialises before what it instruments.
import "./instrument.js";
import "reflect-metadata";
import { HttpAdapterHost, NestFactory } from "@nestjs/core";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { ConfigService } from "@nestjs/config";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "@fastify/helmet";
import cookie from "@fastify/cookie";
import { AppModule } from "./app.module.js";
import { SentryExceptionFilter } from "./observability/sentry-exception.filter.js";
import { parseTrustProxy } from "./rate-limit/client-address.js";
import { TenantContextService } from "./tenant/tenant-context.service.js";

async function bootstrap() {
  // R330: believe X-Forwarded-For only from the platform's own proxy — a hop
  // count or its addresses (TRUST_PROXY), never blanket `true`, which would
  // let any client pick the address its rate limits are counted against.
  // Visitors of the public site are named separately (rate-limit/client-address.ts).
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ trustProxy: parseTrustProxy(process.env.TRUST_PROXY) }),
  );
  const config = app.get(ConfigService);
  const production = config.get<string>("NODE_ENV") === "production";

  // Security headers. No CSP: this serves JSON (and Swagger's inline UI in
  // development), not pages a browser renders from untrusted input.
  await app.register(helmet, { contentSecurityPolicy: false });

  // R320: the CMS session cookie (see auth/session-cookie.ts).
  await app.register(cookie);

  // Only the CMS calls the API from a browser; the public site calls it from
  // its server, where CORS doesn't apply. Credentials: the session cookie.
  const origins = (config.get<string>("CORS_ORIGINS") ?? config.get<string>("CMS_URL") ?? "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({ origin: origins, credentials: true });

  app.useGlobalFilters(
    new SentryExceptionFilter(app.get(HttpAdapterHost).httpAdapter, app.get(TenantContextService)),
  );

  // The API's whole surface, mapped — useful in development, a gift to an
  // attacker in production unless deliberately switched on.
  if (!production || config.get<string>("ENABLE_SWAGGER") === "true") {
    const swaggerConfig = new DocumentBuilder()
      .setTitle("Booking API")
      .setDescription(
        "Multi-tenant salon booking API. /public/* is resolved by Host header (no auth); " +
          "/cms/* requires a Bearer JWT from POST /cms/auth/login.",
      )
      .setVersion("0.1.0")
      .addCookieAuth("booking_session")
      .build();
    SwaggerModule.setup("docs", app, SwaggerModule.createDocument(app, swaggerConfig));
  }

  app.enableShutdownHooks();
  const port = config.get<number>("PORT", 3001);
  await app.listen(port, "0.0.0.0");
  // eslint-disable-next-line no-console
  console.log(`API listening on :${port}`);
}

void bootstrap();
