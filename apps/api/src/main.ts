import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { ConfigService } from "@nestjs/config";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module.js";

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
  const config = app.get(ConfigService);

  app.enableCors({ origin: true, credentials: true });

  const swaggerConfig = new DocumentBuilder()
    .setTitle("Booking API")
    .setDescription(
      "Multi-tenant salon booking API. /public/* is resolved by Host header (no auth); " +
        "/cms/* requires a Bearer JWT from POST /cms/auth/login.",
    )
    .setVersion("0.1.0")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("docs", app, document);

  const port = config.get<number>("PORT", 3001);
  await app.listen(port, "0.0.0.0");
  // eslint-disable-next-line no-console
  console.log(`API listening on :${port}`);
}

bootstrap();
