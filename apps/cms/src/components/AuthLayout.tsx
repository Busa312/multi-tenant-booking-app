import type { FormEvent, ReactNode } from "react";
import { Brand } from "./ui/Brand.js";
import { Icon } from "./ui/Icon.js";
import { LanguageSwitcher } from "./LanguageSwitcher.js";
import { ThemeToggle } from "./ThemeToggle.js";

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

const ART_ICONS = ["event_available", "diversity_3", "palette"];

// Shared split-screen chrome for the unauthenticated screens (Login,
// SetPassword) — art panel on the left from `lg` up, a centred form card.
export function AuthLayout({ headline, artSub, title, subtitle, onSubmit, children }: AuthLayoutProps) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-neutral p-12 text-neutral-content lg:flex">
        <div
          className="pointer-events-none absolute -top-32 -right-32 size-96 rounded-full bg-primary/30 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-40 -left-24 size-96 rounded-full bg-accent/20 blur-3xl"
          aria-hidden="true"
        />
        <Brand size="lg" onDark className="relative" />
        <div className="relative max-w-md">
          <div className="mb-8 flex gap-3" aria-hidden="true">
            {ART_ICONS.map((icon) => (
              <span key={icon} className="grid size-12 place-items-center rounded-box bg-neutral-content/10">
                <Icon name={icon} size={22} />
              </span>
            ))}
          </div>
          <p className="font-display text-4xl leading-tight font-semibold">{headline}</p>
          <p className="mt-4 text-base text-neutral-content/70">{artSub}</p>
        </div>
      </div>

      <div className="flex flex-col p-4 sm:p-8">
        <div className="flex justify-end gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
        <div className="flex flex-1 items-center justify-center py-8">
          <form
            className="w-full max-w-sm animate-fade-up rounded-box border border-base-300 bg-base-100 p-6 shadow-sm motion-reduce:animate-none sm:p-8"
            onSubmit={onSubmit}
          >
            <Brand className="mb-8 lg:hidden" />
            <h1 className="font-display text-3xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-1.5 mb-7 text-base-content/60">{subtitle}</p>
            {children}
          </form>
        </div>
      </div>
    </div>
  );
}
