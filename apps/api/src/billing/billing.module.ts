import { Module } from "@nestjs/common";
import { BillingScheduler } from "./billing-scheduler.service.js";
import { BillingService } from "./billing.service.js";
import { FlittClient } from "./flitt.client.js";
import { FlittController } from "./flitt.controller.js";
import { SubscriptionController } from "./subscription.controller.js";
import { RevalidationService } from "../cms/revalidation.service.js";

// R470–R490: salons paying the platform (system_design.md §12b).
@Module({
  controllers: [SubscriptionController, FlittController],
  providers: [FlittClient, BillingService, BillingScheduler, RevalidationService],
  exports: [BillingService],
})
export class BillingModule {}
