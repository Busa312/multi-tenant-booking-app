import { BadRequestException, NotFoundException } from "@nestjs/common";
import type { Prisma } from "../../generated/prisma/index.js";

/**
 * R510: the price-list order — by category (uncategorized last: Postgres sorts
 * NULL last ascending), then within it — so even a plain list, like a booking
 * form's picker, reads in the salon's order.
 */
export const SERVICE_ORDER = [
  { category: { position: "asc" } },
  { position: "asc" },
  { createdAt: "asc" },
] satisfies Prisma.ServiceOrderByWithRelationInput[];

/**
 * R510: shared by the service and category endpoints — which category a
 * request means, where something new goes, and whether a new order is a
 * complete one.
 */

/**
 * A category id from a request, checked against this tenant's own categories
 * (RLS hides everyone else's, so another salon's id is simply "not found").
 * null/undefined = uncategorized.
 */
export async function categoryIdIn(
  tx: Prisma.TransactionClient,
  tenantId: string,
  categoryId: unknown,
): Promise<string | null> {
  if (categoryId === null || categoryId === undefined) return null;
  if (typeof categoryId !== "string") throw new BadRequestException("categoryId must be a category's id or null");
  const category = await tx.serviceCategory.findFirst({ where: { id: categoryId, tenantId }, select: { id: true } });
  if (!category) throw new NotFoundException("Category not found");
  return category.id;
}

/** The position after the last service in that category (or among the uncategorized). */
export async function nextServicePosition(
  tx: Prisma.TransactionClient,
  tenantId: string,
  categoryId: string | null,
): Promise<number> {
  const { _max } = await tx.service.aggregate({ where: { tenantId, categoryId }, _max: { position: true } });
  return (_max.position ?? -1) + 1;
}

/**
 * A new order must name every current item exactly once — a partial or
 * stale list (another tab added something meanwhile) is refused rather than
 * guessed at.
 */
export function validateOrder(ids: unknown, current: readonly string[]): string[] {
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string")) {
    throw new BadRequestException("ids must be a list of ids");
  }
  const given = ids as string[];
  const expected = new Set(current);
  if (given.length !== expected.size || new Set(given).size !== given.length || given.some((id) => !expected.has(id))) {
    throw new BadRequestException("ids must list every item exactly once — reload and try again");
  }
  return given;
}
