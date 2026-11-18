/** R510: the grouping is shared with the booking site (`groupServices` in @booking/shared-types). */
export { groupServices, type ServiceGroup } from "@booking/shared-types";

/** `ids` with the item at `index` swapped one place up (-1) or down (+1). */
export function moved(ids: readonly string[], index: number, direction: -1 | 1): string[] {
  const next = [...ids];
  const other = index + direction;
  const a = next[index];
  const b = next[other];
  if (a === undefined || b === undefined) return next;
  next[index] = b;
  next[other] = a;
  return next;
}
