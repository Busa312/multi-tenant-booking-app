import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import type { InviteProfessionalResponse, ProfessionalSummary, Service } from "@booking/shared-types";
import { ApiError } from "@booking/api-client";
import { cmsApiClient } from "../lib/api.js";
import { AppShell } from "../components/AppShell.js";
import { Modal } from "../components/Modal.js";

const LOGIN_STATUS_LABEL: Record<ProfessionalSummary["cmsLoginStatus"], string> = {
  none: "No login",
  invited: "Invited",
  active: "Active",
};
const LOGIN_STATUS_COLOR: Record<ProfessionalSummary["cmsLoginStatus"], { fg: string; bg: string }> = {
  none: { fg: "#7d746a", bg: "#f0ece5" },
  invited: { fg: "#8a6a2f", bg: "#f7efdc" },
  active: { fg: "#3f6b4a", bg: "#e8f1ea" },
};

export function ProfessionalsPage() {
  const [professionals, setProfessionals] = useState<ProfessionalSummary[] | null>(null);
  const [services, setServices] = useState<Service[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const [editTarget, setEditTarget] = useState<ProfessionalSummary | "new" | null>(null);
  const [inviteTarget, setInviteTarget] = useState<ProfessionalSummary | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<{ professional: ProfessionalSummary; count: number } | null>(
    null,
  );
  const [deactivateLoading, setDeactivateLoading] = useState(false);

  function load() {
    Promise.all([cmsApiClient.listProfessionals(), cmsApiClient.listServices()])
      .then(([p, s]) => {
        setProfessionals(p);
        setServices(s);
      })
      .catch(() => setListError("Could not load professionals"));
  }

  useEffect(load, []);

  function serviceNames(p: ProfessionalSummary): string {
    if (!services || p.serviceIds.length === 0) return "No services assigned";
    return p.serviceIds
      .map((id) => services.find((s) => s.id === id)?.name)
      .filter(Boolean)
      .join(", ");
  }

  async function handleDeactivateClick(p: ProfessionalSummary) {
    setListError(null);
    try {
      const { count } = await cmsApiClient.getProfessionalUpcomingCount(p.id);
      setDeactivateTarget({ professional: p, count });
    } catch {
      setListError("Could not check upcoming appointments");
    }
  }

  async function confirmDeactivate() {
    if (!deactivateTarget) return;
    setDeactivateLoading(true);
    try {
      await cmsApiClient.updateProfessional(deactivateTarget.professional.id, { isActive: false });
      setDeactivateTarget(null);
      load();
    } catch {
      setListError("Could not deactivate this professional");
    } finally {
      setDeactivateLoading(false);
    }
  }

  async function handleReactivate(p: ProfessionalSummary) {
    setListError(null);
    try {
      await cmsApiClient.updateProfessional(p.id, { isActive: true });
      load();
    } catch {
      setListError("Could not reactivate this professional");
    }
  }

  async function handleDelete(p: ProfessionalSummary) {
    if (!window.confirm(`Delete ${p.name}? This can't be undone.`)) return;
    setListError(null);
    try {
      await cmsApiClient.deleteProfessional(p.id);
      load();
    } catch (err) {
      setListError(
        err instanceof ApiError ? "This professional has appointment history and can't be deleted" : "Something went wrong",
      );
    }
  }

  return (
    <AppShell title="Professionals" subtitle="Your team and what they perform">
      <div className="fade-up">
        <div style={{ display: "flex", alignItems: "center", marginBottom: "18px" }}>
          <div style={{ color: "var(--ink-soft)", fontSize: "13px" }}>
            {professionals ? `${professionals.length} professionals` : "Loading…"}
          </div>
          <button className="btn btn-primary" style={{ marginLeft: "auto" }} onClick={() => setEditTarget("new")}>
            <span className="ms" style={{ fontSize: "19px" }}>
              person_add
            </span>
            Add professional
          </button>
        </div>

        {listError && (
          <p className="alert alert-error" role="alert">
            {listError}
          </p>
        )}

        {professionals && (
          <div className="table">
            <div className="table-head" style={{ gridTemplateColumns: "1.3fr 1.6fr 130px 110px 200px" }}>
              <div>Name</div>
              <div>Services</div>
              <div>CMS login</div>
              <div>Status</div>
              <div></div>
            </div>
            {professionals.map((p) => (
              <div key={p.id} className="table-row" style={{ gridTemplateColumns: "1.3fr 1.6fr 130px 110px 200px" }}>
                <div style={{ fontWeight: 600 }}>{p.name}</div>
                <div style={{ fontSize: "13px", color: "var(--ink-soft)" }}>{serviceNames(p)}</div>
                <div>
                  <span
                    className="pill"
                    style={{
                      color: LOGIN_STATUS_COLOR[p.cmsLoginStatus].fg,
                      background: LOGIN_STATUS_COLOR[p.cmsLoginStatus].bg,
                    }}
                  >
                    {LOGIN_STATUS_LABEL[p.cmsLoginStatus]}
                  </span>
                </div>
                <div>
                  <span
                    className="pill"
                    style={
                      p.isActive
                        ? { color: "#3f6b4a", background: "#e8f1ea" }
                        : { color: "#9a4a45", background: "#f6e4e2" }
                    }
                  >
                    {p.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "4px", flexWrap: "wrap" }}>
                  <button className="btn btn-secondary" onClick={() => setEditTarget(p)} style={{ padding: "6px 10px", fontSize: "12px" }}>
                    Edit
                  </button>
                  <Link
                    to={`/hours?professionalId=${p.id}`}
                    className="btn btn-secondary"
                    style={{ padding: "6px 10px", fontSize: "12px" }}
                  >
                    Hours
                  </Link>
                  {p.cmsLoginStatus === "none" && (
                    <button
                      className="btn btn-secondary"
                      onClick={() => setInviteTarget(p)}
                      style={{ padding: "6px 10px", fontSize: "12px" }}
                    >
                      Invite to CMS
                    </button>
                  )}
                  {p.isActive ? (
                    <button
                      className="btn btn-secondary"
                      onClick={() => handleDeactivateClick(p)}
                      style={{ padding: "6px 10px", fontSize: "12px" }}
                    >
                      Deactivate
                    </button>
                  ) : (
                    <button
                      className="btn btn-secondary"
                      onClick={() => handleReactivate(p)}
                      style={{ padding: "6px 10px", fontSize: "12px" }}
                    >
                      Reactivate
                    </button>
                  )}
                  {!p.hasAppointmentHistory && (
                    <button
                      className="btn btn-secondary"
                      onClick={() => handleDelete(p)}
                      style={{ padding: "6px 10px", fontSize: "12px", color: "var(--danger)" }}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
            {professionals.length === 0 && (
              <div style={{ padding: "24px 20px", color: "var(--ink-soft)", fontSize: "13.5px" }}>
                No professionals yet.
              </div>
            )}
          </div>
        )}
      </div>

      {editTarget && (
        <EditProfessionalModal
          target={editTarget}
          services={services ?? []}
          onClose={() => setEditTarget(null)}
          onSaved={() => {
            setEditTarget(null);
            load();
          }}
        />
      )}

      {inviteTarget && <InviteModal professional={inviteTarget} onClose={() => setInviteTarget(null)} />}

      {deactivateTarget && (
        <Modal
          title="Deactivate professional?"
          onClose={() => setDeactivateTarget(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setDeactivateTarget(null)} disabled={deactivateLoading}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={confirmDeactivate} disabled={deactivateLoading}>
                {deactivateLoading ? "Deactivating…" : "Deactivate"}
              </button>
            </>
          }
        >
          {deactivateTarget.count > 0 ? (
            <p className="alert alert-warning" role="alert" style={{ margin: 0 }}>
              {deactivateTarget.count} upcoming appointment{deactivateTarget.count === 1 ? "" : "s"} — they'll stay
              booked, but {deactivateTarget.professional.name} won't be offered for new bookings.
            </p>
          ) : (
            <p style={{ margin: 0, color: "var(--ink-soft)", fontSize: "13.5px" }}>
              {deactivateTarget.professional.name} won't be offered for new bookings. Existing appointments are
              unaffected.
            </p>
          )}
        </Modal>
      )}
    </AppShell>
  );
}

function EditProfessionalModal({
  target,
  services,
  onClose,
  onSaved,
}: {
  target: ProfessionalSummary | "new";
  services: Service[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = target === "new";
  const [name, setName] = useState(isNew ? "" : target.name);
  const [serviceIds, setServiceIds] = useState<string[]>(isNew ? [] : target.serviceIds);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleService(id: string) {
    setServiceIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      if (isNew) {
        await cmsApiClient.createProfessional({ name, serviceIds });
      } else {
        await cmsApiClient.updateProfessional(target.id, { name, serviceIds });
      }
      onSaved();
    } catch {
      setError("Could not save this professional");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={isNew ? "Add professional" : "Edit professional"}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" form="professional-form" className="btn btn-primary" disabled={saving}>
            {saving ? "Saving…" : isNew ? "Create" : "Save changes"}
          </button>
        </>
      }
    >
      <form id="professional-form" onSubmit={handleSubmit}>
        <div className="field">
          <label className="field-label" htmlFor="prof-name">
            Name
          </label>
          <input
            id="prof-name"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Camille Rousseau"
            required
          />
        </div>

        <div className="eyebrow">Services performed</div>
        {services.length === 0 && (
          <p style={{ color: "var(--ink-soft)", fontSize: "13px", margin: "0 0 12px" }}>No services created yet.</p>
        )}
        <div style={{ marginBottom: "6px" }}>
          {services.map((s) => (
            <label className="checkbox-row" key={s.id}>
              <input type="checkbox" checked={serviceIds.includes(s.id)} onChange={() => toggleService(s.id)} />
              {s.name}
            </label>
          ))}
        </div>

        {error && (
          <p className="alert alert-error" role="alert">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}

function InviteModal({ professional, onClose }: { professional: ProfessionalSummary; onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InviteProfessionalResponse | null>(null);

  const setPasswordUrl = result ? `${window.location.origin}/set-password/${result.tenantId}/${result.token}` : null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSending(true);
    try {
      const res = await cmsApiClient.inviteProfessional(professional.id, { email });
      setResult(res);
    } catch (err) {
      setError(err instanceof ApiError ? "That email is already in use for this tenant" : "Something went wrong");
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal title={`Invite ${professional.name} to the CMS`} onClose={onClose}>
      {!result ? (
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label className="field-label" htmlFor="invite-email">
              Email
            </label>
            <input
              id="invite-email"
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="professional@salon.com"
              required
            />
          </div>
          {error && (
            <p className="alert alert-error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="btn btn-primary btn-full" disabled={sending}>
            {sending ? "Sending…" : "Create invite link"}
          </button>
        </form>
      ) : (
        <div>
          <p className="alert alert-success" role="status">
            Invite created. Send this link to {result.email} — it expires{" "}
            {new Date(result.expiresAt).toLocaleDateString()}.
          </p>
          <div className="input-group" style={{ marginBottom: "16px" }}>
            <input readOnly value={setPasswordUrl ?? ""} style={{ fontSize: "12.5px" }} />
            <button
              type="button"
              className="input-group-suffix"
              style={{ border: "none", cursor: "pointer", background: "var(--accent)", color: "var(--accent-ink)" }}
              onClick={() => setPasswordUrl && navigator.clipboard.writeText(setPasswordUrl)}
            >
              Copy
            </button>
          </div>
          <button type="button" className="btn btn-secondary btn-full" onClick={onClose}>
            Done
          </button>
        </div>
      )}
    </Modal>
  );
}
