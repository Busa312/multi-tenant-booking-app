import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { ApiBody, ApiHeader, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { OnboardTenantRequest, OnboardTenantResponse } from "@booking/shared-types";
import { OnboardingService } from "./onboarding.service.js";
import { OnboardTenantRequestDto, OnboardTenantResponseDto } from "../common/dto.js";
import { InternalApiKeyGuard } from "../auth/guards/internal-api-key.guard.js";

@ApiTags("internal-onboarding")
@ApiHeader({ name: "x-internal-api-key", required: true })
@Controller("internal/onboarding")
@UseGuards(InternalApiKeyGuard)
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  // Staff-only — creates a Tenant + its owner TenantUser in one transaction
  // (system_design.md §9). Not exposed in the CMS UI; there is no self-serve
  // tenant signup by design.
  @Post("tenants")
  @ApiBody({ type: OnboardTenantRequestDto })
  @ApiOkResponse({ type: OnboardTenantResponseDto })
  onboardTenant(@Body() body: OnboardTenantRequest): Promise<OnboardTenantResponse> {
    return this.onboardingService.onboardTenant(body);
  }
}
