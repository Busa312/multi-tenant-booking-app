import { Logger } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { MailService, maskEmail } from "./mail.service.js";

const configOf = (values: Record<string, string>) =>
  ({ get: (key: string) => values[key] }) as unknown as ConfigService;

const RESEND = { RESEND_API_KEY: "re_test", MAIL_FROM: "Bukme <no-reply@example.ge>" };
const content = { subject: "Hello", text: "Your link: https://cms.example.ge/set-password/t/secret", html: "<p>Hi</p>" };

const reply = (status: number, body: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

// R310/R430
describe("MailService (Resend)", () => {
  let fetchMock: jest.SpyInstance;
  let errorLog: jest.SpyInstance;

  beforeEach(() => {
    fetchMock = jest.spyOn(global, "fetch");
    errorLog = jest.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it("sends through Resend with the configured sender, as text and HTML", async () => {
    fetchMock.mockResolvedValue(reply(200, { id: "e1" }));
    const mail = new MailService(configOf(RESEND));

    await expect(mail.send({ to: "owner@example.ge", content, kind: "test" })).resolves.toBe(true);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer re_test");
    expect(JSON.parse(init.body as string)).toEqual({
      from: "Bukme <no-reply@example.ge>",
      to: ["owner@example.ge"],
      subject: "Hello",
      text: content.text,
      html: content.html,
    });
  });

  it("reports a refusal as not sent, and never logs the email's text (its link is a secret)", async () => {
    fetchMock.mockResolvedValue(reply(422, { message: "The example.ge domain is not verified" }));
    const mail = new MailService(configOf(RESEND));

    await expect(mail.send({ to: "owner@example.ge", content, kind: "test" })).resolves.toBe(false);
    const logged = errorLog.mock.calls.map((call) => String(call[0])).join("\n");
    expect(logged).toContain("not verified");
    expect(logged).not.toContain("secret");
    expect(logged).not.toContain("owner@example.ge");
  });

  it("reports a network failure as not sent instead of throwing", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNRESET"));
    const mail = new MailService(configOf(RESEND));
    await expect(mail.send({ to: "owner@example.ge", content, kind: "test" })).resolves.toBe(false);
  });

  it.each([
    ["no key", { MAIL_FROM: RESEND.MAIL_FROM }],
    ["no sender", { RESEND_API_KEY: RESEND.RESEND_API_KEY }],
  ])("sends nothing with %s, and says it isn't configured", async (_label, values) => {
    const mail = new MailService(configOf({ ...values, NODE_ENV: "production" }));
    expect(mail.configured).toBe(false);
    await expect(mail.send({ to: "owner@example.ge", content, kind: "test" })).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    // Production logs never hold the link either
    expect(errorLog.mock.calls.map((call) => String(call[0])).join("\n")).not.toContain("secret");
  });
});

describe("maskEmail", () => {
  it.each([
    ["owner@example.ge", "o***@example.ge"],
    ["a@b.ge", "a***@b.ge"],
    ["not-an-email", "***"],
  ])("masks %s as %s", (input, expected) => {
    expect(maskEmail(input)).toBe(expected);
  });
});
