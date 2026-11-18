import { flittSignature, verifyFlittSignature } from "./flitt-signature.js";

// R470: Flitt's protocol 1.0.1 signature (system_design.md §12b)
describe("flittSignature", () => {
  // Hashed independently: printf 'test|6000|GEL|1549901|Fixture|o-1|0' | shasum -a 1
  const params = {
    order_id: "o-1",
    merchant_id: 1549901,
    amount: "6000",
    currency: "GEL",
    order_desc: "Fixture",
    reversal_amount: "0",
    rrn: "",
    response_signature_string: "**test mode only**",
  };
  const expected = "abcac26d20b0b258e37dcda2f9488b4a1e1d5cde";

  it("hashes the secret, then the values sorted by name — empties dropped, a zero kept", () => {
    expect(flittSignature("test", params)).toBe(expected);
  });

  it("never signs the signature itself", () => {
    expect(flittSignature("test", { ...params, signature: "whatever" })).toBe(expected);
  });

  it("verifies a genuine answer and nothing else", () => {
    expect(verifyFlittSignature("test", { ...params, signature: expected })).toBe(true);
    expect(verifyFlittSignature("test", { ...params, signature: expected.toUpperCase() })).toBe(true);
    expect(verifyFlittSignature("test", { ...params, amount: "1", signature: expected })).toBe(false);
    expect(verifyFlittSignature("another key", { ...params, signature: expected })).toBe(false);
    expect(verifyFlittSignature("test", { ...params, signature: "short" })).toBe(false);
    expect(verifyFlittSignature("test", params)).toBe(false);
  });
});
