import type { InputHTMLAttributes } from "react";
import { cx } from "../../lib/cx.js";

export function TextInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx("input w-full min-w-0", className)} {...rest} />;
}
