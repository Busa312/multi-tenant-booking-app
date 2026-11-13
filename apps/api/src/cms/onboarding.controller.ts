import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { OnboardingStatus, UpdateOnboardingRequest } from "@booking/shared-types";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { RolesGuard } from "../auth/guards/roles.guard.js";
import { Roles } from "../auth/decorators/roles.decorator.js";
import { OnboardingStatusDto, UpdateOnboardingRequestDto } from "../common/dto.js";
import { OnboardingService } from "./onboarding.service.js";

// R420: the owner's guided setup. Professionals never see it.
@ApiTags("cms-onboarding")
@ApiBearerAuth()
@Controller("cms/onboarding")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("owner")
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  @Get()
  @ApiOkResponse({ type: OnboardingStatusDto })
  status(): Promise<OnboardingStatus> {
    return this.onboarding.status();
  }

  @Patch()
  @ApiBody({ type: UpdateOnboardingRequestDto })
  @ApiOkResponse({ type: OnboardingStatusDto })
  update(@Body() body: UpdateOnboardingRequest): Promise<OnboardingStatus> {
    return this.onboarding.update(body);
  }
}
