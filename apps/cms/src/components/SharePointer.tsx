import { cx } from "../lib/cx.js";
import { iosBrowser, sharePosition } from "../lib/iosBrowser.js";
import { Icon } from "./ui/Icon.js";

const PLACEMENT = {
  bottom: "bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] left-1/2 -translate-x-1/2",
  "bottom-end": "bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] right-4",
  "top-end": "top-[calc(env(safe-area-inset-top)+0.75rem)] right-4",
} as const;

const ARROW = { bottom: "arrow_downward", "bottom-end": "south_east", "top-end": "north_east" } as const;

// R620: on iPhone and iPad, points at the edge of the screen where the
// browser's Share button is — the one step people can't find on their own.
// Decorative: the steps say the same in words.
export function SharePointer() {
  const position = sharePosition(iosBrowser());
  if (!position) return null;
  return (
    <div
      aria-hidden="true"
      className={cx(
        "pointer-events-none fixed z-50 flex size-11 items-center justify-center rounded-full bg-accent text-accent-content",
        "animate-bounce motion-reduce:animate-none",
        PLACEMENT[position],
      )}
    >
      <Icon name={ARROW[position]} size={26} />
    </div>
  );
}
