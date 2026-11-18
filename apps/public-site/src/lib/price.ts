import type { Translate } from "@/i18n/locales";

/** R520: "45 ₾", or "from 45 ₾" for a starting price — a service's, or a total that includes one. */
export function priceText(t: Translate, price: string, from: boolean): string {
  return t(from ? "common.priceFrom" : "common.price", { price });
}
