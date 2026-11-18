import { Module } from "@nestjs/common";
import { OnboardingController } from "./onboarding.controller.js";
import { OnboardingService } from "./onboarding.service.js";
import { OwnerSetupLinkService } from "./owner-setup-link.service.js";
import { InternalApiKeyGuard } from "../auth/guards/internal-api-key.guard.js";
import { NotificationModule } from "../notifications/notification.module.js";

@Module({
  imports: [NotificationModule],
  controllers: [OnboardingController],
  providers: [OnboardingService, OwnerSetupLinkService, InternalApiKeyGuard],
  // R430: the admin page creates salons the same way, and re-sends owners' links
  exports: [OnboardingService, OwnerSetupLinkService],
})
export class OnboardingModule {}
