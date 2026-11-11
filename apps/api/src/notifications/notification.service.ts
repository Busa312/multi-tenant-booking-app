import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export interface MagicLinkMessage {
  /** R270: the verified phone the booking was made with. */
  phoneNumber: string;
  userName: string;
  manageUrl: string;
  startAt: Date;

  locationName: string | null;
}

export interface OtpMessage {
  phoneNumber: string;
  code: string;
}

export interface PasswordResetMessage {
  email: string;
  resetUrl: string;
}

/**
 * Outbound messages. **All mocked**: no SMS or mail provider is wired in yet.
 * Each method returns whether it actually delivered, which is what tells the
 * caller whether it has to fall back (show the link on screen, hand the dev
 * code back). Wiring a provider means sending in here and returning true.
 *
 * Credentials — links, codes — are never written to logs: for as long as they
 * live, a log line holding one is as good as the credential. The one
 * exception is the password-reset link outside production, where there is no
 * other way to reach it during development (see sendPasswordReset).
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * Whether texts actually reach phones. Lost-link recovery depends on it:
   * re-sending replaces the customer's link, so with no way to deliver the
   * new one it would only destroy the copy they have.
   */
  canDeliverSms(): boolean {
    return false;
  }

  /** R270: the manage link, by SMS to the phone the booking was verified with. */
  async sendMagicLink(message: MagicLinkMessage): Promise<boolean> {
    this.logger.log(
      `[stub] manage link for ${message.userName} (${message.startAt.toISOString()}` +
        `${message.locationName ? `, ${message.locationName}` : ""}) — no SMS provider configured`,
    );
    return false;
  }

  /**
   * The booking OTP. The code comes back on the start response instead while
   * this returns false (see VerificationService).
   */
  async sendOtp(message: OtpMessage): Promise<boolean> {
    this.logger.log(`[stub] verification code for ${message.phoneNumber} — no SMS provider configured`);
    return false;
  }

  /**
   * R310. Unlike the OTP, the reset link can never come back on the response:
   * the request is unauthenticated, so that would let anyone reset anyone's
   * password. Until a mail provider is wired in, the link is logged — in
   * development only — so the flow can be exercised; in production it goes
   * nowhere, and the owner has to be reset by hand.
   */
  async sendPasswordReset(message: PasswordResetMessage): Promise<boolean> {
    if (this.config.get<string>("NODE_ENV") !== "production") {
      this.logger.warn(`[stub, development only] password reset link for ${message.email}: ${message.resetUrl}`);
    } else {
      this.logger.error(`password reset requested for ${message.email}, but no mail provider is configured`);
    }
    return false;
  }
}
