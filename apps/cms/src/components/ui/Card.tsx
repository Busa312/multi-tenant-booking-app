import type { ComponentPropsWithoutRef, ElementType } from "react";
import { cx } from "../../lib/cx.js";

interface CardOwnProps<T extends ElementType> {
  /** Render as a different element — e.g. `as="form"` for a card that is itself a form. */
  as?: T;
  className?: string;
}

// `as` is typed by T, so `<Card as="form">` accepts form props such as `noValidate`.
type CardProps<T extends ElementType> = CardOwnProps<T> & Omit<ComponentPropsWithoutRef<T>, keyof CardOwnProps<T>>;

export function Card<T extends ElementType = "div">({ as, className, ...rest }: CardProps<T>) {
  const Tag: ElementType = as ?? "div";
  return <Tag className={cx("rounded-box border border-base-300 bg-base-100 p-5", className)} {...rest} />;
}
