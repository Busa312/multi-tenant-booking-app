import { Module } from "@nestjs/common";
import { BookingAlertsService } from "./booking-alerts.service.js";
import { MailService } from "./mail.service.js";
import { NotificationService } from "./notification.service.js";
import { PushService } from "./push.service.js";
import { PushSubscriptionService } from "./push-subscription.service.js";
import { SmsLogService } from "./sms-log.service.js";

@Module({
  providers: [NotificationService, SmsLogService, MailService, PushService, PushSubscriptionService, BookingAlertsService],
  exports: [NotificationService, MailService, PushService, PushSubscriptionService, BookingAlertsService],
})
export class NotificationModule {}
