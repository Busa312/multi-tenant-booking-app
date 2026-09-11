"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { Translate } from "@/i18n/locales";
import { startVerification, verifyPhone } from "@/lib/actions";
import styles from "./StepVerify.module.css";

interface StepVerifyProps {
  phoneNumber: string;
  /** Hands the single-use token back so the booking can present it. */
  onVerified: (verificationToken: string) => void;
  onBack: () => void;
  t: Translate;
}

const CODE_LENGTH = 6;

/**
 * Proves the customer owns the number before an appointment is taken in their
 * name.
 *
 * SMS delivery is mocked, so the API hands the code back and it is shown on
 * screen. That block disappears on its own once a provider is wired in — the
 * response simply stops carrying `devCode` — so nothing here needs revisiting.
 */
export function StepVerify({ phoneNumber, onVerified, onBack, t }: StepVerifyProps) {
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);

  const send = async () => {
    setIsSending(true);
    setError(null);
    const result = await startVerification(phoneNumber);
    setIsSending(false);
    if (!result.ok) {
      setError(t("booking.verify.sendFailed"));
      return;
    }
    setDevCode(result.devCode);
  };

  // Sent once on arrival, so the customer isn't asked to press anything first.
  useEffect(() => {
    void send();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setIsVerifying(true);
    setError(null);
    const result = await verifyPhone(phoneNumber, code.trim());
    setIsVerifying(false);

    if (!result.ok) {
      setError(t("booking.verify.wrongCode"));
      setCode("");
      return;
    }
    onVerified(result.verificationToken);
  };

  return (
    <section className={styles.step}>
      <h2 className={styles.heading}>{t("booking.verify.heading")}</h2>
      <p className={styles.hint}>{t("booking.verify.hint", { phoneNumber })}</p>

      {devCode && (
        <p className={styles.devCode}>
          {t("booking.verify.devCode")} <strong>{devCode}</strong>
        </p>
      )}

      <form className={styles.form} onSubmit={submit}>
        <label className={styles.field}>
          <span className={styles.label}>{t("booking.verify.codeLabel")}</span>
          <input
            className={styles.input}
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH))}
            // A numeric keypad and one-tap autofill from the SMS, once real.
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={CODE_LENGTH}
            required
            autoFocus
          />
        </label>

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <div className={styles.footer}>
          <button type="button" className={styles.back} onClick={onBack} disabled={isVerifying}>
            {t("common.back")}
          </button>
          <button type="button" className={styles.resend} onClick={send} disabled={isSending || isVerifying}>
            {isSending ? t("booking.verify.sending") : t("booking.verify.resend")}
          </button>
          <button
            type="submit"
            className={styles.submit}
            disabled={isVerifying || code.length !== CODE_LENGTH}
          >
            {isVerifying ? t("booking.verify.verifying") : t("booking.verify.submit")}
          </button>
        </div>
      </form>
    </section>
  );
}
