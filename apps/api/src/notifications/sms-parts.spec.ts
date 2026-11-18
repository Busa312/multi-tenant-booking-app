import { smsParts } from "./sms-parts.js";

// R500: usage counts texts the way the provider bills them
describe("smsParts", () => {
  it("fits up to 160 plain Latin characters in one part, then 153 per part", () => {
    expect(smsParts("Your booking code is 123456")).toBe(1);
    expect(smsParts("a".repeat(160))).toBe(1);
    expect(smsParts("a".repeat(161))).toBe(2);
    expect(smsParts("a".repeat(306))).toBe(2);
    expect(smsParts("a".repeat(307))).toBe(3);
  });

  it("counts GSM-7 extension characters twice", () => {
    expect(smsParts("{".repeat(80))).toBe(1);
    expect(smsParts("{".repeat(81))).toBe(2);
  });

  it("makes the whole text Unicode for a single Georgian letter: 70, then 67 per part", () => {
    expect(smsParts("ა")).toBe(1);
    expect(smsParts("ა".repeat(70))).toBe(1);
    expect(smsParts("ა".repeat(71))).toBe(2);
    expect(smsParts(`${"a".repeat(100)}ა`)).toBe(2);
  });

  it("bills the booking-link text we actually send as one part", () => {
    const link = `https://my-salon.bukme.website/manage/${"x".repeat(43)}`;
    expect(smsParts(`Your booking is confirmed. View, change or cancel it: ${link}`)).toBe(1);
  });
});
