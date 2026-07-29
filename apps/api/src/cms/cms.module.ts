import { Module } from "@nestjs/common";
import { BookingModule } from "../booking/booking.module.js";
import { TenantController } from "./tenant.controller.js";
import { ServicesController } from "./services.controller.js";
import { ProfessionalsController } from "./professionals.controller.js";
import { BusinessHoursController } from "./business-hours.controller.js";
import { TimeOffController } from "./time-off.controller.js";
import { AppointmentsController } from "./appointments.controller.js";
import { RevalidationService } from "./revalidation.service.js";

@Module({
  imports: [BookingModule],
  controllers: [
    TenantController,
    ServicesController,
    ProfessionalsController,
    BusinessHoursController,
    TimeOffController,
    AppointmentsController,
  ],
  providers: [RevalidationService],
})
export class CmsModule {}
