interface StepProgressProps {
  steps: string[];
  current: number;

  label: string;
  /** Go back to a step already done. Steps ahead are never links. */
  onSelect: (index: number) => void;
}

const BAR = "h-1 rounded-full";
const NAME = "sr-only truncate text-xs sm:not-sr-only";

// One segment per step, filled up to the current one. The "Step 2 of 5" line
// always says where you are; the step names join it from `sm` up, where six of
// them fit (they don't in 390px). A finished step is a button back to it.
export function StepProgress({ steps, current, label, onSelect }: StepProgressProps) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-base-content/65 tabular-nums">{label}</p>
      <ol className="flex gap-1">
        {steps.map((step, index) => (
          <li key={step} className="min-w-0 flex-1" aria-current={index === current ? "step" : undefined}>
            {index < current ? (
              <button
                type="button"
                className="group flex w-full cursor-pointer flex-col gap-1.5 text-left"
                onClick={() => onSelect(index)}
              >
                <span className={`${BAR} bg-primary`} aria-hidden="true" />
                <span className={`${NAME} text-base-content/65 underline-offset-2 group-hover:underline`}>{step}</span>
              </button>
            ) : (
              <div className="flex flex-col gap-1.5">
                <span className={`${BAR} ${index === current ? "bg-primary" : "bg-base-300"}`} aria-hidden="true" />
                <span className={`${NAME} ${index === current ? "font-semibold" : "text-base-content/65"}`}>{step}</span>
              </div>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
