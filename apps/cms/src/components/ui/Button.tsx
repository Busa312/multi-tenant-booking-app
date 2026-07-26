import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon } from "./Icon.js";
import { buttonClassName, buttonIconSize, type ButtonStyleProps } from "./buttonStyles.js";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, ButtonStyleProps {
  icon?: string;
  children?: ReactNode;
}

export function Button({
  variant,
  size,
  fullWidth,
  iconOnly,
  danger,
  icon,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={buttonClassName({ variant, size, fullWidth, iconOnly, danger }, className)}
      {...rest}
    >
      {icon && <Icon name={icon} size={buttonIconSize(size)} />}
      {children}
    </button>
  );
}
