import { protocolFor } from "./host-tenant.middleware.js";

describe("protocolFor", () => {
  it("trusts a proxy's x-forwarded-proto above everything else", () => {
    expect(protocolFor({ "x-forwarded-proto": "https" }, "localhost:3000")).toBe("https");
    expect(protocolFor({ "x-forwarded-proto": "http" }, "salon.ge")).toBe("http");
  });

  it("reads only the first hop of a chained x-forwarded-proto", () => {
    expect(protocolFor({ "x-forwarded-proto": "https, http" }, "salon.ge")).toBe("https");
  });

  it("defaults to https for a real host", () => {
    expect(protocolFor({}, "salon.ge")).toBe("https");
    expect(protocolFor({}, "demo.platform.ge")).toBe("https");
  });

  it("uses http for loopback hosts, including tenant subdomains of localhost", () => {
    expect(protocolFor({}, "localhost:3000")).toBe("http");
    expect(protocolFor({}, "demo.localhost:3000")).toBe("http");
    expect(protocolFor({}, "127.0.0.1:3000")).toBe("http");
  });

  it("ignores a malformed forwarded value rather than trusting it", () => {
    expect(protocolFor({ "x-forwarded-proto": "gopher" }, "salon.ge")).toBe("https");
    expect(protocolFor({ "x-forwarded-proto": 42 }, "salon.ge")).toBe("https");
  });
});
