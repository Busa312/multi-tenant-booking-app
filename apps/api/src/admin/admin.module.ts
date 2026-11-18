import { Module } from "@nestjs/common";
import { OnboardingModule } from "../internal/onboarding.module.js";
import { BillingModule } from "../billing/billing.module.js";
import { AdminAuthService } from "./admin-auth.service.js";
import { AdminSessionGuard } from "./admin-session.guard.js";
import { AdminApiController } from "./admin-api.controller.js";
import { AdminPageController } from "./admin-page.controller.js";

// R430: the platform admin page and its API
@Module({
  imports: [OnboardingModule, BillingModule],
  controllers: [AdminPageController, AdminApiController],
  providers: [AdminAuthService, AdminSessionGuard],
})
export class AdminModule {}
