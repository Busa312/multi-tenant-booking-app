"use client";

import { useMemo, useState, type FormEvent } from "react";
import { translator, type Messages } from "@/i18n/locales";
import { resendLink } from "@/lib/actions";
import styles from "./ResendLinkForm.module.css";

export function ResendLinkForm({ messages }: { messages: Messages }) {
  const t = useMemo(() => translator(messages), [messages]);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isDone, setIsDone] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSending(true);
    await resendLink(phoneNumber.trim());
    setIsSending(false);
    setIsDone(true);
  };

  return (
    <section className={styles.page}>
      <h1 className={styles.heading}>{t("manage.resend.heading")}</h1>

      {isDone ? (
        <p className={styles.done} role="status">
          {t("manage.resend.done")}
        </p>
      ) : (
        <form className={styles.form} onSubmit={submit}>
          <p className={styles.hint}>{t("manage.resend.hint")}</p>
          <label className={styles.field}>
            <span className={styles.label}>{t("manage.resend.phone")}</span>
            <input
              className={styles.input}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              required
              value={phoneNumber}
              onChange={(event) => setPhoneNumber(event.target.value)}
            />
          </label>
          <button type="submit" className={styles.submit} disabled={isSending}>
            {isSending ? t("manage.resend.submitting") : t("manage.resend.submit")}
          </button>
        </form>
      )}
    </section>
  );
}
