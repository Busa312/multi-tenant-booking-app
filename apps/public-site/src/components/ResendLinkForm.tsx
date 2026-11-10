"use client";

import { useMemo, useState, type FormEvent } from "react";
import { translator, type Messages } from "@/i18n/locales";
import { resendLink } from "@/lib/actions";

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
    <section className="mx-auto flex w-full max-w-md flex-col gap-5">
      <h1 className="text-2xl font-bold tracking-tight">{t("manage.resend.heading")}</h1>

      {isDone ? (
        <p className="alert alert-soft alert-success" role="status">
          {t("manage.resend.done")}
        </p>
      ) : (
        <form className="card card-border flex flex-col gap-4 border-base-300 bg-base-100 p-5 sm:p-6" onSubmit={submit}>
          <p className="text-base-content/70">{t("manage.resend.hint")}</p>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">{t("manage.resend.phone")}</span>
            <input
              className="input w-full"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              required
              value={phoneNumber}
              onChange={(event) => setPhoneNumber(event.target.value)}
            />
          </label>
          <button type="submit" className="btn btn-primary" disabled={isSending}>
            {isSending ? t("manage.resend.submitting") : t("manage.resend.submit")}
          </button>
        </form>
      )}
    </section>
  );
}
