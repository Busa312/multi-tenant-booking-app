import { BadRequestException } from "@nestjs/common";
import { Prisma } from "../../generated/prisma/index.js";
import { enabledLocalesOf, validateLocalizedText, LOCALIZED_NAME_MAX } from "./i18n-validation.js";

const LOCALES = ["en", "ka"];

// R160: these pin the storage rules

describe("validateLocalizedText", () => {
  it("stores the translations for enabled non-default locales", () => {
    expect(validateLocalizedText({ ka: "შეჭრა" }, "nameI18n", LOCALES)).toEqual({ ka: "შეჭრა" });
  });

  it("trims values", () => {
    expect(validateLocalizedText({ ka: "  შეჭრა  " }, "nameI18n", LOCALES)).toEqual({ ka: "შეჭრა" });
  });

  it("drops the default locale — its text belongs in the plain column", () => {
    expect(validateLocalizedText({ en: "Haircut", ka: "შეჭრა" }, "nameI18n", LOCALES)).toEqual({ ka: "შეჭრა" });
  });

  it("drops blank entries — a locale not written yet, not a deliberate blank", () => {
    expect(validateLocalizedText({ ka: "   " }, "nameI18n", LOCALES)).toBe(Prisma.DbNull);
  });

  it("stores SQL NULL rather than {} when nothing survives", () => {
    expect(validateLocalizedText({}, "nameI18n", LOCALES)).toBe(Prisma.DbNull);
    expect(validateLocalizedText({ en: "Haircut" }, "nameI18n", LOCALES)).toBe(Prisma.DbNull);
    expect(validateLocalizedText(undefined, "nameI18n", LOCALES)).toBe(Prisma.DbNull);
    expect(validateLocalizedText(null, "nameI18n", LOCALES)).toBe(Prisma.DbNull);
  });

  it("rejects a locale the tenant hasn't enabled, naming it", () => {
    expect(() => validateLocalizedText({ ru: "Стрижка" }, "nameI18n", LOCALES)).toThrow(
      "nameI18n.ru is not one of this tenant's enabled locales",
    );
  });

  it("400s rather than 500s on a malformed body", () => {
    expect(() => validateLocalizedText("nope", "nameI18n", LOCALES)).toThrow(BadRequestException);
    expect(() => validateLocalizedText(["ka"], "nameI18n", LOCALES)).toThrow(BadRequestException);
    expect(() => validateLocalizedText({ ka: 42 }, "nameI18n", LOCALES)).toThrow("nameI18n.ka must be a string");
  });

  it("caps length", () => {
    const tooLong = "ა".repeat(LOCALIZED_NAME_MAX + 1);
    expect(() => validateLocalizedText({ ka: tooLong }, "nameI18n", LOCALES)).toThrow("at most 200 characters");
    expect(validateLocalizedText({ ka: "ა".repeat(LOCALIZED_NAME_MAX) }, "nameI18n", LOCALES)).toEqual({
      ka: "ა".repeat(LOCALIZED_NAME_MAX),
    });
  });
});

describe("enabledLocalesOf", () => {
  it("reads the tenant's configured locales, default first", () => {
    expect(enabledLocalesOf({ enabledLocales: ["ka", "en"] })).toEqual(["ka", "en"]);
  });

  it("falls back to every supported locale for a tenant that configured none", () => {
    // Both languages are on until an owner narrows the list; "en" stays first,
    // so it remains the default content locale the plain columns hold.
    expect(enabledLocalesOf({})).toEqual(["en", "ka"]);
    expect(enabledLocalesOf({ enabledLocales: [] })).toEqual(["en", "ka"]);
    expect(enabledLocalesOf(null)).toEqual(["en", "ka"]);
  });

  it("drops locales the platform doesn't support", () => {
    expect(enabledLocalesOf({ enabledLocales: ["en", "ru"] })).toEqual(["en"]);
  });

  it("ignores malformed config rather than throwing on an unauthenticated read path", () => {
    expect(enabledLocalesOf("nope")).toEqual(["en", "ka"]);
    expect(enabledLocalesOf({ enabledLocales: "ka" })).toEqual(["en", "ka"]);
    expect(enabledLocalesOf({ enabledLocales: [1, 2] })).toEqual(["en", "ka"]);
  });
});
