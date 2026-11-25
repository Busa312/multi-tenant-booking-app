import type { ConfigService } from "@nestjs/config";
import { issueToken } from "../booking/magic-link.js";
import { manageUrl as buildManageUrl } from "../common/tenant-url.js";
import { magicLinkText, NotificationService } from "./notification.service.js";
import type { SmsLogService } from "./sms-log.service.js";
import { smsParts } from "./sms-parts.js";

const configOf = (values: Record<string, string>) =>
  ({ get: (key: string) => values[key] }) as unknown as ConfigService;

const UBILL = { UBILL_API_KEY: "test-key", UBILL_BRAND_ID: "7" };

const reply = (status: number, body: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

describe("NotificationService (SMS via uBill)", () => {
  let fetchMock: jest.SpyInstance;
  // R500: what got counted
  let smsLog: { record: jest.Mock };

  beforeEach(() => {
    fetchMock = jest.spyOn(globalThis, "fetch");
    smsLog = { record: jest.fn().mockResolvedValue(undefined) };
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  it("is a stub without credentials: nothing is sent and nothing claims delivery", async () => {
    const service = new NotificationService(configOf({}), smsLog as unknown as SmsLogService);

    expect(service.canDeliverSms()).toBe(false);
    await expect(service.sendOtp({ phoneNumber: "555123456", code: "123456" })).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("needs a numeric brand ID as well as the key", () => {
    expect(new NotificationService(configOf({ UBILL_API_KEY: "k", UBILL_BRAND_ID: "bukme" }), smsLog as unknown as SmsLogService).canDeliverSms()).toBe(
      false,
    );
    expect(new NotificationService(configOf(UBILL), smsLog as unknown as SmsLogService).canDeliverSms()).toBe(true);
  });

  it("sends the OTP flagged as one, to the international number, with the key in a header", async () => {
    fetchMock.mockResolvedValue(reply(200, { statusID: 0, smsID: "1" }));
    const service = new NotificationService(configOf(UBILL), smsLog as unknown as SmsLogService);

    await expect(service.sendOtp({ phoneNumber: "555 12 34 56", code: "042917" })).resolves.toBe(true);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.ubill.dev/v1/sms/send");
    expect(init.headers).toMatchObject({ key: "test-key" });
    expect(JSON.parse(init.body as string)).toEqual({
      brandID: 7,
      numbers: ["995555123456"],
      text: "Your booking code is 042917",
      otp: true,
    });
  });

  // R270, R500
  it("texts the manage link in plain Latin, so it bills as a single SMS", async () => {
    fetchMock.mockResolvedValue(reply(200, { statusID: 0, smsID: "2" }));
    const service = new NotificationService(configOf(UBILL), smsLog as unknown as SmsLogService);
    const manageUrl = buildManageUrl("salon.bukme.website", issueToken(new Date()).token);

    await service.sendMagicLink({
      phoneNumber: "+995555123456",
      userName: "ნინო",
      manageUrl,
      startAt: new Date(),
      locationName: "ვაკე",
    });

    const { text, otp } = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(text).toContain(manageUrl);
    expect(otp).toBe(false);
    expect(text.length).toBeLessThanOrEqual(160);
    expect(/^[\x20-\x7E]*$/.test(text)).toBe(true);
  });

  // R500: a long salon name must not make every booking cost two texts
  it.each([
    ["a long subdomain", "nailandbeautystudiotbilisi.bukme.website"],
    ["a custom domain", "www.nail-and-beauty-studio-tbilisi.ge"],
    ["the longest address the rule promises (80 characters)", `${"s".repeat(66)}.bukme.website`],
  ])("keeps the manage-link text to one SMS part for %s", (_label, host) => {
    const text = magicLinkText(buildManageUrl(host, issueToken(new Date()).token));
    expect(smsParts(text)).toBe(1);
  });

  it("reports a refusal (no balance, OTP cooldown) as not delivered", async () => {
    const service = new NotificationService(configOf(UBILL), smsLog as unknown as SmsLogService);

    fetchMock.mockResolvedValueOnce(reply(200, { statusID: 40, message: "Not enough SMS balance" }));
    await expect(service.sendOtp({ phoneNumber: "555123456", code: "1" })).resolves.toBe(false);

    fetchMock.mockResolvedValueOnce(reply(200, { statusID: 0, acceptedCount: 0, rejectedCount: 1 }));
    await expect(service.sendOtp({ phoneNumber: "555123456", code: "1" })).resolves.toBe(false);

    fetchMock.mockResolvedValueOnce(reply(403, {}));
    await expect(service.sendOtp({ phoneNumber: "555123456", code: "1" })).resolves.toBe(false);
  });

  // R500
  it("counts a text towards the salon's usage only once uBill has accepted it", async () => {
    const service = new NotificationService(configOf(UBILL), smsLog as unknown as SmsLogService);

    fetchMock.mockResolvedValueOnce(reply(200, { statusID: 0, smsID: "3" }));
    await service.sendOtp({ phoneNumber: "555123456", code: "042917" });
    expect(smsLog.record).toHaveBeenCalledWith("otp", 1);

    smsLog.record.mockClear();
    fetchMock.mockResolvedValueOnce(reply(200, { statusID: 40, message: "Not enough SMS balance" }));
    await service.sendOtp({ phoneNumber: "555123456", code: "1" });
    expect(smsLog.record).not.toHaveBeenCalled();
  });

  it("counts nothing while no SMS provider is configured", async () => {
    const service = new NotificationService(configOf({}), smsLog as unknown as SmsLogService);

    await service.sendOtp({ phoneNumber: "555123456", code: "1" });
    expect(smsLog.record).not.toHaveBeenCalled();
  });

  it("never throws on a network failure", async () => {
    fetchMock.mockRejectedValue(new Error("timeout"));
    const service = new NotificationService(configOf(UBILL), smsLog as unknown as SmsLogService);

    await expect(service.sendOtp({ phoneNumber: "555123456", code: "1" })).resolves.toBe(false);
  });

  it("doesn't pay for a number that can't be dialled", async () => {
    const service = new NotificationService(configOf(UBILL), smsLog as unknown as SmsLogService);

    await expect(service.sendOtp({ phoneNumber: "12345", code: "1" })).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// R610: the reminder text
describe("NotificationService.sendReminder", () => {
  let fetchMock: jest.SpyInstance;
  let smsLog: { record: jest.Mock };

  beforeEach(() => {
    fetchMock = jest.spyOn(globalThis, "fetch");
    smsLog = { record: jest.fn().mockResolvedValue(undefined) };
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  it("sends it as an ordinary text and counts it as a reminder (R500)", async () => {
    fetchMock.mockResolvedValue(reply(200, { statusID: 0, smsID: "1" }));
    const service = new NotificationService(configOf(UBILL), smsLog as unknown as SmsLogService);

    await expect(service.sendReminder("555 12 34 56", "Reminder: Tue 24 Nov 11:45. Confirm or cancel: https://a.ge/m/x")).resolves.toBe(true);

    expect(JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string)).toMatchObject({ otp: false });
    expect(smsLog.record).toHaveBeenCalledWith("reminder", 1);
  });

  it("sends nothing in production without a provider — a reminder would only replace the customer's link", async () => {
    const service = new NotificationService(configOf({ NODE_ENV: "production" }), smsLog as unknown as SmsLogService);
    expect(service.canSendReminders()).toBe(false);
    await expect(service.sendReminder("555123456", "text")).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("logs it in development, so the flow can be followed without a provider", async () => {
    const service = new NotificationService(configOf({ NODE_ENV: "development" }), smsLog as unknown as SmsLogService);
    expect(service.canSendReminders()).toBe(true);
    await expect(service.sendReminder("555123456", "text")).resolves.toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(smsLog.record).not.toHaveBeenCalled();
  });
});
