import { Module } from "@nestjs/common";
import { OnboardingController } from "./onboarding.controller.js";
import { OnboardingService } from "./onboarding.service.js";
import { InternalApiKeyGuard } from "../auth/guards/internal-api-key.guard.js";

@Module({
  controllers: [OnboardingController],
  providers: [OnboardingService, InternalApiKeyGuard],
  // R430: the admin page creates salons the same way
  exports: [OnboardingService],
})
export class OnboardingModule {}
