import { Module } from "@nestjs/common";
import { NotificationService } from "./notification.service.js";
import { SmsLogService } from "./sms-log.service.js";

@Module({
  providers: [NotificationService, SmsLogService],
  exports: [NotificationService],
})
export class NotificationModule {}
