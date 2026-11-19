import { parseContactForm, resultUrl } from "./contact-form.js";

const FORM = { name: "Nino", business: "Vake Nails", phone: "+995 599 12 34 56", locale: "ru" };

// R580
describe("parseContactForm", () => {
  it("keeps a filled-in form, trimmed, with empty optional fields as null", () => {
    expect(parseContactForm({ ...FORM, name: "  Nino ", email: "", message: " " })).toEqual({
      kind: "valid",
      data: { name: "Nino", business: "Vake Nails", phone: "+995 599 12 34 56", email: null, message: null, locale: "ru" },
    });
  });

  it("treats a filled honeypot as a bot, whatever else is in the form", () => {
    expect(parseContactForm({ ...FORM, website: "http://spam.example" })).toEqual({ kind: "spam", locale: "ru" });
  });

  it("refuses a form missing what's required, or with a field that isn't one", () => {
    for (const body of [
      { ...FORM, name: "" },
      { ...FORM, business: " " },
      { ...FORM, phone: "call me" },
      { ...FORM, email: "nino-at-example" },
      { ...FORM, message: "x".repeat(2001) },
      { ...FORM, name: "x".repeat(101) },
      null,
    ]) {
      expect(parseContactForm(body).kind).toBe("invalid");
    }
  });

  it("falls back to Georgian, the site's main language, for an unknown locale", () => {
    expect(parseContactForm({ ...FORM, locale: "de", name: "" })).toEqual({ kind: "invalid", locale: "ka" });
  });
});

describe("resultUrl", () => {
  it("sends the visitor back to the page in their own language", () => {
    expect(resultUrl("https://book-it.ge", "ka", "thanks")).toBe("https://book-it.ge/contact/thanks/");
    expect(resultUrl("https://book-it.ge/", "en", "sorry")).toBe("https://book-it.ge/en/contact/sorry/");
    expect(resultUrl("https://book-it.ge", "ru", "thanks")).toBe("https://book-it.ge/ru/contact/thanks/");
  });
});
