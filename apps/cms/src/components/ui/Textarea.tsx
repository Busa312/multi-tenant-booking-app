import type { TextareaHTMLAttributes } from "react";
import { cx } from "../../lib/cx.js";
import styles from "./Textarea.module.css";

// Multi-line counterpart to TextInput, same visual language.
export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(styles.textarea, className)} {...rest} />;
}
