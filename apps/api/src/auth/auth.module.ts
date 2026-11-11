import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { AuthService } from "./auth.service.js";
import { AuthController } from "./auth.controller.js";
import { JwtStrategy } from "./strategies/jwt.strategy.js";
import { JwtAuthGuard } from "./guards/jwt-auth.guard.js";
import { RolesGuard } from "./guards/roles.guard.js";
import { APP_GUARD } from "@nestjs/core";
import { CsrfGuard } from "./guards/csrf.guard.js";
import { NotificationModule } from "../notifications/notification.module.js";

@Module({
  imports: [
    PassportModule,
    NotificationModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>("JWT_SECRET"),
        signOptions: { expiresIn: config.get<string>("JWT_EXPIRES_IN", "8h") },
      }),
    }),
  ],
  controllers: [AuthController],
  // CsrfGuard is global (R320) — it only acts on state-changing /cms requests.
  providers: [AuthService, JwtStrategy, JwtAuthGuard, RolesGuard, { provide: APP_GUARD, useClass: CsrfGuard }],
  exports: [JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
