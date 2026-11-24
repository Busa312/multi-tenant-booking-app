import type { ConfigService } from "@nestjs/config";
import webpush from "web-push";
import { PushService } from "./push.service.js";

jest.mock("web-push", () => {
  class WebPushError extends Error {
    constructor(
      message: string,
      public readonly statusCode: number,
    ) {
      super(message);
    }
  }
  return { __esModule: true, default: { sendNotification: jest.fn(), WebPushError } };
});

const send = webpush.sendNotification as jest.Mock;
const PushError = webpush.WebPushError as unknown as new (message: string, statusCode: number) => Error;

const VAPID = { VAPID_PUBLIC_KEY: "public", VAPID_PRIVATE_KEY: "private", VAPID_SUBJECT: "mailto:ops@example.com" };
const config = (values: Record<string, string>) => ({ get: (key: string) => values[key] }) as unknown as ConfigService;

const target = { endpoint: "https://fcm.googleapis.com/fcm/send/abc", p256dh: "key", auth: "secret" };
const payload = { title: "New booking", body: "Nino", tag: "visit-v1", url: "/bookings" };

// R620
describe("PushService", () => {
  it("is off, and sends nothing, without all three VAPID settings", async () => {
    const push = new PushService(config({ VAPID_PUBLIC_KEY: "public", VAPID_PRIVATE_KEY: "private" }));
    expect(push.publicKey).toBeNull();
    await expect(push.send(target, payload)).resolves.toBe("failed");
    expect(send).not.toHaveBeenCalled();
  });

  it("signs with the platform's keys and sends the payload as JSON", async () => {
    send.mockResolvedValueOnce({ statusCode: 201 });
    const push = new PushService(config(VAPID));
    expect(push.publicKey).toBe("public");

    await expect(push.send(target, payload)).resolves.toBe("sent");
    expect(send).toHaveBeenCalledWith(
      { endpoint: target.endpoint, keys: { p256dh: "key", auth: "secret" } },
      JSON.stringify(payload),
      expect.objectContaining({
        vapidDetails: { subject: "mailto:ops@example.com", publicKey: "public", privateKey: "private" },
      }),
    );
  });

  it.each([404, 410])("reports a subscription the push service no longer knows (%i) as gone", async (status) => {
    send.mockRejectedValueOnce(new PushError("gone", status));
    await expect(new PushService(config(VAPID)).send(target, payload)).resolves.toBe("gone");
  });

  it("never throws: other refusals and network errors are failures to retry later", async () => {
    const push = new PushService(config(VAPID));
    send.mockRejectedValueOnce(new PushError("rate limited", 429));
    await expect(push.send(target, payload)).resolves.toBe("failed");
    send.mockRejectedValueOnce(new Error("ECONNRESET"));
    await expect(push.send(target, payload)).resolves.toBe("failed");
  });
});
