import { parseHoldId } from "./slot-hold.js";

// R250: a hold id comes from the browser, so anything that isn't one is "no hold"
describe("parseHoldId", () => {
  it("accepts a UUID, normalised", () => {
    expect(parseHoldId(" 2222AAAA-2222-2222-2222-222222222222 ")).toBe("2222aaaa-2222-2222-2222-222222222222");
  });

  it.each([undefined, null, "", "not-a-uuid", 42, ["2222aaaa-2222-2222-2222-222222222222"]])(
    "treats %p as no hold rather than an error",
    (value) => {
      expect(parseHoldId(value)).toBeNull();
    },
  );
});
