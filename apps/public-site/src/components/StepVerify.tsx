"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Translate } from "@/i18n/locales";
import { startVerification, verifyPhone } from "@/lib/actions";
import { BTN_BACK, BTN_NEXT, FOOTER, LABEL, STEP, STEP_HEADING, STEP_HINT } from "@/lib/wizardClasses";
import type { CodeSent } from "@/lib/wizard-storage";
import { OtpInput } from "./OtpInput";

interface StepVerifyProps {
  phoneNumber: string;
  /** The last code sent (kept by the wizard, so it outlives this step). */
  codeSent: CodeSent | null;
  onCodeSent: (sent: CodeSent) => void;
  /** Hands the single-use token back so the booking can present it. */
  onVerified: (verificationToken: string) => void;
  onBack: () => void;
  t: Translate;
}

const CODE_LENGTH = 6;

/** No resend sooner than this after the last send. */
const RESEND_COOLDOWN_MS = 60_000;
/** A code with less life left than this is replaced on arrival rather than reused. */
const REUSE_MARGIN_MS = 60_000;

/**
 * Proves the customer owns the number before an appointment is taken in their
 * name.
 *
 * SMS delivery is mocked, so the API hands the code back and it is shown on
 * screen. That block disappears on its own once a provider is wired in — the
 * response simply stops carrying `devCode` — so nothing here needs revisiting.
 */
export function StepVerify({ phoneNumber, codeSent, onCodeSent, onVerified, onBack, t }: StepVerifyProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Only a code sent to *this* number counts — the customer may have gone
  // back and changed it.
  const sent = codeSent?.phoneNumber === phoneNumber ? codeSent : null;
  const cooldownLeft = sent ? Math.max(0, Math.ceil((sent.sentAt + RESEND_COOLDOWN_MS - now) / 1000)) : 0;

  // Ticks only while the resend button is counting down.
  useEffect(() => {
    if (cooldownLeft === 0) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [cooldownLeft]);

  const send = async () => {
    setIsSending(true);
    setError(null);
    const result = await startVerification(phoneNumber);
    setIsSending(false);
    if (!result.ok) {
      setError(t("booking.verify.sendFailed"));
      return;
    }
    const sentAt = Date.now();
    setNow(sentAt);
    onCodeSent({ phoneNumber, sentAt, expiresAt: result.expiresAt, devCode: result.devCode });
  };

  // Sent on arrival, so the customer isn't asked to press anything first —
  // unless a code for this number is still good (they came back from the
  // previous step, or switched language): then that one stands, and nothing
  // is spent from the number's hourly allowance.
  //
  // Once per arrival: StrictMode runs effects twice in development, and two
  // sends would spend two of the number's hourly codes.
  const arrived = useRef(false);
  useEffect(() => {
    if (arrived.current) return;
    arrived.current = true;
    const reusable = sent && Date.parse(sent.expiresAt) - Date.now() > REUSE_MARGIN_MS;
    if (!reusable) void send();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A ref, not the state: the last digit and a quick Enter can land in the
  // same tick, before `isVerifying` re-renders — one code is checked once.
  const verifying = useRef(false);

  const verify = async (entered: string) => {
    if (verifying.current || entered.length !== CODE_LENGTH) return;
    verifying.current = true;
    setIsVerifying(true);
    setError(null);
    const result = await verifyPhone(phoneNumber, entered);
    verifying.current = false;
    setIsVerifying(false);

    if (!result.ok) {
      setError(t("booking.verify.wrongCode"));
      setCode("");
      return;
    }
    onVerified(result.verificationToken);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void verify(code);
  };

  return (
    <section className={STEP}>
      <h2 className={STEP_HEADING}>{t("booking.verify.heading")}</h2>
      <p className={STEP_HINT}>{t("booking.verify.hint", { phoneNumber })}</p>

      {sent?.devCode && (
        <p className="alert alert-soft alert-info">
          {t("booking.verify.devCode")} <strong className="font-mono text-lg tracking-[0.3em]">{sent.devCode}</strong>
        </p>
      )}

      <form className="flex flex-col gap-4" onSubmit={submit}>
        <div className="flex flex-col items-center gap-2">
          <p id="otp-label" className={LABEL}>
            {t("booking.verify.codeLabel")}
          </p>
          {/* The last digit submits on its own; the button stays for anyone who expects one. */}
          <OtpInput
            length={CODE_LENGTH}
            value={code}
            onChange={(next) => {
              setCode(next);
              if (next) setError(null);
            }}
            onComplete={(entered) => void verify(entered)}
            disabled={isVerifying}
            labelledBy="otp-label"
            digitLabel={(position) => t("booking.verify.digit", { position, total: CODE_LENGTH })}
          />
        </div>

        {error && (
          <p className="alert alert-soft alert-error" role="alert">
            {error}
          </p>
        )}

        <div className={FOOTER}>
          <button type="button" className={`${BTN_BACK} mr-auto`} onClick={onBack} disabled={isVerifying}>
            {t("common.back")}
          </button>
          <button
            type="button"
            className="btn btn-outline border-base-300 tabular-nums"
            onClick={send}
            disabled={isSending || isVerifying || cooldownLeft > 0}
          >
            {isSending
              ? t("booking.verify.sending")
              : cooldownLeft > 0
                ? t("booking.verify.resendIn", { seconds: cooldownLeft })
                : t("booking.verify.resend")}
          </button>
          <button
            type="submit"
            className={BTN_NEXT}
            disabled={isVerifying || code.length !== CODE_LENGTH}
          >
            {isVerifying ? t("booking.verify.verifying") : t("booking.verify.submit")}
          </button>
        </div>
      </form>
    </section>
  );
}
