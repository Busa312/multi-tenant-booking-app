import { groupServices } from "./services";

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
