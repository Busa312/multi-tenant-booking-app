import styles from "./StepProgress.module.css";

interface StepProgressProps {
  steps: string[];
  current: number;

  label: string;
}

export function StepProgress({ steps, current, label }: StepProgressProps) {
  return (
    <div className={styles.progress}>
      <p className={styles.label}>{label}</p>
      <ol className={styles.steps}>
        {steps.map((step, index) => (
          <li
            key={step}
            className={styles.step}
            data-state={index === current ? "current" : index < current ? "done" : "todo"}

            aria-current={index === current ? "step" : undefined}
          >
            <span className={styles.dot} aria-hidden="true" />
            <span className={styles.name}>{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
