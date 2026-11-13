import { Body, Controller, Get, HttpCode, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiConflictResponse, ApiNoContentResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { BlockPhoneRequest, BlockedPhone, JwtClaims, UnblockPhoneRequest } from "@booking/shared-types";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import { Roles } from "../auth/decorators/roles.decorator.js";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { RolesGuard } from "../auth/guards/roles.guard.js";
import { BlockedPhoneService } from "../booking/blocked-phone.service.js";
import { BlockPhoneRequestDto, BlockedPhoneDto, UnblockPhoneRequestDto } from "../common/dto.js";

// R380: the owner's list of numbers that can't book online at this salon
@ApiTags("cms-blocked-phones")
@ApiBearerAuth()
@Controller("cms/blocked-phones")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("owner")
export class BlockedPhonesController {
  constructor(private readonly blockedPhones: BlockedPhoneService) {}

  @Get()
  @ApiOkResponse({ type: [BlockedPhoneDto] })
  list(): Promise<BlockedPhone[]> {
    return this.blockedPhones.list();
  }

  @Post()
  @ApiBody({ type: BlockPhoneRequestDto })
  @ApiOkResponse({ type: BlockedPhoneDto })
  @ApiConflictResponse({ description: "This salon has already blocked the number" })
  block(@Body() body: BlockPhoneRequest, @CurrentUser() user: JwtClaims): Promise<BlockedPhone> {
    return this.blockedPhones.block(body, user.sub);
  }

  // By number, in a body: a phone number doesn't belong in a URL, and the
  // booking rows that offer "unblock" know the number, not a block's id.
  @Post("unblock")
  @HttpCode(204)
  @ApiBody({ type: UnblockPhoneRequestDto })
  @ApiNoContentResponse()
  unblock(@Body() body: UnblockPhoneRequest): Promise<void> {
    return this.blockedPhones.unblock(typeof body.phoneNumber === "string" ? body.phoneNumber : "");
  }
}
