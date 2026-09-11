import Link from "next/link";
import type { Metadata } from "next";
import { getMessages } from "@/i18n/locales";
import { fetchAppointment } from "@/lib/actions";
import { loadPageContext } from "@/lib/page-context";
import { ManageAppointment } from "@/components/ManageAppointment";
import { UnavailableNotice } from "@/components/UnavailableNotice";
import { isValidTimezone } from "@/lib/tenant-time";
import styles from "./page.module.css";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ManagePage({ params }: { params: { locale: string; token: string } }) {
  const context = await loadPageContext(params.locale);

  if (!isValidTimezone(context.tenant.timezone)) {
    return (
      <UnavailableNotice
        heading={context.t("booking.unavailableHeading")}
        body={context.t("booking.unavailableBody")}
      />
    );
  }

  const result = await fetchAppointment(params.token);

  if (!result.ok) {
    return (
      <div className={styles.invalid}>
        <h1 className={styles.heading}>{context.t("manage.heading")}</h1>
        <p className={styles.message}>{context.t("manage.invalid")}</p>
        <Link className={styles.link} href="/manage/resend">
          {context.t("manage.lostLink")}
        </Link>
      </div>
    );
  }

  return (
    <ManageAppointment
      appointment={result.appointment}
      token={params.token}
      timezone={context.tenant.timezone}
      locale={context.locale}
      messages={getMessages(context.locale)}
    />
  );
}
