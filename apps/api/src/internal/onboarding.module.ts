import { Module } from "@nestjs/common";
import { OnboardingController } from "./onboarding.controller.js";
import { OnboardingService } from "./onboarding.service.js";
import { InternalApiKeyGuard } from "../auth/guards/internal-api-key.guard.js";

@Module({
  controllers: [OnboardingController],
  providers: [OnboardingService, InternalApiKeyGuard],
})
export class OnboardingModule {}
