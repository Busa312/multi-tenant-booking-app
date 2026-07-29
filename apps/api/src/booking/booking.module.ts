import { Module } from "@nestjs/common";
import { AvailabilityService } from "./availability.service.js";
import { BookingService } from "./booking.service.js";

/**
 * Booking domain logic with no HTTP surface of its own — imported by both
 * CmsModule and PublicModule so the two flows share one availability
 * computation and one set of write rules (see AvailabilityService's comment).
 */
@Module({
  providers: [AvailabilityService, BookingService],
  exports: [AvailabilityService, BookingService],
})
export class BookingModule {}
