import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { OfferedPlansResponse } from "@booking/shared-types";
import { OfferedPlansResponseDto } from "../common/dto.js";
import { RateLimit } from "../rate-limit/rate-limit.decorator.js";
import { PlanCatalog } from "./plan-catalog.service.js";

/**
 * R560: the plans an owner can choose now, for the marketing site's build.
 * Platform-wide and public — the same prices the site prints — so no Host,
 * tenant or login is involved.
 */
@ApiTags("plans")
@Controller("plans")
export class PlansController {
  constructor(private readonly plans: PlanCatalog) {}

  @Get()
  @RateLimit({ name: "plans", max: 60, windowSeconds: 60 }) // R330
  @ApiOkResponse({ type: OfferedPlansResponseDto })
  async offered(): Promise<OfferedPlansResponse> {
    return { plans: await this.plans.offered() };
  }
}
