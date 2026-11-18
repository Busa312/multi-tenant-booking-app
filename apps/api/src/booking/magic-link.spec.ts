import { hashToken, issueToken, linkExpiresAt, MAGIC_LINK_GRACE_MS } from "./magic-link.js";

describe("magic-link tokens", () => {
  // R500: the token rides in an SMS, so it is 256 random bits in as few URL-safe characters as possible
  it("issues 43 URL-safe characters carrying 32 random bytes", () => {
    const { token } = issueToken(new Date());
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(token, "base64url")).toHaveLength(32);
  });

  it("never issues the same token twice", () => {
    const tokens = new Set(Array.from({ length: 1000 }, () => issueToken(new Date()).token));
    expect(tokens.size).toBe(1000);
  });

  // R230: only the hash is stored, and lookups go by it — so links issued in the old hex form keep working
  it("stores only the SHA-256 of the token", () => {
    const issued = issueToken(new Date());
    expect(issued.accessTokenHash).toBe(hashToken(issued.token));
    expect(issued.accessTokenHash).not.toContain(issued.token);
    expect(hashToken("a".repeat(64))).toMatch(/^[0-9a-f]{64}$/);
  });

  it("expires a day after the visit ends", () => {
    const endAt = new Date("2026-11-18T12:00:00Z");
    expect(issueToken(endAt).accessTokenExpiresAt).toEqual(linkExpiresAt(endAt));
    expect(linkExpiresAt(endAt).getTime() - endAt.getTime()).toBe(MAGIC_LINK_GRACE_MS);
  });
});
