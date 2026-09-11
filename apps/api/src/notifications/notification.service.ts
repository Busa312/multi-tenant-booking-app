import { Injectable, Logger } from "@nestjs/common";

export interface MagicLinkMessage {
  email: string;
  userName: string;
  manageUrl: string;
  startAt: Date;

  locationName: string | null;
}

export interface OtpMessage {
  phoneNumber: string;
  code: string;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  async sendMagicLink(message: MagicLinkMessage): Promise<void> {
    this.logger.log(
      `[stub] magic link for ${message.userName} <${message.email}> ` +
        `(${message.startAt.toISOString()}${message.locationName ? `, ${message.locationName}` : ""}) ` +
        `— no mail provider configured, link returned in the API response instead`,
    );
  }

  /**
   * The booking OTP. **Mocked**: no SMS provider is wired in, so the code comes
   * back on the start response instead (see VerificationService).
   *
   * The code is deliberately not logged. It is a credential for the duration of
   * its five minutes, and application logs are the wrong place to leave one —
   * the same reason the magic link's token isn't logged either.
   *
   * Returns whether it was actually delivered, which is what tells the caller
   * whether it still has to hand the code back in the response. Wiring a real
   * provider means sending here and returning true; nothing else changes.
   */
  async sendOtp(message: OtpMessage): Promise<boolean> {
    this.logger.log(
      `[stub] verification code for ${message.phoneNumber} — no SMS provider configured, ` +
        `code returned in the API response instead`,
    );
    return false;
  }
}
