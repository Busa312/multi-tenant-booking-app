import { useEffect, useState, type FormEvent } from "react";
import type { InviteProfessionalResponse, ProfessionalSummary, Service } from "@booking/shared-types";
import { ApiError } from "@booking/api-client";
import { cmsApiClient } from "../lib/api.js";
import { useI18n } from "../i18n/I18nContext.js";
import { AppShell } from "../components/AppShell.js";
import { Modal } from "../components/Modal.js";
import {
  Alert,
  Button,
  ButtonLink,
  Checkbox,
  Eyebrow,
  Field,
  InputGroup,
  Pill,
  type PillTone,
  Table,
  TableHead,
  TableRow,
  TableEmpty,
  TextInput,
} from "../components/ui/index.js";
import styles from "./Professionals.module.css";

const COLUMNS = "1.3fr 1.6fr 130px 110px 200px";

const LOGIN_STATUS_KEY: Record<ProfessionalSummary["cmsLoginStatus"], string> = {
  none: "professionals.statusNoLogin",
  invited: "professionals.statusInvited",
  active: "professionals.statusActive",
};
const LOGIN_STATUS_TONE: Record<ProfessionalSummary["cmsLoginStatus"], PillTone> = {
  none: "neutral",
  invited: "warning",
  active: "success",
};

export function ProfessionalsPage() {
  const { t } = useI18n();
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
      .catch(() => setListError(t("professionals.errLoad")));
  }

  // Fetch once on mount; a language switch shouldn't trigger a refetch.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, []);

  function serviceNames(p: ProfessionalSummary): string {
    if (!services || p.serviceIds.length === 0) return t("professionals.noServicesAssigned");
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
      setListError(t("professionals.errCheckUpcoming"));
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
      setListError(t("professionals.errDeactivate"));
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
      setListError(t("professionals.errReactivate"));
    }
  }

  async function handleDelete(p: ProfessionalSummary) {
    if (!window.confirm(t("professionals.confirmDelete", { name: p.name }))) return;
    setListError(null);
    try {
      await cmsApiClient.deleteProfessional(p.id);
      load();
    } catch (err) {
      setListError(t(err instanceof ApiError ? "professionals.errHasHistory" : "common.somethingWrong"));
    }
  }

  return (
    <AppShell title={t("professionals.title")} subtitle={t("professionals.subtitle")}>
      <div className="fade-up">
        <div className={styles.toolbar}>
          <div className={styles.count}>
            {professionals ? t("professionals.count", { count: professionals.length }) : t("common.loading")}
          </div>
          <Button className={styles.add} icon="person_add" onClick={() => setEditTarget("new")}>
            {t("professionals.add")}
          </Button>
        </div>

        {listError && <Alert>{listError}</Alert>}

        {professionals && (
          <div className={styles.tableScroll}>
            <Table className={styles.table}>
              <TableHead columns={COLUMNS}>
                <div>{t("professionals.colName")}</div>
                <div>{t("professionals.colServices")}</div>
                <div>{t("professionals.colLogin")}</div>
                <div>{t("professionals.colStatus")}</div>
                <div></div>
              </TableHead>
              {professionals.map((p) => (
                <TableRow key={p.id} columns={COLUMNS}>
                  <div className={styles.name}>{p.name}</div>
                  <div className={styles.services}>{serviceNames(p)}</div>
                  <div>
                    <Pill tone={LOGIN_STATUS_TONE[p.cmsLoginStatus]}>{t(LOGIN_STATUS_KEY[p.cmsLoginStatus])}</Pill>
                  </div>
                  <div>
                    <Pill tone={p.isActive ? "success" : "danger"}>
                      {t(p.isActive ? "professionals.active" : "professionals.inactive")}
                    </Pill>
                  </div>
                  <div className={styles.actions}>
                    <Button variant="secondary" size="sm" onClick={() => setEditTarget(p)}>
                      {t("professionals.edit")}
                    </Button>
                    <ButtonLink to={`/hours?professionalId=${p.id}`} variant="secondary" size="sm">
                      {t("professionals.hours")}
                    </ButtonLink>
                    {p.cmsLoginStatus === "none" && (
                      <Button variant="secondary" size="sm" onClick={() => setInviteTarget(p)}>
                        {t("professionals.invite")}
                      </Button>
                    )}
                    {p.isActive ? (
                      <Button variant="secondary" size="sm" onClick={() => handleDeactivateClick(p)}>
                        {t("professionals.deactivate")}
                      </Button>
                    ) : (
                      <Button variant="secondary" size="sm" onClick={() => handleReactivate(p)}>
                        {t("professionals.reactivate")}
                      </Button>
                    )}
                    {!p.hasAppointmentHistory && (
                      <Button variant="secondary" size="sm" danger onClick={() => handleDelete(p)}>
                        {t("professionals.delete")}
                      </Button>
                    )}
                  </div>
                </TableRow>
              ))}
              {professionals.length === 0 && <TableEmpty>{t("professionals.empty")}</TableEmpty>}
            </Table>
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
          title={t("professionals.deactivateTitle")}
          onClose={() => setDeactivateTarget(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setDeactivateTarget(null)} disabled={deactivateLoading}>
                {t("common.cancel")}
              </Button>
              <Button onClick={confirmDeactivate} disabled={deactivateLoading}>
                {deactivateLoading ? t("professionals.deactivating") : t("professionals.deactivate")}
              </Button>
            </>
          }
        >
          {deactivateTarget.count > 0 ? (
            <Alert variant="warning" className={styles.flush}>
              {t(deactivateTarget.count === 1 ? "professionals.upcomingWarning_one" : "professionals.upcomingWarning_other", {
                count: deactivateTarget.count,
                name: deactivateTarget.professional.name,
              })}
            </Alert>
          ) : (
            <p className={styles.muted}>
              {t("professionals.noUpcoming", { name: deactivateTarget.professional.name })}
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
  const { t } = useI18n();
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
      setError(t("professionals.errSave"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={isNew ? t("professionals.editTitleNew") : t("professionals.editTitleEdit")}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form="professional-form" disabled={saving}>
            {saving ? t("common.saving") : isNew ? t("common.create") : t("common.save")}
          </Button>
        </>
      }
    >
      <form id="professional-form" onSubmit={handleSubmit}>
        <Field label={t("professionals.nameLabel")} htmlFor="prof-name">
          <TextInput
            id="prof-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("professionals.namePlaceholder")}
            required
          />
        </Field>

        <Eyebrow>{t("professionals.servicesPerformed")}</Eyebrow>
        {services.length === 0 && <p className={styles.noServices}>{t("professionals.noServicesCreated")}</p>}
        <div className={styles.serviceList}>
          {services.map((s) => (
            <Checkbox key={s.id} checked={serviceIds.includes(s.id)} onChange={() => toggleService(s.id)}>
              {s.name}
            </Checkbox>
          ))}
        </div>

        {error && <Alert>{error}</Alert>}
      </form>
    </Modal>
  );
}

function InviteModal({ professional, onClose }: { professional: ProfessionalSummary; onClose: () => void }) {
  const { t, lang } = useI18n();
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
      setError(t(err instanceof ApiError ? "professionals.errEmailInUse" : "common.somethingWrong"));
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal title={t("professionals.inviteTitle", { name: professional.name })} onClose={onClose}>
      {!result ? (
        <form onSubmit={handleSubmit}>
          <Field label={t("professionals.inviteEmailLabel")} htmlFor="invite-email">
            <TextInput
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("professionals.inviteEmailPlaceholder")}
              required
            />
          </Field>
          {error && <Alert>{error}</Alert>}
          <Button type="submit" fullWidth disabled={sending}>
            {sending ? t("professionals.sending") : t("professionals.createLink")}
          </Button>
        </form>
      ) : (
        <div>
          <Alert variant="success">
            {t("professionals.inviteSuccess", {
              email: result.email,
              date: new Date(result.expiresAt).toLocaleDateString(lang === "ka" ? "ka-GE" : "en-US"),
            })}
          </Alert>
          <InputGroup
            readOnly
            value={setPasswordUrl ?? ""}
            className={styles.inviteLink}
            action={{ label: t("common.copy"), onClick: () => setPasswordUrl && navigator.clipboard.writeText(setPasswordUrl) }}
          />
          <Button type="button" variant="secondary" fullWidth onClick={onClose}>
            {t("common.done")}
          </Button>
        </div>
      )}
    </Modal>
  );
}
