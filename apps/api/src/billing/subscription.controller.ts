import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiParam, ApiTags } from "@nestjs/swagger";
import type { FastifyRequest } from "fastify";
import type {
  CheckoutResponse,
  ConfirmPaymentResponse,
  StartCheckoutRequest,
  SubscriptionOverview,
  UpdateSubscriptionRequest,
} from "@booking/shared-types";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { RolesGuard } from "../auth/guards/roles.guard.js";
import { Roles } from "../auth/decorators/roles.decorator.js";
import {
  CheckoutResponseDto,
  ConfirmPaymentResponseDto,
  StartCardChangeRequestDto,
  StartCheckoutRequestDto,
  SubscriptionOverviewDto,
  UpdateSubscriptionRequestDto,
} from "../common/dto.js";
import { BillingService, type CheckoutLang } from "./billing.service.js";

const langOf = (value: unknown): CheckoutLang => (value === "en" || value === "ru" ? value : "ka");
// Where Flitt calls back and sends the payer, unless API_PUBLIC_URL says otherwise.
const originOf = (request: FastifyRequest): string => `${request.protocol}://${request.hostname}`;

// R470: the owner's subscription. Professionals never see it.
@ApiTags("cms-subscription")
@ApiBearerAuth()
@Controller("cms/subscription")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("owner")
export class SubscriptionController {
  constructor(private readonly billing: BillingService) {}

  @Get()
  @ApiOkResponse({ type: SubscriptionOverviewDto })
  overview(): Promise<SubscriptionOverview> {
    return this.billing.overview();
  }

  @Patch()
  @ApiBody({ type: UpdateSubscriptionRequestDto })
  @ApiOkResponse({ type: SubscriptionOverviewDto })
  update(@Body() body: UpdateSubscriptionRequest): Promise<SubscriptionOverview> {
    return this.billing.update(body);
  }

  @Post("checkout")
  @ApiBody({ type: StartCheckoutRequestDto })
  @ApiOkResponse({ type: CheckoutResponseDto })
  checkout(@Body() body: StartCheckoutRequest & { lang?: string }, @Req() request: FastifyRequest): Promise<CheckoutResponse> {
    return this.billing.startCheckout(body?.planId, originOf(request), langOf(body?.lang));
  }

  @Post("card")
  @ApiBody({ type: StartCardChangeRequestDto })
  @ApiOkResponse({ type: CheckoutResponseDto })
  changeCard(@Body() body: { lang?: string } | undefined, @Req() request: FastifyRequest): Promise<CheckoutResponse> {
    return this.billing.startCardChange(originOf(request), langOf(body?.lang));
  }

  @Post("payments/:orderId/confirm")
  @ApiParam({ name: "orderId" })
  @ApiOkResponse({ type: ConfirmPaymentResponseDto })
  confirm(@Param("orderId") orderId: string): Promise<ConfirmPaymentResponse> {
    return this.billing.confirm(orderId);
  }
}
