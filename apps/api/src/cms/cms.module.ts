import { Module } from "@nestjs/common";
import { BookingModule } from "../booking/booking.module.js";
import { TenantController } from "./tenant.controller.js";
import { ServicesController } from "./services.controller.js";
import { LocationsController } from "./locations.controller.js";
import { ProfessionalsController } from "./professionals.controller.js";
import { BusinessHoursController } from "./business-hours.controller.js";
import { TimeOffController } from "./time-off.controller.js";
import { AppointmentsController } from "./appointments.controller.js";
import { DashboardController } from "./dashboard.controller.js";
import { BlockedPhonesController } from "./blocked-phones.controller.js";
import { OnboardingController } from "./onboarding.controller.js";
import { OnboardingService } from "./onboarding.service.js";
import { RevalidationService } from "./revalidation.service.js";
import { DashboardService } from "./dashboard.service.js";

@Module({
  imports: [BookingModule],
  controllers: [
    TenantController,
    ServicesController,
    LocationsController,
    ProfessionalsController,
    BusinessHoursController,
    TimeOffController,
    AppointmentsController,
    DashboardController,
    BlockedPhonesController,
    OnboardingController,
  ],
  providers: [RevalidationService, DashboardService, OnboardingService],
})
export class CmsModule {}
