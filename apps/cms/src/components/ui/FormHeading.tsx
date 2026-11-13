import type { ReactNode } from "react";

interface FormHeadingProps {
  children: ReactNode;
}

// Starts a new part of a long form ("Customer"), under a rule. Bigger than any
// field label, so the parts of the form can be told apart at a glance.
export function FormHeading({ children }: FormHeadingProps) {
  return <h3 className="mt-2 mb-3 border-t border-base-300 pt-4 font-display text-xl leading-tight font-bold">{children}</h3>;
}
