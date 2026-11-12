import { maskSmsNumber, toSmsNumber } from "./sms-number.js";

describe("toSmsNumber", () => {
  it("adds Georgia's country code to a 9-digit mobile number, however it was typed", () => {
    expect(toSmsNumber("555 12 34 56")).toBe("995555123456");
    expect(toSmsNumber("555-123-456")).toBe("995555123456");
  });

  it("keeps an international number, dropping + or 00", () => {
    expect(toSmsNumber("+995 555 12 34 56")).toBe("995555123456");
    expect(toSmsNumber("00995555123456")).toBe("995555123456");
    expect(toSmsNumber("+44 7700 900123")).toBe("447700900123");
  });

  it("refuses what can't be dialled, so no send is paid for", () => {
    expect(toSmsNumber("12345")).toBeNull();
    expect(toSmsNumber("322 123 456")).toBeNull(); // landline without a country code
    expect(toSmsNumber("1234567890123456")).toBeNull();
    expect(toSmsNumber("")).toBeNull();
  });
});

describe("maskSmsNumber", () => {
  it("keeps only the last three digits", () => {
    expect(maskSmsNumber("995555123456")).toBe("…456");
  });
});
