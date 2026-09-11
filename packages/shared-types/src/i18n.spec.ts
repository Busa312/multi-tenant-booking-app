import { DEFAULT_CONTENT_LOCALE, defaultLocaleOf, localized } from "./i18n";

// R160: these pin the *rule*

describe("localized", () => {
  it("returns the plain column for the default locale, ignoring the map entirely", () => {
    expect(localized("Haircut", { en: "STALE" }, "en", "en")).toBe("Haircut");
  });

  it("returns the translation for a non-default locale", () => {
    expect(localized("Haircut", { ka: "შეჭრა" }, "ka", "en")).toBe("შეჭრა");
  });

  it("falls back to the plain column when the locale is untranslated", () => {
    expect(localized("Haircut", { ru: "Стрижка" }, "ka", "en")).toBe("Haircut");
    expect(localized("Haircut", null, "ka", "en")).toBe("Haircut");
    expect(localized("Haircut", undefined, "ka", "en")).toBe("Haircut");
  });

  it("treats a blank translation as untranslated rather than rendering a hole", () => {
    expect(localized("Haircut", { ka: "" }, "ka", "en")).toBe("Haircut");
    expect(localized("Haircut", { ka: "   " }, "ka", "en")).toBe("Haircut");
  });

  it("falls back rather than throwing when the map is malformed", () => {
    expect(localized("Haircut", "not an object", "ka", "en")).toBe("Haircut");
    expect(localized("Haircut", ["ka"], "ka", "en")).toBe("Haircut");
    expect(localized("Haircut", 42, "ka", "en")).toBe("Haircut");
    expect(localized("Haircut", { ka: 42 }, "ka", "en")).toBe("Haircut");
  });
});

describe("defaultLocaleOf", () => {
  it("is the first enabled locale", () => {
    expect(defaultLocaleOf(["ka", "en"])).toBe("ka");
  });

  it("falls back to the platform default when a tenant has none configured", () => {
    expect(defaultLocaleOf([])).toBe(DEFAULT_CONTENT_LOCALE);
    expect(defaultLocaleOf(undefined)).toBe(DEFAULT_CONTENT_LOCALE);
  });
});
