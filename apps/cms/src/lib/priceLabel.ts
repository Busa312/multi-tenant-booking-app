/**
 * R520: a price as shown in the CMS — "45 ₾", or "from 45 ₾" when it's a
 * starting price (a service's, or a booking that includes one).
 */
export function priceLabel(t: (key: string, vars?: Record<string, string | number>) => string, price: string, from: boolean): string {
  return t(from ? "services.priceFromValue" : "services.priceValue", { price });
}
