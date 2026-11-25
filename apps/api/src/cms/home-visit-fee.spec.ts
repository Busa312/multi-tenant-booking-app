import { BadRequestException } from "@nestjs/common";
import { parseHomeVisitFee } from "./tenant.controller.js";

// R630: the salon's one home-visit fee; 0 = none
describe("parseHomeVisitFee", () => {
  it("leaves it unchanged when not sent, and empties it to no fee", () => {
    expect(parseHomeVisitFee(undefined)).toBeUndefined();
    expect(parseHomeVisitFee(null)).toBe("0");
    expect(parseHomeVisitFee("")).toBe("0");
    expect(parseHomeVisitFee("0")).toBe("0");
  });

  it("takes an amount with up to two decimals, a comma read as a point", () => {
    expect(parseHomeVisitFee("10")).toBe("10");
    expect(parseHomeVisitFee(" 12,50 ")).toBe("12.50");
    expect(parseHomeVisitFee(15)).toBe("15");
  });

  it.each(["-5", "abc", "1.234", "123456789"])("refuses %s", (value) => {
    expect(() => parseHomeVisitFee(value)).toThrow(BadRequestException);
  });
});
