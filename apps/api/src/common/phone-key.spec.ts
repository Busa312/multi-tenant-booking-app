import { phoneKey } from "./phone-key.js";

describe("phoneKey", () => {
  it("gives one key to the same Georgian mobile however it was typed", () => {
    const key = phoneKey("+995598550594");
    expect(key).toBe("995598550594");
    expect(phoneKey("598550594")).toBe(key);
    expect(phoneKey("598 55 05 94")).toBe(key);
    expect(phoneKey("00995 598-550-594")).toBe(key);
  });

  it("keeps different phones apart", () => {
    expect(phoneKey("598550594")).not.toBe(phoneKey("598550595"));
  });

  it("falls back to the bare digits of a number it can't read as international", () => {
    expect(phoneKey("123-123")).toBe("123123");
  });

  it("is empty when there are no digits", () => {
    expect(phoneKey("call me")).toBe("");
  });
});
