import type { ReactNode } from "react";
import { Link, type LinkProps } from "react-router-dom";
import { buttonClassName, buttonIconSize, type ButtonStyleProps } from "./buttonStyles.js";
import { Icon } from "./Icon.js";

interface ButtonLinkProps extends LinkProps, Omit<ButtonStyleProps, "iconOnly" | "danger"> {
  icon?: string;
  children?: ReactNode;
}

// react-router <Link> that looks like a Button — used where navigation, not an
// action, should carry button styling (e.g. row "Hours" link, dashboard CTA).
export function ButtonLink({ variant, size, fullWidth, icon, className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link className={buttonClassName({ variant, size, fullWidth }, className)} {...rest}>
      {icon && <Icon name={icon} size={buttonIconSize(size)} />}
      {children}
    </Link>
  );
}
