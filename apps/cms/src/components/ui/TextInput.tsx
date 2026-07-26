import type { InputHTMLAttributes } from "react";
import { cx } from "../../lib/cx.js";
import styles from "./TextInput.module.css";

export function TextInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(styles.input, className)} {...rest} />;
}
