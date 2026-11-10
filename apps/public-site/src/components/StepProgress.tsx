interface StepProgressProps {
  steps: string[];
  current: number;

  label: string;
}

// Phones get a slim progress bar — six numbered markers don't fit in 390px —
// and from `sm` up the full daisyUI steps with names. The "Step 2 of 5" line
// always says where you are, so the bar itself is decorative.
export function StepProgress({ steps, current, label }: StepProgressProps) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-base-content/60">{label}</p>
      <progress
        className="progress progress-primary h-1.5 w-full sm:hidden"
        value={current + 1}
        max={steps.length}
        aria-hidden="true"
      />
      <ol className="steps hidden w-full sm:grid">
        {steps.map((step, index) => (
          <li
            key={step}
            className={`step text-xs ${index <= current ? "step-primary" : ""} ${index === current ? "font-semibold" : "text-base-content/60"}`}
            aria-current={index === current ? "step" : undefined}
          >
            {step}
          </li>
        ))}
      </ol>
    </div>
  );
}
