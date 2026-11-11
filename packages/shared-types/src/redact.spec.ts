import { redactSecrets, scrubBreadcrumb, scrubEvent } from "./redact";

// Error reports leave for a third party; no live credential goes with them
describe("redactSecrets", () => {
  it.each([
    ["https://salon.ge/en/manage/abc123def", "https://salon.ge/en/manage/[redacted]"],
    ["/public/manage/abc123/reschedule", "/public/manage/[redacted]/reschedule"],
    ["https://cms.ge/reset-password/t-1/tok3n", "https://cms.ge/reset-password/t-1/[redacted]"],
    ["https://cms.ge/set-password/t-1/inv1te?x=1", "https://cms.ge/set-password/t-1/[redacted]?x=1"],
    ["/public/holds/2222-aaaa", "/public/holds/[redacted]"],
    ["/public/availability?date=2026-08-05&holdId=2222", "/public/availability?date=2026-08-05&holdId=[redacted]"],
  ])("redacts %s", (input, expected) => {
    expect(redactSecrets(input)).toBe(expected);
  });

  it("leaves the lost-link page and ordinary URLs alone", () => {
    expect(redactSecrets("https://salon.ge/manage/resend")).toBe("https://salon.ge/manage/resend");
    expect(redactSecrets("https://salon.ge/book?serviceIds=a,b")).toBe("https://salon.ge/book?serviceIds=a,b");
  });
});

describe("scrubEvent", () => {
  it("cleans the request, transaction, exception messages and breadcrumbs", () => {
    const event = {
      request: { url: "https://salon.ge/manage/SECRET", query_string: "holdId=SECRET", headers: { referer: "https://salon.ge/manage/SECRET" } },
      transaction: "/manage/SECRET",
      exception: { values: [{ value: "Failed to fetch /public/manage/SECRET" }] },
      breadcrumbs: [{ data: { url: "/public/manage/SECRET/cancel", from: "/manage/SECRET" } }],
    };
    scrubEvent(event);

    expect(JSON.stringify(event)).not.toContain("SECRET");
  });

  it("cleans a navigation breadcrumb on its own", () => {
    const breadcrumb = { data: { to: "/reset-password/t/SECRET" } };
    scrubBreadcrumb(breadcrumb);
    expect(breadcrumb.data.to).toBe("/reset-password/t/[redacted]");
  });
});
