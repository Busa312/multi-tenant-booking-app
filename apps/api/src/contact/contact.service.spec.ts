import type { ConfigService } from "@nestjs/config";
import type { MailService } from "../notifications/mail.service.js";
import type { PrismaService } from "../prisma/prisma.service.js";
import { ContactService } from "./contact.service.js";

const FORM = { name: "Nino", business: "Vake Nails", phone: "599123456", locale: "en" };

function setup(env: Record<string, string> = {}) {
  const rows: Record<string, unknown>[] = [];
  const contactRequest = {
    create: jest.fn(({ data }: { data: Record<string, unknown> }) => {
      const row = { id: "11111111-1111-1111-1111-111111111111", createdAt: new Date(), handledAt: null, ...data };
      rows.push(row);
      return Promise.resolve(row);
    }),
  };
  const prisma = { client: { contactRequest } } as unknown as PrismaService;
  const mail = { send: jest.fn(() => Promise.resolve(true)) };
  const config = { get: (key: string) => env[key] } as unknown as ConfigService;
  return { service: new ContactService(prisma, mail as unknown as MailService, config), contactRequest, mail, rows };
}

// R580
describe("ContactService", () => {
  it("stores a request and thanks the visitor", async () => {
    const { service, rows } = setup();

    await expect(service.submit(FORM)).resolves.toEqual({ locale: "en", result: "thanks" });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: "Nino", business: "Vake Nails", phone: "599123456", locale: "en" });
  });

  it("thanks a bot too, but keeps nothing and emails nobody", async () => {
    const { service, contactRequest, mail } = setup({ CONTACT_NOTIFY_EMAIL: "staff@example.com" });

    await expect(service.submit({ ...FORM, website: "x" })).resolves.toEqual({ locale: "en", result: "thanks" });
    expect(contactRequest.create).not.toHaveBeenCalled();
    expect(mail.send).not.toHaveBeenCalled();
  });

  it("sends the visitor to try again when the form doesn't hold up, keeping nothing", async () => {
    const { service, contactRequest } = setup();

    await expect(service.submit({ ...FORM, phone: "" })).resolves.toEqual({ locale: "en", result: "sorry" });
    expect(contactRequest.create).not.toHaveBeenCalled();
  });

  it("emails staff only where an address is configured", async () => {
    const quiet = setup();
    await quiet.service.submit(FORM);
    expect(quiet.mail.send).not.toHaveBeenCalled();

    const loud = setup({ CONTACT_NOTIFY_EMAIL: "staff@example.com" });
    await loud.service.submit(FORM);
    expect(loud.mail.send).toHaveBeenCalledWith(expect.objectContaining({ to: "staff@example.com", kind: "contact_request" }));
  });

  it("redirects to the marketing site's page in the visitor's language, or nowhere if it isn't configured", () => {
    expect(setup({ MARKETING_URL: "https://book-it.ge" }).service.redirectFor("ru", "thanks")).toBe("https://book-it.ge/ru/contact/thanks/");
    expect(setup().service.redirectFor("ka", "thanks")).toBeNull();
  });
});
