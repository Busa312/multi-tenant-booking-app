"use client";

import { useEffect, useRef, type ClipboardEvent, type KeyboardEvent } from "react";

interface OtpInputProps {
  length: number;
  /** Digits entered so far, contiguous from the first box. */
  value: string;
  onChange: (value: string) => void;
  /** Called once the last digit is in — the step submits from here. */
  onComplete: (value: string) => void;
  disabled?: boolean;
  /** id of the visible label naming the whole code. */
  labelledBy: string;
  /** Accessible name of one box, e.g. "Digit 2 of 6". */
  digitLabel: (position: number) => string;
}

const BOX =
  // Rounded squares, not the pill every other field is: a digit box reads as a box.
  "input input-lg w-12 px-0 text-center font-mono text-2xl tabular-nums [--radius-field:0.875rem] sm:w-14 motion-reduce:transition-none";

/**
 * One box per digit. The value stays contiguous — a box past the first empty
 * one sends focus back to it — so editing never leaves holes. A whole code
 * arriving at once (SMS autofill drops it into the first box; a paste lands
 * anywhere) is spread across the boxes.
 */
export function OtpInput({ length, value, onChange, onComplete, disabled, labelledBy, digitLabel }: OtpInputProps) {
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const focus = (index: number) => boxes.current[Math.max(0, Math.min(index, length - 1))]?.focus();

  // The value as of the last keystroke, not the last render. Moving focus to
  // the next box happens inside the keystroke's handler, before React has
  // re-rendered with the new digit — reading the prop there would see the old,
  // shorter value and bounce focus back, scrambling a fast-typed code.
  const latest = useRef(value);
  latest.current = value;

  // Cleared after a wrong code: start again from the first box.
  const previous = useRef(value);
  useEffect(() => {
    if (value === "" && previous.current !== "") focus(0);
    previous.current = value;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const commit = (next: string): string => {
    const clean = next.replace(/\D/g, "").slice(0, length);
    latest.current = clean;
    onChange(clean);
    if (clean.length === length) onComplete(clean);
    return clean;
  };

  const handleInput = (index: number, raw: string) => {
    const value = latest.current;
    const current = value[index] ?? "";
    let typed = raw.replace(/\D/g, "");
    // Typed into a filled box without the selection: keep only the new digit.
    if (typed.length === 2 && current) typed = typed[0] === current ? typed.slice(1) : typed.slice(0, 1);
    if (!typed) return;

    const next = commit(value.slice(0, index) + typed + value.slice(index + typed.length));
    focus(Math.min(index + typed.length, next.length));
  };

  const handleKey = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    const value = latest.current;
    if (event.key === "Backspace") {
      event.preventDefault();
      if (value[index]) {
        commit(value.slice(0, index) + value.slice(index + 1));
      } else if (index > 0) {
        commit(value.slice(0, index - 1));
        focus(index - 1);
      }
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      focus(index - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      focus(Math.min(index + 1, value.length));
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    focus(commit(event.clipboardData.getData("text")).length);
  };

  return (
    <div className="flex justify-center gap-2" role="group" aria-labelledby={labelledBy}>
      {Array.from({ length }, (_, index) => (
        <input
          key={index}
          ref={(element) => {
            boxes.current[index] = element;
          }}
          className={BOX}
          value={value[index] ?? ""}
          onChange={(event) => handleInput(index, event.target.value)}
          onKeyDown={(event) => handleKey(index, event)}
          onPaste={handlePaste}
          onFocus={(event) => {
            if (index > latest.current.length) focus(latest.current.length);
            else event.target.select();
          }}
          // A numeric keypad, and one-tap autofill from the SMS once real.
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          aria-label={digitLabel(index + 1)}
          disabled={disabled}
          autoFocus={index === 0}
        />
      ))}
    </div>
  );
}
