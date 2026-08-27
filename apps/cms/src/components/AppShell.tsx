import { useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";
import { useI18n } from "../i18n/I18nContext.js";
import { Brand } from "./ui/Brand.js";
import { Icon } from "./ui/Icon.js";
import { LanguageSwitcher } from "./LanguageSwitcher.js";
import { cx } from "../lib/cx.js";
import styles from "./AppShell.module.css";

interface NavItem {
  to: string;
  icon: string;
  labelKey: string;
}

interface AppShellProps {
  title: string;
  subtitle?: string;
  tenantSubdomain?: string;
  children: ReactNode;
}

// Nav only lists routes that actually exist — no placeholder links to
// not-yet-built pages.
export function AppShell({ title, subtitle, tenantSubdomain, children }: AppShellProps) {
  const { role, logout } = useAuth();
  const { t } = useI18n();
  const location = useLocation();
  // Off-canvas drawer state — only meaningful below the shell breakpoint; on
  // wide screens the sidebar is always visible and this flag is inert.
  const [navOpen, setNavOpen] = useState(false);

  const navItems: NavItem[] = [
    { to: "/", icon: "space_dashboard", labelKey: "nav.dashboard" },
    // Bookings is the one management page both roles get (R10/R20).
    { to: "/bookings", icon: "event_available", labelKey: "nav.bookings" },
    ...(role === "owner"
      ? [
          { to: "/services", icon: "design_services", labelKey: "nav.services" },
          { to: "/professionals", icon: "diversity_3", labelKey: "nav.professionals" },
          { to: "/settings/colors", icon: "palette", labelKey: "nav.colors" },
        ]
      : []),
  ];

  return (
    <div className={styles.shell}>
      <aside className={cx(styles.sidebar, navOpen && styles.sidebarOpen)}>
        <div className={styles.brand}>
          <Brand />
        </div>
        <nav className={styles.nav}>
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cx(styles.navItem, location.pathname === item.to && styles.navItemActive)}
              onClick={() => setNavOpen(false)}
            >
              <Icon name={item.icon} />
              <span>{t(item.labelKey)}</span>
            </Link>
          ))}
        </nav>
        <div className={styles.foot}>
          <div className={styles.avatar}>
            <Icon name="person" size={18} />
          </div>
          <div className={styles.footText}>
            <div className={styles.footName}>{t(role === "owner" ? "roles.owner" : "roles.professional")}</div>
            <button onClick={logout} className={styles.signout}>
              {t("shell.signOut")}
            </button>
          </div>
        </div>
      </aside>

      {navOpen && <div className={styles.backdrop} onClick={() => setNavOpen(false)} />}

      <div className={styles.main}>
        <header className={styles.topbar}>
          <button className={styles.menuButton} onClick={() => setNavOpen(true)} aria-label={t("shell.openMenu")}>
            <Icon name="menu" />
          </button>
          <div className={styles.titleWrap}>
            <div className={styles.title}>{title}</div>
            {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
          </div>
          <div className={styles.topRight}>
            <LanguageSwitcher />
            {tenantSubdomain && (
              <div className={styles.tenant}>
                <Icon name="storefront" size={18} color="var(--accent)" />
                <span className={styles.tenantName}>{tenantSubdomain}</span>
              </div>
            )}
          </div>
        </header>
        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
