import type { FastifyRequest } from "fastify";
import { clientAddress, parseTrustProxy } from "./client-address.js";

// R330: who a request is counted against — and that nobody can choose it
const request = (ip: string, headers: Record<string, string> = {}) => ({ ip, headers }) as unknown as FastifyRequest;
const KEY = "s3cret-public-site-key";

describe("clientAddress", () => {
  it("uses the connection's address (as resolved through the trusted proxy)", () => {
    expect(clientAddress(request("203.0.113.7"), KEY)).toBe("203.0.113.7");
  });

  it("believes the public site's visitor address when it comes with the shared key", () => {
    expect(clientAddress(request("10.0.0.2", { "x-visitor-ip": "198.51.100.4", "x-public-site-key": KEY }), KEY)).toBe(
      "198.51.100.4",
    );
  });

  it("ignores a visitor address sent without the key, or with the wrong one", () => {
    expect(clientAddress(request("203.0.113.7", { "x-visitor-ip": "1.2.3.4" }), KEY)).toBe("203.0.113.7");
    expect(clientAddress(request("203.0.113.7", { "x-visitor-ip": "1.2.3.4", "x-public-site-key": "guess" }), KEY)).toBe(
      "203.0.113.7",
    );
  });

  it("ignores it when no key is configured at all", () => {
    expect(clientAddress(request("203.0.113.7", { "x-visitor-ip": "1.2.3.4", "x-public-site-key": "" }), undefined)).toBe(
      "203.0.113.7",
    );
  });

  it("ignores a visitor 'address' that isn't one", () => {
    expect(clientAddress(request("203.0.113.7", { "x-visitor-ip": "evil, 1.2.3.4", "x-public-site-key": KEY }), KEY)).toBe(
      "203.0.113.7",
    );
  });
});

describe("parseTrustProxy", () => {
  it("trusts nothing by default", () => {
    expect(parseTrustProxy(undefined)).toBe(false);
    expect(parseTrustProxy("false")).toBe(false);
  });

  it("takes a hop count or proxy addresses", () => {
    expect(parseTrustProxy("1")).toBe(1);
    expect(parseTrustProxy("10.0.0.0/8, 127.0.0.1")).toBe("10.0.0.0/8, 127.0.0.1");
  });

  it("refuses blanket trust — that would let clients pick their own address", () => {
    expect(() => parseTrustProxy("true")).toThrow();
  });
});
