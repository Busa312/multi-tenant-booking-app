import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Icon } from "./Icon.js";
import { cx } from "../../lib/cx.js";
import styles from "./Select.module.css";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  /** Current value; when it matches no option, `placeholder` is shown instead. */
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  /** Set this and point the wrapping Field's htmlFor at it to name the control. */
  id?: string;
  /** Names the control where there's no visible label to point a Field at. */
  ariaLabel?: string;
  size?: "md" | "sm";
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

// How long a typed prefix keeps accumulating before starting a fresh search —
// roughly the half-second window native selects use.
const TYPEAHEAD_RESET_MS = 500;

/**
 * Select-only combobox (WAI-ARIA APG) replacing the native `<select>`, which
 * can't be styled consistently across browsers: the closed control takes our
 * tokens, but the open option list is drawn by the OS and ignores them.
 *
 * Rebuilding it means re-earning what the native element gave for free, so
 * this keeps full keyboard control (arrows, Home/End, Enter/Space, Escape),
 * type-to-select, and screen-reader semantics. Focus deliberately stays on the
 * trigger throughout and the active option is tracked via
 * `aria-activedescendant` rather than moving DOM focus into the list.
 *
 * The list is absolutely positioned within the component, so an ancestor with
 * `overflow: hidden` clips it — the one native behavior not reproduced here,
 * since that would need a portal/floating layer.
 */
export function Select({
  value,
  onChange,
  options,
  id,
  ariaLabel,
  size = "md",
  placeholder,
  disabled,
  className,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const selectedIndex = options.findIndex((o) => o.value === value);
  const [activeIndex, setActiveIndex] = useState(selectedIndex < 0 ? 0 : selectedIndex);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const typeahead = useRef({ query: "", at: 0 });

  const generatedId = useId();
  const baseId = id ?? generatedId;
  const listboxId = `${baseId}-listbox`;
  const optionId = (index: number) => `${baseId}-option-${index}`;

  const selected = selectedIndex < 0 ? undefined : options[selectedIndex];

  // Clicking outside dismisses the list. `pointerdown` rather than `click` so
  // it closes on press, the way a native dropdown does.
  useEffect(() => {
    if (!open) return undefined;
    function handlePointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  // Keep the active option visible when arrowing past the scroll edge.
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  function openList() {
    if (disabled) return;
    setActiveIndex(selectedIndex < 0 ? 0 : selectedIndex);
    setOpen(true);
  }

  function select(index: number) {
    const option = options[index];
    if (option) {
      onChange(option.value);
    }
  }

  function commit(index: number) {
    select(index);
    setOpen(false);
    triggerRef.current?.focus();
  }

  // Type-to-select: accumulate keystrokes into a prefix and jump to the first
  // option starting with it — highlighting while open, selecting outright
  // while closed, as a native select does.
  function handleTypeahead(char: string): boolean {
    const now = Date.now();
    const stale = now - typeahead.current.at > TYPEAHEAD_RESET_MS;
    const query = (stale ? "" : typeahead.current.query) + char.toLowerCase();
    typeahead.current = { query, at: now };

    const found = options.findIndex((o) => o.label.toLowerCase().startsWith(query));
    if (found < 0) return false;

    if (open) {
      setActiveIndex(found);
    } else {
      select(found);
    }
    return true;
  }

  function handleKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    const last = options.length - 1;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (open) setActiveIndex((i) => Math.min(i + 1, last));
        else openList();
        return;
      case "ArrowUp":
        e.preventDefault();
        if (open) setActiveIndex((i) => Math.max(i - 1, 0));
        else openList();
        return;
      case "Home":
        if (open) {
          e.preventDefault();
          setActiveIndex(0);
        }
        return;
      case "End":
        if (open) {
          e.preventDefault();
          setActiveIndex(last);
        }
        return;
      case "Enter":
      case " ":
        // Also stops Space scrolling the page behind an open list.
        e.preventDefault();
        if (open) commit(activeIndex);
        else openList();
        return;
      case "Escape":
        if (open) {
          e.preventDefault();
          setOpen(false);
        }
        return;
      case "Tab":
        // Let focus leave normally, but don't strand an open list behind it.
        setOpen(false);
        return;
      default:
        if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey && handleTypeahead(e.key)) {
          e.preventDefault();
        }
    }
  }

  return (
    <div className={cx(styles.root, className)} ref={rootRef}>
      <button
        type="button"
        id={id}
        ref={triggerRef}
        role="combobox"
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={open && options.length > 0 ? optionId(activeIndex) : undefined}
        disabled={disabled}
        className={cx(styles.trigger, size === "sm" && styles.sm)}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={handleKeyDown}
      >
        <span className={cx(styles.label, !selected && styles.placeholder)}>{selected?.label ?? placeholder ?? ""}</span>
        <Icon name="expand_more" size={20} className={styles.chevron} />
      </button>

      {/* Rendered even while closed so `aria-controls` always resolves. */}
      <ul className={styles.list} id={listboxId} role="listbox" ref={listRef} hidden={!open}>
        {options.map((option, index) => (
          <li
            key={option.value}
            id={optionId(index)}
            data-index={index}
            role="option"
            aria-selected={option.value === value}
            className={cx(styles.option, index === activeIndex && styles.optionActive)}
            onMouseEnter={() => setActiveIndex(index)}
            onClick={() => commit(index)}
          >
            <span className={styles.optionLabel}>{option.label}</span>
            {option.value === value && <Icon name="check" size={18} />}
          </li>
        ))}
      </ul>
    </div>
  );
}
