import type { ReactNode } from "react";
import { cx } from "../../lib/cx.js";

interface EyebrowProps {
  children: ReactNode;
  className?: string;
}

// The quiet label above a card's headline. Sentence case, no tracking: it has
// to read the same in Georgian, which has no capitals to lean on.
export function Eyebrow({ children, className }: EyebrowProps) {
  return (
    <div className={cx("text-[13px] font-medium text-base-content/60", className)}>{children}</div>
  );
}
