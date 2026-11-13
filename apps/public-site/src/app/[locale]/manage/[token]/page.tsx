import Link from "next/link";
import type { Metadata } from "next";
import { getMessages } from "@/i18n/locales";
import { fetchAppointment } from "@/lib/actions";
import { loadPageContext } from "@/lib/page-context";
import { ManageAppointment } from "@/components/ManageAppointment";
import { UnavailableNotice } from "@/components/UnavailableNotice";
import { isValidTimezone } from "@/lib/tenant-time";

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  const context = await loadPageContext(params.locale);
  // The link is a credential: never indexed, never followed.
  return { title: context.t("manage.heading"), robots: { index: false, follow: false } };
}

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
      <div className="flex flex-col items-start gap-4">
        <h1 className="text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">{context.t("manage.heading")}</h1>
        <p className="alert alert-soft alert-warning w-full">{context.t("manage.invalid")}</p>
        <Link className="btn btn-primary" href={context.href("/manage/resend")}>
          {context.t("manage.lostLink")}
        </Link>
      </div>
    );
  }

  return (
    <ManageAppointment
      visit={result.visit}
      token={params.token}
      timezone={context.tenant.timezone}
      locale={context.locale}
      defaultLocale={context.defaultLocale}
      messages={getMessages(context.locale)}
      changeCutoffHours={context.tenant.changeCutoffHours}
      maxAdvanceDays={context.tenant.maxBookingAdvanceDays}
    />
  );
}
