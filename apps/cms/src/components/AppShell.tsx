import { useEffect, useId, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";
import { useI18n } from "../i18n/I18nContext.js";
import { Brand } from "./ui/Brand.js";
import { Icon } from "./ui/Icon.js";
import { LanguageSwitcher } from "./LanguageSwitcher.js";
import { ThemeToggle } from "./ThemeToggle.js";
import { SubscriptionBanner } from "./SubscriptionBanner.js";
import { cachedApi } from "../lib/cache.js";
import { cx } from "../lib/cx.js";
import { publicSiteUrl } from "../lib/publicSiteUrl.js";
import type { IconName } from "../lib/iconNames.js";

interface NavItem {
  to: string;
  icon: IconName;
  labelKey: string;
}

interface NavGroup {
  /** Heading above the group; the first group (the daily work) has none. */
  labelKey?: string;
  items: NavItem[];
}

interface AppShellProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

// daisyUI drawer: the sidebar is pinned open from `lg` up and slides over the
// content below it.
export function AppShell({ title, subtitle, children }: AppShellProps) {
  const { role, logout } = useAuth();
  const { t } = useI18n();
  const location = useLocation();
  const drawerId = useId();

  const [navOpen, setNavOpen] = useState(false);
  // Whose CMS this is, on every page: the cached tenant at once, then the fresh one.
  const [tenant, setTenant] = useState(cachedApi.peekTenant);

  useEffect(() => {
    let live = true;
    cachedApi
      .getTenant()
      .then((fresh) => {
        if (live) setTenant(fresh);
      })
      // The pages report load failures; the sidebar just goes without a name.
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  // R420: the setup guide is in the menu only while it is unfinished. Hidden
  // until known, so a finished salon never sees it flash in.
  const [setupOpen, setSetupOpen] = useState(() => {
    const known = cachedApi.peekOnboarding();
    return known !== undefined && !known.dismissed;
  });

  useEffect(() => {
    if (role !== "owner") return undefined;
    let live = true;
    cachedApi
      .getOnboardingCached()
      .then((status) => {
        if (live) setSetupOpen(!status.dismissed);
      })
      .catch(() => undefined);
    const stop = cachedApi.onOnboardingChange((status) => setSetupOpen(!status.dismissed));
    return () => {
      live = false;
      stop();
    };
  }, [role]);

  // Grouped by what a person comes here to do: run the day, set the salon up,
  // or change what customers see. The last two are owner-only (as the routes are).
  const navGroups: NavGroup[] = [
    {
      items: [
        { to: "/", icon: "space_dashboard", labelKey: "nav.dashboard" },
        { to: "/bookings", icon: "event_available", labelKey: "nav.bookings" },
      ],
    },
    ...(role === "owner"
      ? ([
          {
            labelKey: "nav.groupSetup",
            items: [
              // R420: until the setup is finished or hidden
              ...(setupOpen ? [{ to: "/setup", icon: "flag", labelKey: "nav.setup" } satisfies NavItem] : []),
              { to: "/services", icon: "design_services", labelKey: "nav.services" },
              { to: "/professionals", icon: "diversity_3", labelKey: "nav.professionals" },
              // R150: sits next to the roster
              { to: "/locations", icon: "storefront", labelKey: "nav.locations" },
              { to: "/hours", icon: "schedule", labelKey: "nav.hours" },
              // R380
              { to: "/blocked-numbers", icon: "block", labelKey: "nav.blockedNumbers" },
            ],
          },
          {
            labelKey: "nav.groupSite",
            items: [
              { to: "/settings/colors", icon: "palette", labelKey: "nav.colors" },
              { to: "/settings/public-site", icon: "edit_note", labelKey: "nav.publicSite" },
            ],
          },
          {
            labelKey: "nav.groupAccount",
            items: [{ to: "/settings/subscription", icon: "credit_card", labelKey: "nav.subscription" }],
          },
        ] satisfies NavGroup[])
      : []),
  ];

  const siteUrl = tenant ? publicSiteUrl(tenant.subdomain) : null;

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
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-base-300 bg-base-200 px-4 py-3 sm:px-6 lg:px-8">
          <button
            type="button"
            className="btn btn-square btn-ghost btn-sm lg:hidden"
            onClick={() => setNavOpen(true)}
            aria-label={t("shell.openMenu")}
          >
            <Icon name="menu" />
          </button>

          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-2xl leading-tight font-bold sm:text-3xl">{title}</h1>
            {subtitle && <p className="truncate text-sm text-base-content/60">{subtitle}</p>}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6 lg:p-8">
          {/* R480/R490: trial ending, payment due, booking paused */}
          {role === "owner" && <SubscriptionBanner />}
          {children}
        </main>
      </div>

      <div className="drawer-side z-40">
        <label htmlFor={drawerId} aria-label={t("common.close")} className="drawer-overlay" />
        <aside className="flex h-full w-60 flex-col border-r border-base-300 bg-base-200">
          <div className="flex-none px-5 pt-5 pb-4">
            <Brand />
          </div>

          {/* Scrolls on a short screen, so the last item never sits against the footer. */}
          <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-6">
            {navGroups.map((group) => (
              <div key={group.labelKey ?? "daily"}>
                {group.labelKey && (
                  <h2 className="px-3 pt-4 pb-1 text-xs font-semibold text-base-content/55">{t(group.labelKey)}</h2>
                )}
                <ul className="menu w-full gap-0.5 p-0">
                  {group.items.map((item) => {
                    const active = location.pathname === item.to;
                    return (
                      <li key={item.to}>
                        <Link
                          to={item.to}
                          aria-current={active ? "page" : undefined}
                          className={cx(
                            "gap-3 rounded-field px-3 py-2",
                            // The highlighter marks where you are. One color and one
                            // weight per state, never both (Tailwind doesn't resolve
                            // them by order). shadow-none: daisyUI styles an
                            // aria-current item as its neutral "active" pill, shadow
                            // included; we keep only the highlight.
                            active
                              ? "bg-accent font-semibold text-accent-content shadow-none hover:bg-accent"
                              : "font-medium text-base-content/70",
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
              </div>
            ))}
          </nav>

          {/* Whose CMS this is, then the two things to do about it — rows like the menu above. */}
          <div className="flex-none border-t border-base-300 px-3 pt-3 pb-3">
            <div className="px-3 pb-1.5">
              <div className="truncate text-sm font-semibold">{tenant?.name ?? "\u00a0"}</div>
              <div className="truncate text-xs text-base-content/55">
                {t(role === "owner" ? "roles.owner" : "roles.professional")}
              </div>
            </div>
            <ul className="menu w-full gap-0.5 p-0">
              {siteUrl && (
                <li>
                  <a
                    href={siteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="gap-3 rounded-field px-3 py-2 font-medium text-base-content/70"
                  >
                    <Icon name="open_in_new" />
                    {t("nav.viewSite")}
                  </a>
                </li>
              )}
              <li>
                <button
                  type="button"
                  className="gap-3 rounded-field px-3 py-2 font-medium text-base-content/70"
                  onClick={() => void logout()}
                >
                  <Icon name="logout" />
                  {t("shell.signOut")}
                </button>
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
