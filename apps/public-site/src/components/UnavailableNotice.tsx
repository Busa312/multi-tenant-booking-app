import styles from "./UnavailableNotice.module.css";

interface UnavailableNoticeProps {
  heading: string;
  body: string;
}

export function UnavailableNotice({ heading, body }: UnavailableNoticeProps) {
  return (
    <section className={styles.notice}>
      <h1 className={styles.heading}>{heading}</h1>
      <p className={styles.body}>{body}</p>
    </section>
  );
}
