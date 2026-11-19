import { DEFAULT_CONTENT_LOCALE, defaultLocaleOf, enabledLocalesOf, localized, localizedAddress } from "./i18n";

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

describe("localizedAddress", () => {
  const vake = {
    addressLine: "12 Chavchavadze Ave",
    addressLineI18n: { ka: "ჭავჭავაძის გამზ. 12" },
    city: "Tbilisi",
    cityI18n: { ka: "თბილისი" },
  };
  const pick = (locale: string) => (plain: string, i18n: unknown) => localized(plain, i18n, locale, "en");

  it("translates the street and the city together", () => {
    expect(localizedAddress(vake, pick("ka"))).toBe("ჭავჭავაძის გამზ. 12, თბილისი");
    expect(localizedAddress(vake, pick("en"))).toBe("12 Chavchavadze Ave, Tbilisi");
  });

  it("falls back per part, so a missing city translation still shows the city", () => {
    expect(localizedAddress({ ...vake, cityI18n: null }, pick("ka"))).toBe("ჭავჭავაძის გამზ. 12, Tbilisi");
  });

  it("is just the line when there's no city", () => {
    expect(localizedAddress({ ...vake, city: null }, pick("ka"))).toBe("ჭავჭავაძის გამზ. 12");
  });
});

// R570
describe("enabledLocalesOf", () => {
  it("keeps Russian off until an owner switches it on", () => {
    expect(enabledLocalesOf(undefined)).toEqual(["en", "ka"]);
    expect(enabledLocalesOf(["ka", "ru"])).toEqual(["ka", "ru"]);
  });

  it("drops a language the platform doesn't publish in", () => {
    expect(enabledLocalesOf(["ka", "de"])).toEqual(["ka"]);
  });
});
