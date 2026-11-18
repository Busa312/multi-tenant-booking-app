import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { MailContent } from "./mail-templates.js";

const RESEND_URL = "https://api.resend.com/emails";
const RESEND_TIMEOUT_MS = 8_000;

/** What gets logged about a recipient: enough to find the account, not the whole address. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at <= 0) return "***";
  return `${email[0]}***${email.slice(at)}`;
}

export interface OutgoingMail {
  to: string;
  content: MailContent;
  /** For the logs only, e.g. "password_reset". */
  kind: string;
}

/**
 * R310/R430: email, through Resend (system_design.md §5) once `RESEND_API_KEY`
 * and `MAIL_FROM` are set. `MAIL_FROM` is a sender on a domain verified in
 * Resend, e.g. `Bukme <no-reply@bukme.website>`. Without them nothing is sent:
 * in development the log shows the email (so its link can be followed), in
 * production the log says a mail went undelivered. Never throws — a failed
 * send is `false`, and the logs never carry the email's text there, since its
 * links are secrets.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resend: { key: string; from: string } | null;

  constructor(private readonly config: ConfigService) {
    const key = this.config.get<string>("RESEND_API_KEY")?.trim();
    const from = this.config.get<string>("MAIL_FROM")?.trim();
    this.resend = key && from ? { key, from } : null;
  }

  /** Whether emails actually leave the server. */
  get configured(): boolean {
    return this.resend !== null;
  }

  async send({ to, content, kind }: OutgoingMail): Promise<boolean> {
    const resend = this.resend;
    if (!resend) {
      if (this.config.get<string>("NODE_ENV") !== "production") {
        this.logger.warn(`[stub, development only] ${kind} email to ${to} — ${content.subject}\n${content.text}`);
      } else {
        this.logger.error(`${kind} email to ${maskEmail(to)} not sent: no mail provider configured`);
      }
      return false;
    }

    try {
      const response = await fetch(RESEND_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${resend.key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: resend.from, to: [to], subject: content.subject, text: content.text, html: content.html }),
        signal: AbortSignal.timeout(RESEND_TIMEOUT_MS),
      });
      if (response.ok) return true;
      const body = (await response.json().catch(() => null)) as { message?: unknown } | null;
      const reason = typeof body?.message === "string" ? ` — ${body.message}` : "";
      this.logger.error(`${kind} email to ${maskEmail(to)} refused: HTTP ${response.status}${reason}`);
      return false;
    } catch (err) {
      const reason = err instanceof Error && err.name === "TimeoutError" ? "timeout" : err instanceof Error ? err.message : String(err);
      this.logger.error(`${kind} email to ${maskEmail(to)} failed: ${reason}`);
      return false;
    }
  }
}
