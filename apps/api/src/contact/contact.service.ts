import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AdminContactRequest } from "@booking/shared-types";
import type { Prisma } from "../../generated/prisma/index.js";
import { contactRequestEmail } from "../notifications/mail-templates.js";
import { MailService } from "../notifications/mail.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { parseContactForm, resultUrl, type ContactLocale } from "./contact-form.js";

/** Requests shown on the admin page: plenty for a team that answers them. */
const LISTED = 200;

type ContactRow = Prisma.ContactRequestGetPayload<Record<string, never>>;

const toAdmin = (row: ContactRow): AdminContactRequest => ({
  id: row.id,
  name: row.name,
  business: row.business,
  phone: row.phone,
  email: row.email,
  message: row.message,
  locale: row.locale,
  createdAt: row.createdAt.toISOString(),
  handledAt: row.handledAt?.toISOString() ?? null,
});

/**
 * R580: requests from the marketing site's contact page. The table belongs to
 * the platform, not a salon (no tenant_id, no RLS), so it is read outside any
 * tenant, like the plans.
 */
@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  /** Stores a valid request (and emails staff if configured). A bot's is dropped but answered as a success. */
  async submit(body: unknown): Promise<{ locale: ContactLocale; result: "thanks" | "sorry" }> {
    const parsed = parseContactForm(body);
    if (parsed.kind === "spam") return { locale: parsed.locale, result: "thanks" };
    if (parsed.kind === "invalid") return { locale: parsed.locale, result: "sorry" };

    const row = await this.prisma.client.contactRequest.create({ data: parsed.data });
    this.logger.log(`contact request ${row.id} from the ${parsed.data.locale} page`);
    void this.notify(parsed.data);
    return { locale: parsed.data.locale, result: "thanks" };
  }

  /** The marketing page to send the visitor to; null when MARKETING_URL isn't configured. */
  redirectFor(locale: ContactLocale, result: "thanks" | "sorry"): string | null {
    const marketingUrl = this.config.get<string>("MARKETING_URL")?.trim();
    return marketingUrl ? resultUrl(marketingUrl, locale, result) : null;
  }

  /** Newest first. */
  async list(): Promise<AdminContactRequest[]> {
    const rows = await this.prisma.client.contactRequest.findMany({ orderBy: { createdAt: "desc" }, take: LISTED });
    return rows.map(toAdmin);
  }

  /** Marks a request handled, or reopens it. */
  async setHandled(id: string, handled: boolean): Promise<AdminContactRequest> {
    const updated = await this.prisma.client.contactRequest.updateMany({ where: { id }, data: { handledAt: handled ? new Date() : null } });
    if (updated.count === 0) throw new NotFoundException("No such request");
    return toAdmin(await this.prisma.client.contactRequest.findUniqueOrThrow({ where: { id } }));
  }

  private async notify(data: { name: string; business: string; phone: string; email: string | null; message: string | null; locale: string }) {
    const to = this.config.get<string>("CONTACT_NOTIFY_EMAIL")?.trim();
    if (!to) return;
    const apiUrl = this.config.get<string>("API_PUBLIC_URL")?.trim();
    await this.mail.send({
      to,
      kind: "contact_request",
      content: contactRequestEmail({ ...data, adminUrl: apiUrl ? new URL("/admin", apiUrl).href : null }),
    });
  }
}
