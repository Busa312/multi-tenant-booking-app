import type { ReactNode } from "react";
import { cx } from "../../lib/cx.js";

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  children: ReactNode;
}

// Checkbox + inline label as one clickable row.
export function Checkbox({ checked, onChange, disabled, children }: CheckboxProps) {
  return (
    <label
      className={cx(
        "flex cursor-pointer items-center gap-2.5 py-1 text-sm",
        disabled === true && "cursor-not-allowed opacity-50",
      )}
    >
      <input
        type="checkbox"
        className="checkbox checkbox-sm checkbox-primary"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      {children}
    </label>
  );
}
