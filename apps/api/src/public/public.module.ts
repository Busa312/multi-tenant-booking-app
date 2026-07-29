import { Module } from "@nestjs/common";
import { BookingModule } from "../booking/booking.module.js";
import { PublicController } from "./public.controller.js";

@Module({
  imports: [BookingModule],
  controllers: [PublicController],
})
export class PublicModule {}
