import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { maskSmsNumber, toSmsNumber } from "./sms-number.js";
import { smsParts } from "./sms-parts.js";
import { SmsLogService, type SmsKind } from "./sms-log.service.js";

export interface MagicLinkMessage {
  /** R270: the verified phone the booking was made with. */
  phoneNumber: string;
  userName: string;
  manageUrl: string;
  startAt: Date;

  locationName: string | null;
}

/**
 * R270/R500: the manage-link text. Short, plain Latin wording so it stays one
 * SMS part for any salon address up to 80 characters; also used for a resent
 * link, so it doesn't say "confirmed".
 */
export const magicLinkText = (manageUrl: string): string => `Manage your booking: ${manageUrl}`;

export interface OtpMessage {
  phoneNumber: string;
  code: string;
}

export interface PasswordResetMessage {
  email: string;
  resetUrl: string;
}

const UBILL_DEFAULT_URL = "https://api.ubill.dev";
const UBILL_TIMEOUT_MS = 8_000;

/** uBill's answer to a send. statusID 0 = accepted; anything else is a refusal. */
interface UbillSendResponse {
  statusID?: number;
  smsID?: string;
  message?: string;
  /** OTP refusals (statusID 47): otpCooldown | otpNumberLimit. */
  reason?: string;
  /** Set when part of a batch was refused, which with one number means all of it. */
  rejectedCount?: number;
}

/**
 * Outbound messages. SMS goes through uBill (ubill.ge) once `UBILL_API_KEY`
 * and `UBILL_BRAND_ID` are set; without them it's a log-only stub, which is
 * what development runs on. Each method returns whether it actually
 * delivered, which is what tells the caller whether it has to fall back (show
 * the link on screen, hand the dev code back). Mail is still a stub.
 *
 * Texts are plain Latin (GSM-7) on purpose: one Georgian letter switches the
 * whole message to Unicode, which fits 70 characters per SMS instead of 160,
 * so the link message would be billed as two or three.
 *
 * Credentials — links, codes — are never written to logs: for as long as they
 * live, a log line holding one is as good as the credential. The one
 * exception is the password-reset link outside production, where there is no
 * other way to reach it during development (see sendPasswordReset).
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly ubill: { url: string; key: string; brandId: number } | null;

  constructor(
    private readonly config: ConfigService,
    private readonly smsLog: SmsLogService,
  ) {
    const key = this.config.get<string>("UBILL_API_KEY")?.trim();
    const brandId = Number(this.config.get<string>("UBILL_BRAND_ID"));
    this.ubill =
      key && Number.isInteger(brandId) && brandId > 0
        ? { url: this.config.get<string>("UBILL_API_URL")?.trim() || UBILL_DEFAULT_URL, key, brandId }
        : null;
  }

  /**
   * Whether texts actually reach phones. Lost-link recovery depends on it:
   * re-sending replaces the customer's link, so with no way to deliver the
   * new one it would only destroy the copy they have.
   */
  canDeliverSms(): boolean {
    return this.ubill !== null;
  }

  /** R270: the manage link, by SMS to the phone the booking was verified with. */
  async sendMagicLink(message: MagicLinkMessage): Promise<boolean> {
    if (!this.ubill) {
      this.logger.log(
        `[stub] manage link for ${message.userName} (${message.startAt.toISOString()}` +
          `${message.locationName ? `, ${message.locationName}` : ""}) — no SMS provider configured`,
      );
      return false;
    }
    return this.sendSms(message.phoneNumber, magicLinkText(message.manageUrl), {
      otp: false,
      kind: "manage_link",
    });
  }

  /**
   * The booking OTP. While no provider is configured the code comes back on
   * the start response instead (see PublicController.startVerification).
   */
  async sendOtp(message: OtpMessage): Promise<boolean> {
    if (!this.ubill) {
      this.logger.log(`[stub] verification code — no SMS provider configured`);
      return false;
    }
    return this.sendSms(message.phoneNumber, `Your booking code is ${message.code}`, { otp: true, kind: "otp" });
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

  /** One text through uBill. Never throws: a failed send is `false`, logged without the text. */
  private async sendSms(phoneNumber: string, text: string, options: { otp: boolean; kind: SmsKind }): Promise<boolean> {
    const ubill = this.ubill;
    if (!ubill) return false;

    const number = toSmsNumber(phoneNumber);
    if (!number) {
      this.logger.warn("SMS not sent: the phone number can't be dialled");
      return false;
    }

    try {
      const res = await fetch(`${ubill.url}/v1/sms/send`, {
        method: "POST",
        headers: { key: ubill.key, "Content-Type": "application/json" },
        body: JSON.stringify({ brandID: ubill.brandId, numbers: [number], text, otp: options.otp }),
        signal: AbortSignal.timeout(UBILL_TIMEOUT_MS),
      });
      const body = (await res.json().catch(() => ({}))) as UbillSendResponse;
      if (res.ok && body.statusID === 0 && !body.rejectedCount) {
        // R500: counted only once the provider has taken it
        await this.smsLog.record(options.kind, smsParts(text));
        return true;
      }
      this.logger.error(
        `SMS to ${maskSmsNumber(number)} refused: HTTP ${res.status}, statusID ${body.statusID ?? "?"}` +
          `${body.reason ? ` (${body.reason})` : ""}${body.message ? ` — ${body.message}` : ""}`,
      );
      return false;
    } catch (error) {
      this.logger.error(`SMS to ${maskSmsNumber(number)} failed: ${(error as Error).message}`);
      return false;
    }
  }
}
