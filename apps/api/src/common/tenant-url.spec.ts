import { manageUrl } from "./tenant-url.js";

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
