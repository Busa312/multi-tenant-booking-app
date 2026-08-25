import { BadRequestException } from "@nestjs/common";
import { validateBusinessInfo, validateSeo } from "./seo-validation.js";

describe("validateSeo", () => {
  it("keeps and trims the fields a tenant supplied", () => {
    expect(
      validateSeo({
        title: "  Acme Salon — Book online  ",
        description: "  Haircuts and colour in central Tbilisi.  ",
        ogImageUrl: "https://cdn.example.com/share.png",
      }),
    ).toEqual({
      title: "Acme Salon — Book online",
      description: "Haircuts and colour in central Tbilisi.",
      ogImageUrl: "https://cdn.example.com/share.png",
    });
  });

  it.each([undefined, null, ""])("drops a field cleared with %p rather than storing it empty", (value) => {
    // Absent is what the public site's fallback chain reads; an empty string
    // would win the fallback and render a blank description.
    expect(validateSeo({ description: value })).toEqual({});
  });

  it.each([{}, { title: "" }])("accepts %p as clearing everything", (input) => {
    expect(validateSeo(input)).toEqual({});
  });

  describe("length caps", () => {
    it("accepts a title at exactly the limit", () => {
      expect(validateSeo({ title: "a".repeat(70) }).title).toHaveLength(70);
    });

    it("rejects a title one character over", () => {
      expect(() => validateSeo({ title: "a".repeat(71) })).toThrow(BadRequestException);
    });

    it("accepts a description at exactly the limit", () => {
      expect(validateSeo({ description: "a".repeat(200) }).description).toHaveLength(200);
    });

    it("rejects a description one character over", () => {
      expect(() => validateSeo({ description: "a".repeat(201) })).toThrow(BadRequestException);
    });
  });

  // These strings land in <meta content="..."> and inside a JSON-LD data block.
  // The public site escapes `<` on the way out; refusing it here as well means a
  // stored row can never rely on that one escape being correct.
  it.each([
    "</script><script>alert(1)</script>",
    "Acme <b>Salon</b>",
    "<!-- comment",
  ])("rejects the angle-bracket payload %p in a title", (value) => {
    expect(() => validateSeo({ title: value })).toThrow(BadRequestException);
  });

  it("rejects angle brackets in a description too", () => {
    expect(() => validateSeo({ description: "a </script> b" })).toThrow(BadRequestException);
  });

  describe("ogImageUrl", () => {
    it("accepts an absolute https URL", () => {
      expect(validateSeo({ ogImageUrl: "https://cdn.example.com/a.png" }).ogImageUrl).toBe(
        "https://cdn.example.com/a.png",
      );
    });

    // Several social scrapers drop non-https images, and an http image on an
    // https page is a mixed-content warning.
    it("rejects http", () => {
      expect(() => validateSeo({ ogImageUrl: "http://cdn.example.com/a.png" })).toThrow(BadRequestException);
    });

    it.each(["javascript:alert(1)", "data:image/png;base64,AAAA", "/relative.png", "cdn.example.com/a.png"])(
      "rejects %p",
      (value) => {
        expect(() => validateSeo({ ogImageUrl: value })).toThrow(BadRequestException);
      },
    );

    it("rejects a URL carrying a quote that would break out of the attribute", () => {
      expect(() => validateSeo({ ogImageUrl: 'https://x.test/a.png" onload="alert(1)' })).toThrow(
        BadRequestException,
      );
    });
  });

  describe("noindex", () => {
    it("stores an explicit opt-out", () => {
      expect(validateSeo({ noindex: true })).toEqual({ noindex: true });
    });

    // Indexability is computed; a tenant's flag may only ever hide. Storing
    // `false` would read as "this tenant insists on being indexed".
    it("does not store noindex: false", () => {
      expect(validateSeo({ noindex: false })).toEqual({});
    });

    it("rejects a non-boolean", () => {
      expect(() => validateSeo({ noindex: "yes" })).toThrow(BadRequestException);
    });
  });

  // The body is unvalidated JSON at runtime whatever the TypeScript type says,
  // so these must fail cleanly rather than throw a TypeError into a 500.
  it.each([null, undefined, 42, "a string", [], [{ title: "x" }]])("rejects %p as the seo object", (value) => {
    expect(() => validateSeo(value)).toThrow(BadRequestException);
  });

  // `null` is absent from this list on purpose — it means "clear", covered above.
  it.each([42, true, [], {}, ["x"]])("rejects the non-string title %p", (value) => {
    expect(() => validateSeo({ title: value })).toThrow(BadRequestException);
  });
});

describe("validateBusinessInfo", () => {
  it("keeps and trims the address fields", () => {
    expect(
      validateBusinessInfo({
        streetAddress: " 12 Rustaveli Ave ",
        city: "Tbilisi",
        region: "Tbilisi",
        postalCode: "0108",
        country: "GE",
        telephone: "+995 555 00 00 00",
      }),
    ).toEqual({
      streetAddress: "12 Rustaveli Ave",
      city: "Tbilisi",
      region: "Tbilisi",
      postalCode: "0108",
      country: "GE",
      telephone: "+995 555 00 00 00",
    });
  });

  it("drops cleared fields", () => {
    expect(validateBusinessInfo({ city: "", telephone: null })).toEqual({});
  });

  it("rejects angle brackets in an address", () => {
    expect(() => validateBusinessInfo({ city: "Tbilisi<script>" })).toThrow(BadRequestException);
  });

  describe("coordinates", () => {
    it("keeps a valid pair", () => {
      expect(validateBusinessInfo({ latitude: 41.7151, longitude: 44.8271 })).toEqual({
        latitude: 41.7151,
        longitude: 44.8271,
      });
    });

    // A lone coordinate locates nothing, and half a pair would just be discarded
    // at render time — so it is refused at the door instead.
    it.each([
      ["latitude only", { latitude: 41.7151 }],
      ["longitude only", { longitude: 44.8271 }],
    ])("rejects %s", (_label, input) => {
      expect(() => validateBusinessInfo(input)).toThrow("latitude and longitude must be provided together");
    });

    it("accepts neither", () => {
      expect(validateBusinessInfo({ city: "Tbilisi" })).toEqual({ city: "Tbilisi" });
    });

    it.each([
      [91, 0.1],
      [-91, 0.1],
      [0.1, 181],
      [0.1, -181],
    ])("rejects out-of-range (%p, %p)", (latitude, longitude) => {
      expect(() => validateBusinessInfo({ latitude, longitude })).toThrow(BadRequestException);
    });

    // (0, 0) is in the Gulf of Guinea and is what an empty number input submits,
    // so it means "unset" far more often than it means a real salon.
    it("rejects the null island", () => {
      expect(() => validateBusinessInfo({ latitude: 0, longitude: 0 })).toThrow(BadRequestException);
    });

    it.each(["41.7151", null, {}])("rejects the non-numeric latitude %p", (latitude) => {
      expect(() => validateBusinessInfo({ latitude, longitude: 44.8271 })).toThrow(BadRequestException);
    });
  });

  it.each([null, 42, "x", []])("rejects %p as the business object", (value) => {
    expect(() => validateBusinessInfo(value)).toThrow(BadRequestException);
  });
});
