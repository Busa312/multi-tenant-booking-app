import { Module } from "@nestjs/common";
import { BookingModule } from "../booking/booking.module.js";
import { NotificationModule } from "../notifications/notification.module.js";
import { BillingModule } from "../billing/billing.module.js";
import { PublicController } from "./public.controller.js";
import { VerificationService } from "./verification.service.js";

@Module({
  imports: [BookingModule, NotificationModule, BillingModule],
  controllers: [PublicController],
  providers: [VerificationService],
})
export class PublicModule {}
