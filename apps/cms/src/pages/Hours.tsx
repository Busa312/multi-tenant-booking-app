import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import type { BusinessHours, ProfessionalSummary, TimeOff } from "@booking/shared-types";
import { cmsApiClient } from "../lib/api.js";
import { useI18n } from "../i18n/I18nContext.js";
import { AppShell } from "../components/AppShell.js";
import { Alert, Button, Card, Eyebrow, Field, Select, TextInput, Table, TableRow, TableEmpty } from "../components/ui/index.js";
import styles from "./Hours.module.css";

export function HoursPage() {
  const { t, messages } = useI18n();
  const dayLabels = messages.hours.days;
  const [searchParams] = useSearchParams();
  const professionalIdParam = searchParams.get("professionalId");

  const [hours, setHours] = useState<BusinessHours[] | null>(null);
  const [timeOff, setTimeOff] = useState<TimeOff[] | null>(null);
  const [professionals, setProfessionals] = useState<ProfessionalSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    Promise.all([cmsApiClient.listBusinessHours(), cmsApiClient.listTimeOff(), cmsApiClient.listProfessionals()])
      .then(([h, t2, p]) => {
        setHours(h);
        setTimeOff(t2);
        setProfessionals(p);
      })
      .catch(() => setError(t("hours.errLoad")));
  }

  // Fetch once on mount; a language switch shouldn't trigger a refetch.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, []);

  const scopedProfessional = professionals?.find((p) => p.id === professionalIdParam);
  const visibleHours = professionalIdParam ? hours?.filter((h) => h.professionalId === professionalIdParam) : hours;
  const visibleTimeOff = professionalIdParam
    ? timeOff?.filter((to) => to.professionalId === professionalIdParam)
    : timeOff;

  function professionalLabel(id: string | null) {
    if (!id) return t("hours.tenantWide");
    return professionals?.find((p) => p.id === id)?.name ?? t("hours.unknown");
  }

  return (
    <AppShell
      title={t("hours.title")}
      subtitle={scopedProfessional ? t("hours.subtitleScoped", { name: scopedProfessional.name }) : t("hours.subtitle")}
    >
      <div className={`fade-up ${styles.grid}`}>
        {error && <Alert className={styles.errorFull}>{error}</Alert>}

        <section>
          <Eyebrow>{t("hours.businessHours")}</Eyebrow>
          <Table className={styles.list}>
            {visibleHours?.map((h) => (
              <TableRow key={h.id} columns="1fr 1fr 40px">
                <div className={styles.rowMain}>
                  {dayLabels[h.dayOfWeek]} · {professionalLabel(h.professionalId)}
                </div>
                <div className={styles.rowSub}>
                  {h.startTime}–{h.endTime}
                </div>
                <Button
                  iconOnly
                  size="sm"
                  icon="delete"
                  title={t("hours.deleteTitle")}
                  onClick={() => cmsApiClient.deleteBusinessHours(h.id).then(load)}
                />
              </TableRow>
            ))}
            {visibleHours?.length === 0 && <TableEmpty>{t("hours.emptyHours")}</TableEmpty>}
          </Table>
          <AddHoursForm defaultProfessionalId={professionalIdParam} professionals={professionals ?? []} onSaved={load} />
        </section>

        <section>
          <Eyebrow>{t("hours.timeOff")}</Eyebrow>
          <Table className={styles.list}>
            {visibleTimeOff?.map((to) => (
              <TableRow key={to.id} columns="1fr 40px">
                <div>
                  <div className={styles.rowMain}>
                    {new Date(to.startAt).toLocaleString()} – {new Date(to.endAt).toLocaleString()}
                  </div>
                  <div className={styles.rowMeta}>
                    {professionalLabel(to.professionalId)}
                    {to.reason ? ` · ${to.reason}` : ""}
                  </div>
                </div>
                <Button
                  iconOnly
                  size="sm"
                  icon="delete"
                  title={t("hours.deleteTitle")}
                  onClick={() => cmsApiClient.deleteTimeOff(to.id).then(load)}
                />
              </TableRow>
            ))}
            {visibleTimeOff?.length === 0 && <TableEmpty>{t("hours.emptyTimeOff")}</TableEmpty>}
          </Table>
          <AddTimeOffForm
            defaultProfessionalId={professionalIdParam}
            professionals={professionals ?? []}
            onSaved={load}
          />
        </section>
      </div>
    </AppShell>
  );
}

function ProfessionalSelect({
  id,
  value,
  onChange,
  professionals,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  professionals: ProfessionalSummary[];
}) {
  const { t } = useI18n();
  // The empty value is a real choice here, not a placeholder — it means
  // "tenant-wide" (BusinessHours.professionalId === null).
  const options = [
    { value: "", label: t("hours.tenantWide") },
    ...professionals.map((p) => ({ value: p.id, label: p.name })),
  ];
  return <Select id={id} value={value} onChange={onChange} options={options} />;
}

function AddHoursForm({
  defaultProfessionalId,
  professionals,
  onSaved,
}: {
  defaultProfessionalId: string | null;
  professionals: ProfessionalSummary[];
  onSaved: () => void;
}) {
  const { t, messages } = useI18n();
  const [professionalId, setProfessionalId] = useState(defaultProfessionalId ?? "");
  const [dayOfWeek, setDayOfWeek] = useState("1");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await cmsApiClient.upsertBusinessHours({
        professionalId: professionalId || undefined,
        dayOfWeek: Number(dayOfWeek),
        startTime,
        endTime,
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card as="form" onSubmit={handleSubmit}>
      <Field label={t("hours.appliesTo")} htmlFor="hours-applies-to">
        <ProfessionalSelect
          id="hours-applies-to"
          value={professionalId}
          onChange={setProfessionalId}
          professionals={professionals}
        />
      </Field>
      <Field label={t("hours.day")} htmlFor="hours-day">
        <Select
          id="hours-day"
          value={dayOfWeek}
          onChange={setDayOfWeek}
          options={messages.hours.days.map((label, i) => ({ value: String(i), label }))}
        />
      </Field>
      <div className={styles.timeRow}>
        <Field label={t("hours.start")} className={styles.timeCol}>
          <TextInput type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
        </Field>
        <Field label={t("hours.end")} className={styles.timeCol}>
          <TextInput type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
        </Field>
      </div>
      <Button type="submit" variant="secondary" fullWidth disabled={saving}>
        {saving ? t("hours.adding") : t("hours.addHours")}
      </Button>
    </Card>
  );
}

function AddTimeOffForm({
  defaultProfessionalId,
  professionals,
  onSaved,
}: {
  defaultProfessionalId: string | null;
  professionals: ProfessionalSummary[];
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [professionalId, setProfessionalId] = useState(defaultProfessionalId ?? "");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await cmsApiClient.createTimeOff({
        professionalId: professionalId || undefined,
        startAt: new Date(startAt).toISOString(),
        endAt: new Date(endAt).toISOString(),
        reason: reason || undefined,
      });
      setReason("");
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card as="form" onSubmit={handleSubmit}>
      <Field label={t("hours.appliesTo")} htmlFor="timeoff-applies-to">
        <ProfessionalSelect
          id="timeoff-applies-to"
          value={professionalId}
          onChange={setProfessionalId}
          professionals={professionals}
        />
      </Field>
      <div className={styles.timeRow}>
        <Field label={t("hours.from")} className={styles.timeCol}>
          <TextInput type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} required />
        </Field>
        <Field label={t("hours.to")} className={styles.timeCol}>
          <TextInput type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} required />
        </Field>
      </div>
      <Field label={t("hours.reason")}>
        <TextInput
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t("hours.reasonPlaceholder")}
        />
      </Field>
      <Button type="submit" variant="secondary" fullWidth disabled={saving}>
        {saving ? t("hours.adding") : t("hours.blockTimeOff")}
      </Button>
    </Card>
  );
}
