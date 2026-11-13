import type { FormEvent, ReactNode } from "react";
import { Brand } from "./ui/Brand.js";
import { LanguageSwitcher } from "./LanguageSwitcher.js";
import { ThemeToggle } from "./ThemeToggle.js";
import { cx } from "../lib/cx.js";

interface AuthLayoutProps {
  /** Marketing copy in the decorative left panel. */
  headline: string;
  artSub: string;
  /** Heading + subheading above the form fields. */
  title: string;
  subtitle: string;
  onSubmit: (e: FormEvent) => void;
  children: ReactNode;
}

// The art panel's picture: a morning out of an appointment book — ruled hours,
// a few booked blocks, one of them highlighted. Purely decorative.
const DAY_PAGE: readonly { time: string; block?: string }[] = [
  { time: "09:00", block: "w-2/5 bg-neutral-content/15" },
  { time: "10:00", block: "w-3/5 bg-accent" },
  { time: "11:00" },
  { time: "12:00", block: "w-4/5 bg-neutral-content/15" },
  { time: "13:00", block: "w-1/3 bg-neutral-content/15" },
];

// Shared split-screen chrome for the unauthenticated screens (Login,
// SetPassword) — art panel on the left from `lg` up, a centred form card.
export function AuthLayout({ headline, artSub, title, subtitle, onSubmit, children }: AuthLayoutProps) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <div className="hidden flex-col justify-between gap-12 bg-neutral p-12 text-neutral-content lg:flex">
        <Brand size="lg" onDark />
        <div className="max-w-md">
          <p className="font-display text-5xl leading-[1.05] font-bold text-balance">{headline}</p>
          <p className="mt-4 text-base text-neutral-content/70">{artSub}</p>
        </div>
        <ol className="border-b border-neutral-content/20" aria-hidden="true">
          {DAY_PAGE.map((row) => (
            <li
              key={row.time}
              className="grid h-12 grid-cols-[3.5rem_minmax(0,1fr)] items-center border-t border-neutral-content/20"
            >
              <span className="text-sm text-neutral-content/55 tabular-nums">{row.time}</span>
              {row.block && <span className={cx("h-7 rounded-field", row.block)} />}
            </li>
          ))}
        </ol>
      </div>

      <div className="flex flex-col p-4 sm:p-8">
        <div className="flex justify-end gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
        <div className="flex flex-1 items-center justify-center py-8">
          <form className="w-full max-w-sm rounded-box border border-base-300 bg-base-100 p-6 sm:p-8" onSubmit={onSubmit}>
            <Brand className="mb-8 lg:hidden" />
            <h1 className="font-display text-4xl leading-tight font-bold">{title}</h1>
            <p className="mt-1.5 mb-7 text-base-content/60">{subtitle}</p>
            {children}
          </form>
        </div>
      </div>
    </div>
  );
}
