import { Module } from "@nestjs/common";
import { AvailabilityService } from "./availability.service.js";
import { BookingService } from "./booking.service.js";
import { VisitService } from "./visit.service.js";
import { AvailabilityCacheService } from "./availability-cache.service.js";
import { BlockedPhoneService } from "./blocked-phone.service.js";

/**
 * Booking domain logic with no HTTP surface of its own — imported by both
 * CmsModule and PublicModule so the two flows share one availability
 * computation and one set of write rules (see AvailabilityService's comment).
 */
@Module({
  providers: [AvailabilityService, AvailabilityCacheService, BookingService, VisitService, BlockedPhoneService],
  exports: [AvailabilityService, BookingService, VisitService, BlockedPhoneService],
})
export class BookingModule {}
