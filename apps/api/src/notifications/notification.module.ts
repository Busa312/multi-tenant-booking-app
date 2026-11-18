import { Module } from "@nestjs/common";
import { MailService } from "./mail.service.js";
import { NotificationService } from "./notification.service.js";
import { SmsLogService } from "./sms-log.service.js";

@Module({
  providers: [NotificationService, SmsLogService, MailService],
  exports: [NotificationService, MailService],
})
export class NotificationModule {}
