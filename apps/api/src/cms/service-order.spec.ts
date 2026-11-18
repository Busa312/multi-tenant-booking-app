import { BadRequestException, NotFoundException } from "@nestjs/common";
import type { Prisma } from "../../generated/prisma/index.js";
import { categoryIdIn, nextServicePosition, validateOrder } from "./service-order.js";

const TENANT = "11111111-1111-1111-1111-111111111111";

// R510
describe("validateOrder", () => {
  it("accepts every current item exactly once, in the new order", () => {
    expect(validateOrder(["c", "a", "b"], ["a", "b", "c"])).toEqual(["c", "a", "b"]);
  });

  it("refuses a partial, stale, duplicated or foreign list rather than guessing", () => {
    expect(() => validateOrder(["a", "b"], ["a", "b", "c"])).toThrow(BadRequestException);
    expect(() => validateOrder(["a", "a", "b"], ["a", "b", "c"])).toThrow(BadRequestException);
    expect(() => validateOrder(["a", "b", "x"], ["a", "b", "c"])).toThrow(BadRequestException);
    expect(() => validateOrder("a,b,c", ["a", "b", "c"])).toThrow(BadRequestException);
  });
});

describe("categoryIdIn", () => {
  const tx = (found: boolean) =>
    ({
      serviceCategory: { findFirst: jest.fn().mockResolvedValue(found ? { id: "cat-1" } : null) },
    }) as unknown as Prisma.TransactionClient;

  it("treats no category as uncategorized", async () => {
    await expect(categoryIdIn(tx(true), TENANT, null)).resolves.toBeNull();
    await expect(categoryIdIn(tx(true), TENANT, undefined)).resolves.toBeNull();
  });

  it("only accepts this salon's own categories — another salon's is simply not found", async () => {
    await expect(categoryIdIn(tx(true), TENANT, "cat-1")).resolves.toBe("cat-1");
    await expect(categoryIdIn(tx(false), TENANT, "cat-of-another-salon")).rejects.toThrow(NotFoundException);
    await expect(categoryIdIn(tx(true), TENANT, 42)).rejects.toThrow(BadRequestException);
  });
});

describe("nextServicePosition", () => {
  const tx = (max: number | null) =>
    ({ service: { aggregate: jest.fn().mockResolvedValue({ _max: { position: max } }) } }) as unknown as Prisma.TransactionClient;

  it("puts a new or moved service last in its category", async () => {
    await expect(nextServicePosition(tx(4), TENANT, "cat-1")).resolves.toBe(5);
    await expect(nextServicePosition(tx(null), TENANT, null)).resolves.toBe(0);
  });
});
