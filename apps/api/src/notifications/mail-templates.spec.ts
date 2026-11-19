import { contactRequestEmail, passwordResetEmail, setupLinkEmail, toMailLang } from "./mail-templates.js";

const RESET_URL = "https://cms.example.ge/reset-password/t1/abc_DEF-123";
const SETUP_URL = "https://cms.example.ge/set-password/t1/xyz";

// R310
describe("password reset email", () => {
  it("carries the link in both the text and the HTML, and says how long it works", () => {
    const mail = passwordResetEmail({ lang: "en", salonName: "Vake Nails", email: "nino@example.ge", resetUrl: RESET_URL });
    expect(mail.subject).toBe("Reset your password · Vake Nails");
    expect(mail.text).toContain(RESET_URL);
    expect(mail.html).toContain(`href="${RESET_URL}"`);
    expect(mail.text).toContain("30 minutes");
  });

  it("is written in Georgian when asked", () => {
    const mail = passwordResetEmail({ lang: "ka", salonName: "Vake Nails", email: "nino@example.ge", resetUrl: RESET_URL });
    expect(mail.subject).toMatch(/^პაროლის აღდგენა/);
    expect(mail.text).toContain("30 წუთის");
    expect(mail.text).toContain(RESET_URL);
  });

  // R570
  it("is written in Russian when the CMS was showing Russian", () => {
    const mail = passwordResetEmail({ lang: "ru", salonName: "Vake Nails", email: "nino@example.ge", resetUrl: RESET_URL });
    expect(mail.subject).toBe("Сброс пароля · Vake Nails");
    expect(mail.text).toContain("30 минут");
    expect(mail.text).toContain(RESET_URL);
  });

  it("escapes what the salon named itself before it goes into the HTML", () => {
    const mail = passwordResetEmail({ lang: "en", salonName: `<img src=x onerror="alert(1)">`, email: "a@b.ge", resetUrl: RESET_URL });
    expect(mail.html).not.toContain("<img");
    expect(mail.html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });
});

// R430
describe("owner's set-password email", () => {
  const base = {
    salonName: "Vake Nails",
    workspace: "vake-nails",
    email: "owner@example.ge",
    cmsUrl: "https://cms.example.ge",
    setPasswordUrl: SETUP_URL,
  };

  it("is in Georgian then English, with the link, its 7 days and how to sign in afterwards", () => {
    const mail = setupLinkEmail({ ...base, firstTime: true });
    expect(mail.subject).toBe("თქვენი სალონი მზადაა · Vake Nails / Your salon is ready · Vake Nails");
    expect(mail.text.indexOf("სალონის სივრცე: vake-nails")).toBeLessThan(mail.text.indexOf("Salon workspace: vake-nails"));
    expect(mail.text.match(new RegExp(SETUP_URL, "g"))).toHaveLength(2);
    expect(mail.text).toContain("7 days");
    expect(mail.text).toContain("Afterwards, sign in at https://cms.example.ge");
    expect(mail.html).toContain(`href="${SETUP_URL}"`);
  });

  it("isn't a welcome when the owner has signed in before, and says their password still works", () => {
    const mail = setupLinkEmail({ ...base, firstTime: false });
    expect(mail.subject).toContain("Set a new password · Vake Nails");
    expect(mail.text).toContain("Your current password keeps working until you use it.");
    expect(mail.text).not.toContain("is ready");
  });
});

describe("toMailLang", () => {
  it.each([
    ["en", "en"],
    ["ka", "ka"],
    ["ru", "ru"],
    [undefined, "ka"],
    ["de", "ka"],
    [42, "ka"],
  ])("reads %p as %p", (input, expected) => {
    expect(toMailLang(input)).toBe(expected);
  });
});

// R580
describe("contact request email", () => {
  it("tells staff who asked and how to reach them, escaping what they typed", () => {
    const mail = contactRequestEmail({
      name: "Nino",
      business: "<b>Vake</b> Nails",
      phone: "599 12 34 56",
      email: null,
      message: "Two branches, 6 staff.",
      locale: "ka",
      adminUrl: "https://api.example.com/admin",
    });
    expect(mail.subject).toBe("New contact request · <b>Vake</b> Nails");
    expect(mail.text).toContain("Phone: 599 12 34 56");
    expect(mail.text).toContain("Two branches, 6 staff.");
    expect(mail.text).not.toContain("Email:");
    expect(mail.html).not.toContain("<b>Vake</b>");
    expect(mail.html).toContain('href="https://api.example.com/admin"');
  });
});
