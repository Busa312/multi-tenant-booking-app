import { addCycle, billingConfig, parseCycle, parseDuration } from "./billing-config.js";

const at = (iso: string) => new Date(iso);

// R470/R480: system_design.md §12b
describe("billing settings", () => {
  it("reads durations, falling back on anything it can't read", () => {
    expect(parseDuration("30s", 1)).toBe(30_000);
    expect(parseDuration("10m", 1)).toBe(600_000);
    expect(parseDuration("2h", 1)).toBe(7_200_000);
    expect(parseDuration("7d", 1)).toBe(604_800_000);
    expect(parseDuration(undefined, 42)).toBe(42);
    expect(parseDuration("soon", 42)).toBe(42);
    expect(parseDuration("0d", 42)).toBe(42);
  });

  it("bills by calendar month unless a test environment sets a fixed length", () => {
    expect(parseCycle(undefined)).toEqual({ kind: "month" });
    expect(parseCycle("month")).toEqual({ kind: "month" });
    expect(parseCycle("10m")).toEqual({ kind: "fixed", ms: 600_000 });
    expect(parseCycle("nonsense")).toEqual({ kind: "month" });
  });

  it("renews on the same day and time next month, clamped to the month's end", () => {
    const month = { kind: "month" } as const;
    expect(addCycle(at("2026-11-17T09:30:00Z"), month)).toEqual(at("2026-12-17T09:30:00Z"));
    expect(addCycle(at("2026-12-17T09:30:00Z"), month)).toEqual(at("2027-01-17T09:30:00Z"));
    expect(addCycle(at("2027-01-31T10:00:00Z"), month)).toEqual(at("2027-02-28T10:00:00Z"));
    expect(addCycle(at("2028-01-31T10:00:00Z"), month)).toEqual(at("2028-02-29T10:00:00Z"));
    expect(addCycle(at("2026-11-17T09:30:00Z"), { kind: "fixed", ms: 600_000 })).toEqual(at("2026-11-17T09:40:00Z"));
  });

  it("needs both the merchant id and its key, or treats billing as off", () => {
    const env = (vars: Record<string, string>) => billingConfig((key) => vars[key]);
    expect(env({ FLITT_MERCHANT_ID: "1549901", FLITT_SECRET_KEY: "test" })).toMatchObject({ merchantId: 1549901, secretKey: "test" });
    expect(env({ FLITT_MERCHANT_ID: "1549901" })).toMatchObject({ merchantId: null, secretKey: null });
    expect(env({ FLITT_SECRET_KEY: "test" })).toMatchObject({ merchantId: null, secretKey: null });
    expect(env({ FLITT_MERCHANT_ID: "abc", FLITT_SECRET_KEY: "test" })).toMatchObject({ merchantId: null, secretKey: null });
  });

  it("keeps the defaults a production server needs: a month, 7 days' grace, a daily retry", () => {
    expect(billingConfig(() => undefined)).toMatchObject({
      cycle: { kind: "month" },
      graceMs: 7 * 86_400_000,
      retryMs: 86_400_000,
      apiPublicUrl: null,
      cmsUrl: "http://localhost:5173",
    });
    expect(billingConfig((key) => (key === "API_PUBLIC_URL" ? "https://api.example.com/" : undefined)).apiPublicUrl).toBe(
      "https://api.example.com",
    );
  });
});
