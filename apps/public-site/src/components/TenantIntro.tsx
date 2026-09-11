import styles from "./TenantIntro.module.css";

interface TenantIntroProps {
  title: string;
  description: string;
}

// R170: the tenant's own heading and blurb
export function TenantIntro({ title, description }: TenantIntroProps) {
  return (
    <section className={styles.intro}>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.description}>{description}</p>
    </section>
  );
}
