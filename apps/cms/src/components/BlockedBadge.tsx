import { useI18n } from "../i18n/I18nContext.js";
import { Icon, Pill } from "./ui/index.js";

interface BlockedBadgeProps {
  /** R380: this salon has blocked the customer's number from booking online. */
  blocked: boolean;
  className?: string;
}

/** Marks a booking whose customer this salon has blocked. Renders nothing otherwise. */
export function BlockedBadge({ blocked, className }: BlockedBadgeProps) {
  const { t } = useI18n();

  if (!blocked) {
    return null;
  }

  return (
    <Pill tone="danger" className={className}>
      <Icon name="block" size={14} />
      {t("blocked.badge")}
    </Pill>
  );
}
