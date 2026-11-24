import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import webpush from "web-push";
import type { PushPayload } from "./push-templates.js";

/** A device to push to: what the browser's PushSubscription gave us. */
export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * - `sent`: the push service accepted it.
 * - `gone`: the push service says this subscription no longer exists (404/410), so forget it.
 * - `failed`: anything else; kept, and tried again next time.
 */
export type PushOutcome = "sent" | "gone" | "failed";

const PUSH_TIMEOUT_MS = 8_000;
// A booking alert that waited half a day on a phone that was off is no longer news.
const PUSH_TTL_SECONDS = 12 * 60 * 60;

/** Just the host, for logs: the rest of an endpoint identifies one device. */
function endpointHost(endpoint: string): string {
  try {
    return new URL(endpoint).host;
  } catch {
    return "invalid endpoint";
  }
}

/**
 * R620: Web Push to CMS devices, signed with the platform's VAPID keys
 * (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`). Without all
 * three, push is off: `publicKey` is null, the CMS hides the switch, and
 * nothing is sent. Never throws: every send ends in an outcome.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly vapid: { subject: string; publicKey: string; privateKey: string } | null;

  constructor(private readonly config: ConfigService) {
    const publicKey = this.config.get<string>("VAPID_PUBLIC_KEY")?.trim();
    const privateKey = this.config.get<string>("VAPID_PRIVATE_KEY")?.trim();
    const subject = this.config.get<string>("VAPID_SUBJECT")?.trim();
    this.vapid = publicKey && privateKey && subject ? { subject, publicKey, privateKey } : null;
  }

  /** The key browsers subscribe with; null when push isn't configured. */
  get publicKey(): string | null {
    return this.vapid?.publicKey ?? null;
  }

  async send(target: PushTarget, payload: PushPayload): Promise<PushOutcome> {
    const vapid = this.vapid;
    if (!vapid) return "failed";

    try {
      await webpush.sendNotification(
        { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
        JSON.stringify(payload),
        { vapidDetails: vapid, TTL: PUSH_TTL_SECONDS, urgency: "high", timeout: PUSH_TIMEOUT_MS },
      );
      return "sent";
    } catch (err) {
      const status = err instanceof webpush.WebPushError ? err.statusCode : undefined;
      if (status === 404 || status === 410) return "gone";
      const reason = status !== undefined ? `HTTP ${status}` : err instanceof Error ? err.message : String(err);
      this.logger.warn(`push to ${endpointHost(target.endpoint)} failed: ${reason}`);
      return "failed";
    }
  }
}
