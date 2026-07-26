import type { ComponentPropsWithoutRef, ElementType } from "react";
import { cx } from "../../lib/cx.js";
import styles from "./Card.module.css";

interface CardOwnProps {
  /** Render as a different element — e.g. `as="form"` for a card that is itself a form. */
  as?: ElementType;
  className?: string;
}

type CardProps<T extends ElementType> = CardOwnProps & Omit<ComponentPropsWithoutRef<T>, keyof CardOwnProps>;

export function Card<T extends ElementType = "div">({ as, className, ...rest }: CardProps<T>) {
  const Tag = as ?? "div";
  return <Tag className={cx(styles.card, className)} {...rest} />;
}
