import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { AuthService } from "./auth.service.js";
import { AuthController } from "./auth.controller.js";
import { JwtStrategy } from "./strategies/jwt.strategy.js";
import { JwtAuthGuard } from "./guards/jwt-auth.guard.js";
import { RolesGuard } from "./guards/roles.guard.js";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { CsrfGuard } from "./guards/csrf.guard.js";
import { NotificationModule } from "../notifications/notification.module.js";
import { SESSION_IDLE_TIMEOUT_SECONDS } from "./session-lifetime.js";
import { SessionRenewalInterceptor } from "./session-renewal.interceptor.js";

@Module({
  imports: [
    PassportModule,
    NotificationModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>("JWT_SECRET"),
        // R320: 7 days, renewed while in use (session-lifetime.ts)
        signOptions: { expiresIn: SESSION_IDLE_TIMEOUT_SECONDS },
      }),
    }),
  ],
  controllers: [AuthController],
  // Both global (R320): CsrfGuard only acts on state-changing /cms requests,
  // SessionRenewalInterceptor only on requests JwtAuthGuard let through.
  providers: [
    AuthService,
    JwtStrategy,
    JwtAuthGuard,
    RolesGuard,
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_INTERCEPTOR, useClass: SessionRenewalInterceptor },
  ],
  exports: [JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
