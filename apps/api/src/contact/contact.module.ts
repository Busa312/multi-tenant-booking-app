import { Module } from "@nestjs/common";
import { NotificationModule } from "../notifications/notification.module.js";
import { ContactController } from "./contact.controller.js";
import { ContactService } from "./contact.service.js";

// R580: the marketing site's contact page; the admin page lists what arrives.
@Module({
  imports: [NotificationModule],
  controllers: [ContactController],
  providers: [ContactService],
  exports: [ContactService],
})
export class ContactModule {}
