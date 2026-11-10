import type { TextareaHTMLAttributes } from "react";
import { cx } from "../../lib/cx.js";

// Multi-line counterpart to TextInput, same visual language.
export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx("textarea w-full", className)} {...rest} />;
}
