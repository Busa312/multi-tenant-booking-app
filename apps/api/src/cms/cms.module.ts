import { Module } from "@nestjs/common";
import { TenantController } from "./tenant.controller.js";
import { ServicesController } from "./services.controller.js";
import { ProfessionalsController } from "./professionals.controller.js";
import { BusinessHoursController } from "./business-hours.controller.js";
import { TimeOffController } from "./time-off.controller.js";
import { AppointmentsController } from "./appointments.controller.js";

@Module({
  controllers: [
    TenantController,
    ServicesController,
    ProfessionalsController,
    BusinessHoursController,
    TimeOffController,
    AppointmentsController,
  ],
})
export class CmsModule {}
