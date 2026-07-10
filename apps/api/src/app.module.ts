import { MiddlewareConsumer, Module, NestModule, RequestMethod } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./prisma/prisma.module.js";
import { RedisModule } from "./redis/redis.module.js";
import { TenantModule } from "./tenant/tenant.module.js";
import { HostTenantMiddleware } from "./tenant/host-tenant.middleware.js";
import { RequestContextMiddleware } from "./tenant/request-context.middleware.js";
import { AuthModule } from "./auth/auth.module.js";
import { PublicModule } from "./public/public.module.js";
import { CmsModule } from "./cms/cms.module.js";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    RedisModule,
    TenantModule,
    AuthModule,
    PublicModule,
    CmsModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Opens the AsyncLocalStorage frame every request uses — must run before
    // anything that calls TenantContextService.update (see its class comment).
    consumer.apply(RequestContextMiddleware).forRoutes({ path: "*", method: RequestMethod.ALL });

    // /cms/* (minus login) gets tenant identity from JwtAuthGuard instead.
    consumer
      .apply(HostTenantMiddleware)
      .forRoutes({ path: "public/*", method: RequestMethod.ALL }, { path: "cms/auth/login", method: RequestMethod.POST });
  }
}
