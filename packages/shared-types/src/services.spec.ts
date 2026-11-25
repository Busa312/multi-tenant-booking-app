import { groupServices, homeVisitFeeOf, offeredAt, offersHomeVisits } from "./services";

const category = (id: string, position: number) => ({ id, name: id, nameI18n: null, position });
const nails = category("nails", 0);
const lashes = category("lashes", 1);
const brows = category("brows", 2);
const service = (id: string, categoryId: string | null) => ({ id, categoryId });

// R510
describe("groupServices", () => {
  const services = [service("gel", "nails"), service("french", "nails"), service("classic", "lashes"), service("gift", null)];

  it("puts services under their categories, in the categories' order, uncategorized last", () => {
    expect(groupServices(services, [nails, lashes]).map((g) => [g.category?.id ?? null, g.services.map((s) => s.id)])).toEqual([
      ["nails", ["gel", "french"]],
      ["lashes", ["classic"]],
      [null, ["gift"]],
    ]);
  });

  it("leaves out an empty category on the booking site, keeps it in the CMS", () => {
    expect(groupServices(services, [nails, lashes, brows]).map((g) => g.category?.id ?? null)).toEqual(["nails", "lashes", null]);
    expect(groupServices(services, [nails, lashes, brows], { keepEmpty: true }).map((g) => g.category?.id ?? null)).toEqual([
      "nails",
      "lashes",
      "brows",
      null,
    ]);
  });

  it("is one plain group for a salon with no categories", () => {
    expect(groupServices(services.map((s) => ({ ...s, categoryId: null })), [])).toEqual([
      { category: null, services: services.map((s) => ({ ...s, categoryId: null })) },
    ]);
    expect(groupServices([], [])).toEqual([{ category: null, services: [] }]);
  });

  it("files a service whose category is gone under the uncategorized ones", () => {
    expect(groupServices([service("orphan", "deleted")], [nails]).map((g) => [g.category?.id ?? null, g.services.length])).toEqual([[null, 1]]);
  });
});

// R630
describe("offeredAt", () => {
  it("offers a service where it's set up, and 'either' at both", () => {
    expect(offeredAt("business", "business")).toBe(true);
    expect(offeredAt("business", "customer")).toBe(false);
    expect(offeredAt("customer", "business")).toBe(false);
    expect(offeredAt("either", "customer")).toBe(true);
  });

  it("asks where only when something can be done at the customer's address", () => {
    expect(offersHomeVisits([{ place: "business" }])).toBe(false);
    expect(offersHomeVisits([{ place: "business" }, { place: "either" }])).toBe(true);
  });
});

describe("homeVisitFeeOf", () => {
  it("charges the salon's fee once, when it applies to any service of the visit", () => {
    expect(homeVisitFeeOf([{ homeVisitFeeApplies: false }, { homeVisitFeeApplies: true }], "10.00")).toBe("10.00");
    expect(homeVisitFeeOf([{ homeVisitFeeApplies: false }], "10.00")).toBe("0");
    expect(homeVisitFeeOf([{ homeVisitFeeApplies: true }], "0")).toBe("0");
  });
});
