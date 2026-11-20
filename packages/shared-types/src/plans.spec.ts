import { planName } from "./plans";

// R550
describe("planName", () => {
  const plan = { name: "Early adopter", nameI18n: { ka: "ადრეული მომხმარებელი", ru: "Ранний доступ" } };

  it("names the plan in the reader's language", () => {
    expect(planName(plan, "ka")).toBe("ადრეული მომხმარებელი");
    expect(planName(plan, "ru")).toBe("Ранний доступ");
    expect(planName(plan, "en")).toBe("Early adopter");
  });

  it("falls back to the English name when a translation is missing or blank", () => {
    expect(planName({ name: "Studio", nameI18n: null }, "ka")).toBe("Studio");
    expect(planName({ name: "Studio", nameI18n: { ka: "  " } }, "ka")).toBe("Studio");
    expect(planName({ name: "Studio", nameI18n: { ka: "სტუდია" } }, "ru")).toBe("Studio");
  });
});
