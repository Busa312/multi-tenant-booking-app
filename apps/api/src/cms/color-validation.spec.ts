import { isValidColor } from "./color-validation.js";

describe("isValidColor", () => {
  it.each(["#fff", "#FFF", "#0f172a", "#0F172A", "#123abc"])("accepts the hex color %p", (value) => {
    expect(isValidColor(value)).toBe(true);
  });

  it.each(["rgb(0,0,0)", "rgb(255, 255, 255)", "rgb( 15 , 23 , 42 )", "RGB(1,2,3)"])(
    "accepts the rgb color %p",
    (value) => {
      expect(isValidColor(value)).toBe(true);
    },
  );

  it.each(["#ff", "#ffff", "#fffff", "#fffffff", "#gggggg", "fff", "#", ""])(
    "rejects the malformed hex %p",
    (value) => {
      expect(isValidColor(value)).toBe(false);
    },
  );

  it("rejects an rgb component above 255", () => {
    expect(isValidColor("rgb(256,0,0)")).toBe(false);
    expect(isValidColor("rgb(0,999,0)")).toBe(false);
  });

  it("rejects rgb forms the CSS variable layer can't take", () => {
    expect(isValidColor("rgba(0,0,0,0.5)")).toBe(false);
    expect(isValidColor("rgb(0,0)")).toBe(false);
    expect(isValidColor("rgb(0%,0%,0%)")).toBe(false);
    expect(isValidColor("rgb(-1,0,0)")).toBe(false);
  });

  it("rejects named colors, which the tenant theming layer doesn't support", () => {
    expect(isValidColor("red")).toBe(false);
    expect(isValidColor("transparent")).toBe(false);
  });

  // The public site interpolates tenant colors straight into a server-rendered
  // <style> tag, so anything that could close that declaration must not pass.
  it.each([
    "#fff; } body { display: none } .x {",
    "#fff</style><script>alert(1)</script>",
    "red; background: url(javascript:alert(1))",
    "rgb(0,0,0); }",
    " #fff",
    "#fff ",
    "#fff\n",
    "expression(alert(1))",
  ])("rejects the style-injection payload %p", (value) => {
    expect(isValidColor(value)).toBe(false);
  });

  // The value arrives from an unvalidated JSON body, so it can be any type at
  // runtime regardless of what the compile-time type says.
  it.each([null, undefined, 0, 16777215, true, false, {}, [], ["#fff"], new Date()])(
    "returns false rather than throwing on the non-string %p",
    (value) => {
      expect(isValidColor(value)).toBe(false);
    },
  );

  it("narrows to string for the caller", () => {
    const value: unknown = "#0f172a";
    if (isValidColor(value)) {
      expect(value.toUpperCase()).toBe("#0F172A");
    } else {
      throw new Error("expected the guard to narrow");
    }
  });
});
