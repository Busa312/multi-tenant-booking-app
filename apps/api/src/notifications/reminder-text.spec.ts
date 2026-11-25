import { issueToken } from "../booking/magic-link.js";
import { shortManageUrl } from "../common/tenant-url.js";
import { reminderText, reminderWhen } from "./reminder-text.js";
import { smsParts } from "./sms-parts.js";

// R610 + R500: the reminder is one plain-Latin SMS part
const START = new Date("2026-11-24T07:45:00Z"); // Tue 24 Nov 11:45 in Tbilisi
const link = (host: string) => shortManageUrl(`https://${host}`, issueToken(START).token);

describe("reminderText", () => {
  it("says when, in the salon's time zone, in English day and month names", () => {
    expect(reminderWhen(START, "Asia/Tbilisi")).toBe("Tue 24 Nov 11:45");
    expect(reminderWhen(new Date("2026-01-05T05:05:00Z"), "Asia/Tbilisi")).toBe("Mon 5 Jan 09:05");
  });

  it("uses the full wording for an ordinary address", () => {
    const url = link("aura.book-it.ge");
    expect(reminderText(START, "Asia/Tbilisi", url)).toBe(`Reminder: Tue 24 Nov 11:45. Confirm or cancel: ${url}`);
  });

  it.each([
    ["an ordinary subdomain", "aura.book-it.ge"],
    ["a long custom domain", `${"salon".repeat(9)}.com.ge`],
    ["the longest address the rule promises (80 characters)", `${"s".repeat(66)}.bukme.website`],
  ])("fits one GSM-7 part for %s, link intact", (_label, host) => {
    expect(host.length).toBeLessThanOrEqual(80);
    const url = link(host);
    const text = reminderText(START, "Asia/Tbilisi", url);
    expect(smsParts(text)).toBe(1);
    expect(text.length).toBeLessThanOrEqual(160);
    expect(text).toContain(url);
    expect(text).toContain("Tue 24 Nov 11:45");
    // Plain Latin: one Georgian letter would make it Unicode (70 a part)
    expect(/^[\x20-\x7E]*$/.test(text)).toBe(true);
  });

  it("shortens the wording, not the link, as the address grows", () => {
    expect(reminderText(START, "Asia/Tbilisi", link(`${"s".repeat(66)}.bukme.website`))).toMatch(/^Visit Tue 24 Nov 11:45: https:/);
  });
});
