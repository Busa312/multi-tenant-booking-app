import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiQuery, ApiTags } from "@nestjs/swagger";
import type { CmsDashboardQuery, DashboardSummary } from "@booking/shared-types";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { RolesGuard } from "../auth/guards/roles.guard.js";
import { DashboardSummaryDto } from "../common/dto.js";
import { DashboardService } from "./dashboard.service.js";

@ApiTags("cms-dashboard")
@ApiBearerAuth()
@Controller("cms/dashboard")
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  // R370: one call for every number on the home page
  @Get()
  @ApiQuery({ name: "locationId", required: false, description: "R150: one branch; omit for all" })
  @ApiOkResponse({ type: DashboardSummaryDto })
  summary(@Query() query: CmsDashboardQuery): Promise<DashboardSummary> {
    return this.dashboard.summary(query);
  }
}
