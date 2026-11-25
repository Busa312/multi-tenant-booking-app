import { manageUrl, shortManageUrl, tenantSiteOrigin } from "./tenant-url.js";

describe("manageUrl", () => {
  it("points back at the host the customer is already on", () => {
    expect(manageUrl("salon.ge", "tok")).toBe("https://salon.ge/manage/tok");
    expect(manageUrl("acme.platform.ge", "tok")).toBe("https://acme.platform.ge/manage/tok");
  });

  it("defaults to https — the URL carries a bearer token", () => {
    expect(manageUrl("salon.ge", "tok").startsWith("https://")).toBe(true);
  });

  it("keeps the port so a link works in local development", () => {
    expect(manageUrl("localhost:3000", "tok", "http")).toBe("http://localhost:3000/manage/tok");
  });

  it("encodes the token rather than trusting it to be URL-safe", () => {
    expect(manageUrl("salon.ge", "a/b?c")).toBe("https://salon.ge/manage/a%2Fb%3Fc");
  });
});

// R610: the reminder's link, built without a request to read the host from
describe("tenantSiteOrigin", () => {
  const tenant = { subdomain: "aura", customDomain: null, domainVerifiedAt: null };

  it("uses the salon's subdomain on the base domain", () => {
    expect(tenantSiteOrigin(tenant, { siteUrl: "https://public.internal", baseDomain: "book-it.ge" })).toBe("https://aura.book-it.ge");
  });

  it("prefers a verified custom domain, and only a verified one", () => {
    const custom = { ...tenant, customDomain: "aura.ge" };
    expect(tenantSiteOrigin({ ...custom, domainVerifiedAt: new Date() }, { baseDomain: "book-it.ge" })).toBe("https://aura.ge");
    expect(tenantSiteOrigin(custom, { baseDomain: "book-it.ge" })).toBe("https://aura.book-it.ge");
  });

  it("points at <subdomain>.localhost on the local booking site's port", () => {
    expect(tenantSiteOrigin(tenant, { siteUrl: "http://localhost:3000", baseDomain: "bukme.website" })).toBe("http://aura.localhost:3000");
  });

  it("can't build one with neither setting", () => {
    expect(tenantSiteOrigin(tenant, {})).toBeNull();
  });

  it("shortens the manage path for texts", () => {
    expect(shortManageUrl("https://aura.book-it.ge", "abc_-")).toBe("https://aura.book-it.ge/m/abc_-");
  });
});
