import { useId, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";
import { useI18n } from "../i18n/I18nContext.js";
import { Brand } from "./ui/Brand.js";
import { Icon } from "./ui/Icon.js";
import { LanguageSwitcher } from "./LanguageSwitcher.js";
import { ThemeToggle } from "./ThemeToggle.js";
import { cx } from "../lib/cx.js";

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

// daisyUI drawer: the sidebar is pinned open from `lg` up and slides over the
// content below it.
export function AppShell({ title, subtitle, tenantSubdomain, children }: AppShellProps) {
  const { role, logout } = useAuth();
  const { t } = useI18n();
  const location = useLocation();
  const drawerId = useId();

  const [navOpen, setNavOpen] = useState(false);

  const navItems: NavItem[] = [
    { to: "/", icon: "space_dashboard", labelKey: "nav.dashboard" },
    { to: "/bookings", icon: "event_available", labelKey: "nav.bookings" },
    ...(role === "owner"
      ? [
          { to: "/services", icon: "design_services", labelKey: "nav.services" },
          { to: "/professionals", icon: "diversity_3", labelKey: "nav.professionals" },
          // R150: sits next to the roster
          { to: "/locations", icon: "storefront", labelKey: "nav.locations" },
          { to: "/settings/colors", icon: "palette", labelKey: "nav.colors" },
          { to: "/settings/public-site", icon: "edit_note", labelKey: "nav.publicSite" },
        ]
      : []),
  ];

  return (
    <div className="drawer lg:drawer-open">
      <input
        id={drawerId}
        type="checkbox"
        className="drawer-toggle"
        checked={navOpen}
        onChange={(e) => setNavOpen(e.target.checked)}
      />

      <div className="drawer-content flex min-h-dvh min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-base-300 bg-base-200/85 px-4 py-3 backdrop-blur-md sm:px-6 lg:px-8">
          <button
            type="button"
            className="btn btn-square btn-ghost btn-sm lg:hidden"
            onClick={() => setNavOpen(true)}
            aria-label={t("shell.openMenu")}
          >
            <Icon name="menu" />
          </button>

          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-xl leading-tight font-semibold sm:text-2xl">{title}</h1>
            {subtitle && <p className="truncate text-sm text-base-content/60">{subtitle}</p>}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {tenantSubdomain && (
              <span className="badge hidden gap-1.5 border-base-300 bg-base-100 py-3 font-semibold md:inline-flex">
                <Icon name="storefront" size={16} className="text-primary" />
                {tenantSubdomain}
              </span>
            )}
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>

      <div className="drawer-side z-40">
        <label htmlFor={drawerId} aria-label={t("common.close")} className="drawer-overlay" />
        <aside className="flex min-h-full w-64 flex-col border-r border-base-300 bg-base-100">
          <div className="px-5 pt-6 pb-5">
            <Brand />
          </div>

          <nav className="flex-1 px-3">
            <ul className="menu w-full gap-1 p-0">
              {navItems.map((item) => {
                const active = location.pathname === item.to;
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      aria-current={active ? "page" : undefined}
                      className={cx(
                        "gap-3 rounded-field px-3 py-2.5 font-medium text-base-content/75",
                        // shadow-none: daisyUI styles an aria-current item as its
                        // neutral "active" pill, shadow included; we keep only our tint.
                        active && "bg-primary/10 font-semibold text-primary shadow-none hover:bg-primary/15",
                      )}
                      onClick={() => setNavOpen(false)}
                    >
                      <Icon name={item.icon} />
                      {t(item.labelKey)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="m-3 flex items-center gap-3 rounded-box bg-base-200/70 p-3">
            <div className="avatar avatar-placeholder">
              <div className="w-9 rounded-full bg-primary/15 text-primary">
                <Icon name="person" size={18} />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">
                {t(role === "owner" ? "roles.owner" : "roles.professional")}
              </div>
              <button
                type="button"
                onClick={logout}
                className="text-xs font-medium text-base-content/60 hover:text-primary"
              >
                {t("shell.signOut")}
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
