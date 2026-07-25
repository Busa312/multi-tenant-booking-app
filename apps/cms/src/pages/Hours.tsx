import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import type { BusinessHours, ProfessionalSummary, TimeOff } from "@booking/shared-types";
import { cmsApiClient } from "../lib/api.js";
import { AppShell } from "../components/AppShell.js";

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function HoursPage() {
  const [searchParams] = useSearchParams();
  const professionalIdParam = searchParams.get("professionalId");

  const [hours, setHours] = useState<BusinessHours[] | null>(null);
  const [timeOff, setTimeOff] = useState<TimeOff[] | null>(null);
  const [professionals, setProfessionals] = useState<ProfessionalSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    Promise.all([cmsApiClient.listBusinessHours(), cmsApiClient.listTimeOff(), cmsApiClient.listProfessionals()])
      .then(([h, t, p]) => {
        setHours(h);
        setTimeOff(t);
        setProfessionals(p);
      })
      .catch(() => setError("Could not load hours & time off"));
  }

  useEffect(load, []);

  const scopedProfessional = professionals?.find((p) => p.id === professionalIdParam);
  const visibleHours = professionalIdParam ? hours?.filter((h) => h.professionalId === professionalIdParam) : hours;
  const visibleTimeOff = professionalIdParam
    ? timeOff?.filter((t) => t.professionalId === professionalIdParam)
    : timeOff;

  function professionalLabel(id: string | null) {
    if (!id) return "Tenant-wide";
    return professionals?.find((p) => p.id === id)?.name ?? "—";
  }

  return (
    <AppShell
      title="Hours & time off"
      subtitle={scopedProfessional ? `Scoped to ${scopedProfessional.name}` : "Business hours and blocked-off time"}
    >
      <div className="fade-up" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
        {error && (
          <p className="alert alert-error" role="alert" style={{ gridColumn: "1 / -1" }}>
            {error}
          </p>
        )}

        <section>
          <div className="eyebrow">Business hours</div>
          <div className="table" style={{ marginBottom: "16px" }}>
            {visibleHours?.map((h) => (
              <div key={h.id} className="table-row" style={{ gridTemplateColumns: "1fr 1fr 40px" }}>
                <div style={{ fontSize: "13px" }}>
                  {DAY_LABELS[h.dayOfWeek]} · {professionalLabel(h.professionalId)}
                </div>
                <div style={{ fontSize: "13px", color: "var(--ink-soft)" }}>
                  {h.startTime}–{h.endTime}
                </div>
                <button
                  className="btn-icon"
                  title="Delete"
                  style={{ width: "30px", height: "30px", border: "none" }}
                  onClick={() => cmsApiClient.deleteBusinessHours(h.id).then(load)}
                >
                  <span className="ms" style={{ fontSize: "18px" }}>
                    delete
                  </span>
                </button>
              </div>
            ))}
            {visibleHours?.length === 0 && (
              <div style={{ padding: "16px 20px", color: "var(--ink-soft)", fontSize: "13px" }}>No hours set.</div>
            )}
          </div>
          <AddHoursForm
            defaultProfessionalId={professionalIdParam}
            professionals={professionals ?? []}
            onSaved={load}
          />
        </section>

        <section>
          <div className="eyebrow">Time off</div>
          <div className="table" style={{ marginBottom: "16px" }}>
            {visibleTimeOff?.map((t) => (
              <div key={t.id} className="table-row" style={{ gridTemplateColumns: "1fr 40px" }}>
                <div>
                  <div style={{ fontSize: "13px" }}>
                    {new Date(t.startAt).toLocaleString()} – {new Date(t.endAt).toLocaleString()}
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--ink-soft)" }}>
                    {professionalLabel(t.professionalId)}
                    {t.reason ? ` · ${t.reason}` : ""}
                  </div>
                </div>
                <button
                  className="btn-icon"
                  title="Delete"
                  style={{ width: "30px", height: "30px", border: "none" }}
                  onClick={() => cmsApiClient.deleteTimeOff(t.id).then(load)}
                >
                  <span className="ms" style={{ fontSize: "18px" }}>
                    delete
                  </span>
                </button>
              </div>
            ))}
            {visibleTimeOff?.length === 0 && (
              <div style={{ padding: "16px 20px", color: "var(--ink-soft)", fontSize: "13px" }}>
                No time off blocked.
              </div>
            )}
          </div>
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
  value,
  onChange,
  professionals,
}: {
  value: string;
  onChange: (v: string) => void;
  professionals: ProfessionalSummary[];
}) {
  return (
    <select className="select" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Tenant-wide</option>
      {professionals.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );
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
    <form onSubmit={handleSubmit} className="card">
      <div className="field">
        <label className="field-label">Applies to</label>
        <ProfessionalSelect value={professionalId} onChange={setProfessionalId} professionals={professionals} />
      </div>
      <div className="field">
        <label className="field-label">Day</label>
        <select className="select" value={dayOfWeek} onChange={(e) => setDayOfWeek(e.target.value)}>
          {DAY_LABELS.map((label, i) => (
            <option key={label} value={i}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div style={{ display: "flex", gap: "10px" }}>
        <div className="field" style={{ flex: 1 }}>
          <label className="field-label">Start</label>
          <input
            type="time"
            className="input"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            required
          />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label className="field-label">End</label>
          <input type="time" className="input" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
        </div>
      </div>
      <button type="submit" className="btn btn-secondary btn-full" disabled={saving}>
        {saving ? "Adding…" : "Add hours"}
      </button>
    </form>
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
    <form onSubmit={handleSubmit} className="card">
      <div className="field">
        <label className="field-label">Applies to</label>
        <ProfessionalSelect value={professionalId} onChange={setProfessionalId} professionals={professionals} />
      </div>
      <div style={{ display: "flex", gap: "10px" }}>
        <div className="field" style={{ flex: 1 }}>
          <label className="field-label">From</label>
          <input
            type="datetime-local"
            className="input"
            value={startAt}
            onChange={(e) => setStartAt(e.target.value)}
            required
          />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label className="field-label">To</label>
          <input
            type="datetime-local"
            className="input"
            value={endAt}
            onChange={(e) => setEndAt(e.target.value)}
            required
          />
        </div>
      </div>
      <div className="field">
        <label className="field-label">Reason (optional)</label>
        <input
          type="text"
          className="input"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Vacation, holiday…"
        />
      </div>
      <button type="submit" className="btn btn-secondary btn-full" disabled={saving}>
        {saving ? "Adding…" : "Block time off"}
      </button>
    </form>
  );
}
