import { Body, Controller, Get, Headers, HttpCode, Post, Put, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiConflictResponse, ApiNoContentResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type {
  DeletePushSubscriptionRequest,
  JwtClaims,
  PushConfigResponse,
  SavePushSubscriptionRequest,
} from "@booking/shared-types";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import {
  DeletePushSubscriptionRequestDto,
  PushConfigResponseDto,
  PushEndpointTakenResponseDto,
  SavePushSubscriptionRequestDto,
} from "../common/dto.js";
import { PushService } from "../notifications/push.service.js";
import { PushSubscriptionService } from "../notifications/push-subscription.service.js";

// R620: switching push notifications on and off for the device in use. Any
// role: owners and professionals each get their own (BookingAlertsService).
@ApiTags("cms-push")
@ApiBearerAuth()
@Controller("cms/push")
@UseGuards(JwtAuthGuard)
export class PushSubscriptionsController {
  constructor(
    private readonly push: PushService,
    private readonly subscriptions: PushSubscriptionService,
  ) {}

  @Get("config")
  @ApiOkResponse({ type: PushConfigResponseDto })
  config(): PushConfigResponse {
    return { publicKey: this.push.publicKey };
  }

  @Put("subscriptions")
  @HttpCode(204)
  @ApiBody({ type: SavePushSubscriptionRequestDto })
  @ApiNoContentResponse()
  @ApiConflictResponse({ type: PushEndpointTakenResponseDto, description: "Registered under another salon's login" })
  save(
    @Body() body: SavePushSubscriptionRequest,
    @CurrentUser() user: JwtClaims,
    @Headers("user-agent") userAgent: string | undefined,
  ): Promise<void> {
    return this.subscriptions.save(user, body, userAgent);
  }

  // By endpoint, in a body: it identifies one device and doesn't belong in a URL.
  @Post("subscriptions/remove")
  @HttpCode(204)
  @ApiBody({ type: DeletePushSubscriptionRequestDto })
  @ApiNoContentResponse()
  remove(@Body() body: DeletePushSubscriptionRequest, @CurrentUser() user: JwtClaims): Promise<void> {
    return this.subscriptions.remove(user, body?.endpoint);
  }
}
