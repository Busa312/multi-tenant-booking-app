import { BadRequestException } from "@nestjs/common";
import { validateOnboarding } from "./onboarding.service.js";

const valid = {
  name: "  Salon Rustaveli ",
  timezone: "Asia/Tbilisi",
  subdomain: "rustaveli",
  ownerEmail: " Owner@Example.GE ",
  ownerPassword: "a-long-enough-password",
};

// R430
describe("validateOnboarding", () => {
  it("accepts a valid salon, trimming and lowercasing the email", () => {
    expect(validateOnboarding(valid)).toEqual({ ...valid, name: "Salon Rustaveli", ownerEmail: "owner@example.ge" });
  });

  it.each([
    ["uppercase", "Rustaveli"],
    ["a space", "salon one"],
    ["a leading hyphen", "-salon"],
    ["a trailing hyphen", "salon-"],
    ["a dot", "salon.ge"],
    ["nothing", ""],
    ["more than 63 characters", "a".repeat(64)],
  ])("refuses a subdomain with %s", (_case, subdomain) => {
    expect(() => validateOnboarding({ ...valid, subdomain })).toThrow(BadRequestException);
  });

  it("refuses a reserved subdomain", () => {
    expect(() => validateOnboarding({ ...valid, subdomain: "admin" })).toThrow(/reserved/);
  });

  it("accepts hyphens and digits inside a subdomain", () => {
    expect(validateOnboarding({ ...valid, subdomain: "salon-2-vake" }).subdomain).toBe("salon-2-vake");
  });

  it("refuses a password shorter than the CMS allows", () => {
    expect(() => validateOnboarding({ ...valid, ownerPassword: "pass123" })).toThrow(/ownerPassword/);
  });

  it("refuses an owner email that isn't one", () => {
    expect(() => validateOnboarding({ ...valid, ownerEmail: "owner" })).toThrow(/ownerEmail/);
  });

  it("refuses a time zone that doesn't exist", () => {
    expect(() => validateOnboarding({ ...valid, timezone: "string" })).toThrow(/timezone/);
  });

  it("refuses an empty salon name", () => {
    expect(() => validateOnboarding({ ...valid, name: "   " })).toThrow(/name/);
  });
});
