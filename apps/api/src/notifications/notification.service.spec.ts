import type { ConfigService } from "@nestjs/config";
import { NotificationService } from "./notification.service.js";

const configOf = (values: Record<string, string>) =>
  ({ get: (key: string) => values[key] }) as unknown as ConfigService;

const UBILL = { UBILL_API_KEY: "test-key", UBILL_BRAND_ID: "7" };

const reply = (status: number, body: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

describe("NotificationService (SMS via uBill)", () => {
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    fetchMock = jest.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  it("is a stub without credentials: nothing is sent and nothing claims delivery", async () => {
    const service = new NotificationService(configOf({}));

    expect(service.canDeliverSms()).toBe(false);
    await expect(service.sendOtp({ phoneNumber: "555123456", code: "123456" })).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("needs a numeric brand ID as well as the key", () => {
    expect(new NotificationService(configOf({ UBILL_API_KEY: "k", UBILL_BRAND_ID: "bukme" })).canDeliverSms()).toBe(
      false,
    );
    expect(new NotificationService(configOf(UBILL)).canDeliverSms()).toBe(true);
  });

  it("sends the OTP flagged as one, to the international number, with the key in a header", async () => {
    fetchMock.mockResolvedValue(reply(200, { statusID: 0, smsID: "1" }));
    const service = new NotificationService(configOf(UBILL));

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

  // R270
  it("texts the manage link in plain Latin, so it bills as a single SMS", async () => {
    fetchMock.mockResolvedValue(reply(200, { statusID: 0, smsID: "2" }));
    const service = new NotificationService(configOf(UBILL));
    const manageUrl = `https://salon.bukme.website/manage/${"x".repeat(43)}`;

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

  it("reports a refusal (no balance, OTP cooldown) as not delivered", async () => {
    const service = new NotificationService(configOf(UBILL));

    fetchMock.mockResolvedValueOnce(reply(200, { statusID: 40, message: "Not enough SMS balance" }));
    await expect(service.sendOtp({ phoneNumber: "555123456", code: "1" })).resolves.toBe(false);

    fetchMock.mockResolvedValueOnce(reply(200, { statusID: 0, acceptedCount: 0, rejectedCount: 1 }));
    await expect(service.sendOtp({ phoneNumber: "555123456", code: "1" })).resolves.toBe(false);

    fetchMock.mockResolvedValueOnce(reply(403, {}));
    await expect(service.sendOtp({ phoneNumber: "555123456", code: "1" })).resolves.toBe(false);
  });

  it("never throws on a network failure", async () => {
    fetchMock.mockRejectedValue(new Error("timeout"));
    const service = new NotificationService(configOf(UBILL));

    await expect(service.sendOtp({ phoneNumber: "555123456", code: "1" })).resolves.toBe(false);
  });

  it("doesn't pay for a number that can't be dialled", async () => {
    const service = new NotificationService(configOf(UBILL));

    await expect(service.sendOtp({ phoneNumber: "12345", code: "1" })).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
