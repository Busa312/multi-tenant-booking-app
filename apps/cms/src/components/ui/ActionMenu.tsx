import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { Icon } from "./Icon.js";
import { cx } from "../../lib/cx.js";
import styles from "./ActionMenu.module.css";

export interface ActionMenuItem {
  label: string;
  /** Renders a real router link instead of a button — keeps middle-click and
   *  open-in-new-tab working for navigation items. Mutually exclusive with onSelect. */
  to?: string;
  onSelect?: () => void;
  /** Material Symbols ligature, e.g. "delete". */
  icon?: string;
  danger?: boolean;
}

interface ActionMenuProps {
  items: ActionMenuItem[];
  /** Names the trigger — rows have several of these, so it should identify the row. */
  ariaLabel: string;
  className?: string;
}

/** Anchored below the trigger, or above it when the viewport bottom is close. */
type MenuPosition = { right: number; top?: number; bottom?: number };

// Breathing room between trigger and panel, in px.
const GAP = 6;

/**
 * Kebab (⋮) menu button following the WAI-ARIA APG menu-button pattern, used to
 * collapse a table row's actions into one control.
 *
 * The panel is portaled to `document.body` and positioned with `fixed`
 * coordinates measured from the trigger, because its natural home — a table row
 * — sits inside `Table`'s `overflow: hidden` and the page's horizontally
 * scrolling wrapper, either of which would clip an in-flow dropdown. The
 * tradeoff of leaving the flow is that the coordinates go stale on scroll, so
 * the menu closes on any scroll or resize rather than drifting away from its
 * row.
 *
 * Unlike Select, focus really does move into the panel here: menu items are
 * links and buttons, which is what the menu pattern expects.
 */
export function ActionMenu({ items, ariaLabel, className }: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = `${useId()}-menu`;

  const close = useCallback((refocus: boolean) => {
    setOpen(false);
    setPosition(null);
    if (refocus) {
      triggerRef.current?.focus();
    }
  }, []);

  // Positioned after mount rather than on open, because placement depends on the
  // rendered height: a row near the bottom of the viewport — routine on a phone,
  // where the whole table is barely taller than the screen — would otherwise
  // open its menu below the fold. Hidden until measured so it can't be seen
  // jumping from one placement to the other.
  useLayoutEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current?.getBoundingClientRect();
    const menu = menuRef.current?.getBoundingClientRect();
    if (!trigger || !menu) return;

    const right = window.innerWidth - trigger.right;
    const spaceBelow = window.innerHeight - trigger.bottom;
    setPosition(
      spaceBelow < menu.height + GAP && trigger.top > spaceBelow
        ? { bottom: window.innerHeight - trigger.top + GAP, right }
        : { top: trigger.bottom + GAP, right },
    );

    menuRef.current?.querySelector<HTMLElement>("[data-item]")?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    function handlePointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (!menuRef.current?.contains(target) && !triggerRef.current?.contains(target)) {
        close(false);
      }
    }
    // Capture phase: scroll doesn't bubble, and the culprit is usually an inner
    // container (the table's horizontal scroller) rather than the window.
    function handleScrollOrResize() {
      close(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [open, close]);

  function focusItem(offset: number) {
    const nodes = Array.from(menuRef.current?.querySelectorAll<HTMLElement>("[data-item]") ?? []);
    if (nodes.length === 0) return;
    const current = nodes.findIndex((n) => n === document.activeElement);
    // Wraps, so ArrowDown past the last item returns to the first.
    const next = (current + offset + nodes.length) % nodes.length;
    nodes[next]?.focus();
  }

  function handleTriggerKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen(true);
    }
  }

  function handleMenuKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        focusItem(1);
        return;
      case "ArrowUp":
        e.preventDefault();
        focusItem(-1);
        return;
      case "Escape":
        e.preventDefault();
        close(true);
        return;
      case "Tab":
        close(false);
    }
  }

  return (
    <div className={cx(styles.root, className)}>
      <button
        type="button"
        ref={triggerRef}
        className={styles.trigger}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => (open ? close(false) : setOpen(true))}
        onKeyDown={handleTriggerKeyDown}
      >
        <Icon name="more_vert" size={20} />
      </button>

      {open &&
        createPortal(
          <div
            id={menuId}
            role="menu"
            ref={menuRef}
            className={styles.menu}
            style={{ ...position, visibility: position ? "visible" : "hidden" }}
            onKeyDown={handleMenuKeyDown}
          >
            {items.map((item) =>
              item.to !== undefined ? (
                <Link
                  key={item.label}
                  to={item.to}
                  data-item
                  role="menuitem"
                  className={styles.item}
                  onClick={() => close(false)}
                >
                  {item.icon && <Icon name={item.icon} size={18} />}
                  {item.label}
                </Link>
              ) : (
                <button
                  key={item.label}
                  type="button"
                  data-item
                  role="menuitem"
                  className={cx(styles.item, item.danger && styles.danger)}
                  onClick={() => {
                    close(false);
                    item.onSelect?.();
                  }}
                >
                  {item.icon && <Icon name={item.icon} size={18} />}
                  {item.label}
                </button>
              ),
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
