interface WizardRecapProps {
  /** "Your booking" */
  label: string;
  /** What has been chosen so far, in the order it was chosen. */
  items: string[];
}

// One line under the progress bar saying what's already been picked, so nobody
// has to go back a step to check which service or branch they chose.
export function WizardRecap({ label, items }: WizardRecapProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <p className="text-sm">
      <span className="text-base-content/65">{label}: </span>
      <span className="font-semibold">{items.join(" · ")}</span>
    </p>
  );
}
