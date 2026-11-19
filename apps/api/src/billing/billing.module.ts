import { Module } from "@nestjs/common";
import { BillingScheduler } from "./billing-scheduler.service.js";
import { BillingService } from "./billing.service.js";
import { FlittClient } from "./flitt.client.js";
import { FlittController } from "./flitt.controller.js";
import { MarketingRebuild } from "./marketing-rebuild.service.js";
import { PlanCatalog } from "./plan-catalog.service.js";
import { PlansController } from "./plans.controller.js";
import { SubscriptionController } from "./subscription.controller.js";
import { RevalidationService } from "../cms/revalidation.service.js";

// R470–R490: salons paying the platform (system_design.md §12b).
@Module({
  controllers: [SubscriptionController, FlittController, PlansController],
  providers: [FlittClient, BillingService, BillingScheduler, RevalidationService, PlanCatalog, MarketingRebuild],
  exports: [BillingService, PlanCatalog],
})
export class BillingModule {}
