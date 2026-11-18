Act as an lead software engineer. look into [[system_design]] and [[Unified Requirements and Data Model]] for references. Don't build anyting that contradicts these files.

# Repository Rules

These rules codify the conventions already used across this monorepo. Follow them for all new code. Items marked `[R]` are recommended decisions on current inconsistencies — apply them going forward. Nothing here overrides `system_design.md` or `Unified Requirements and Data Model.md`; those remain the source of truth.

## 1. Monorepo & tooling
- pnpm workspaces + Turborepo; Node ≥20 (`.nvmrc`). Use `pnpm`, never `npm`/`yarn`.
- Run everything through Turbo scripts: `pnpm dev|build|lint|typecheck|test`; DB tasks via `pnpm db:migrate|generate|seed` (scoped to `@booking/api`).
- All packages/apps live under the `@booking/*` scope. Shared config lives in `packages/config`; extend those presets, don't fork them.
- TypeScript is `strict` with `noUncheckedIndexedAccess` everywhere — honor it (guard array/index access; avoid non-null-assertion escapes).

## 2. Multi-tenancy & data access (highest priority)
- **Every tenant-scoped DB query goes through `PrismaService.forTenant(tx => …)`** (`apps/api/src/prisma/prisma.service.ts`). Never touch the raw `prisma.client` except in pre-tenant resolution code (`TenantResolverService`).
- Always also pass explicit `where: { tenantId }` — defense in depth alongside Postgres RLS.
- A customer is matched by `phoneKey` (R400, `common/phone-key.ts`), never by the raw `phoneNumber`: write it on every appointment, and look customers up by it.
- Every new table carries `tenant_id` + an RLS policy. RLS policies and partial-unique constraints are hand-written in `prisma/migrations/*_rls/migration.sql` (not expressible in the Prisma DSL).
- Tenant identity comes from `TenantContextService` (AsyncLocalStorage): `.current` throws if unset, `.currentOrNull` for optional. Never plumb `tenant_id` manually through call arguments.
- Intra-tenant role checks (owner vs professional) live in the API layer (`RolesGuard` + `@Roles(...)`), **not** in Postgres.
- Prisma schema: camelCase TS fields ↔ snake_case DB via `@map`/`@@map`; UUID PKs `@default(uuid()) @db.Uuid`; `@db.Timestamptz` for times; `@@index([tenantId])` on tenant-scoped tables.

## 3. NestJS (apps/api)
- kebab-case files with a dotted role suffix: `*.controller.ts`, `*.service.ts`, `*.module.ts`, `*.middleware.ts`, `*.guard.ts`, `*.decorator.ts`, `*.strategy.ts`.
- One controller per resource; group by feature module; wire into `app.module.ts`. Keep controllers thin.
- Inject dependencies as `private readonly`. Type every handler's `@Body()` and return value against `@booking/shared-types`.
- Throw Nest HTTP exceptions (`ConflictException`, `NotFoundException`, …). Unimplemented endpoints throw `NotImplementedException` with a message rather than being omitted.
- Every endpoint reachable without a login, or that guards one, carries `@RateLimit(...)` (R330); per-account/per-phone limits go through `RateLimitService` in the service. Never write raw Redis counters for this.
- Convert Prisma `Date`/`Decimal` to wire types **only** through `common/serializers.ts` — never cast inline. The wire contract uses `string` for dates and for `price`.
- **DTO duality:** request/response *types* are interfaces in `@booking/shared-types`; parallel Swagger *classes* with `@ApiProperty()` live in `common/dto.ts`, kept in sync by hand. Update both.
- Tag code that implements a spec requirement with its `// Rxx:` comment linking back to the requirements doc.

## 4. React / Next components
- **Exactly one component per file — no exceptions.** A page's modals and sub-forms get their own files too, even when nothing else will ever use them; a file that renders two components gets split. Styling lives in each component's own JSX (§6), so a split carries its classes with it. Component files are PascalCase.
- CMS (`apps/cms`): named exports; route components in `pages/` with a `Page` suffix, every other component in `components/` — including page-specific ones like `EditServiceModal`. Data fetching = `useState`/`useEffect` + a local `load()`, `null` as the loading sentinel, an error string in state. Use Context only for cross-cutting state (auth); consumer hooks like `useAuth` throw when used outside their provider. The CMS never holds a session token (R320): the API keeps it in an httpOnly cookie, `cmsApiClient` sends `credentials: "include"` plus the `X-Requested-With: booking-cms` header the CSRF guard requires, and who's signed in comes from `/cms/auth/me` — never store a token in `localStorage` or decode one client-side. Show service/professional/location names and descriptions through `useLocalizedName()` (`lib/useLocalizedName.ts`), never `.name` directly — it picks the translation for the CMS language (R160); plain helpers like `serviceLabel` take its picker as an argument. Translatable inputs are `LocalizedField`s driven by **one** `ContentLocaleSelect` per form (a modal's `headerAction`, or the top of a settings card) — never per-field language tabs.
- public-site language (R160): the URL decides it, never a cookie. Server components build links with `context.href("/book")`, client components with `useLocaleHref()` — never a bare `href="/book"`, which would drop a visitor back into the default language. A new page goes into `app/sitemap.ts`.
- public-site (`apps/public-site`): App Router route files stay lowercase (`page.tsx`, `layout.tsx`, `route.ts`) with default exports (framework-forced); shared components are PascalCase named exports. Server Components by default; add `"use client"` only when needed.
- Relative imports in CMS/API use an explicit `.js` suffix (ESM). Cross-`@booking/*` imports omit extensions.

## 5. Types, shared packages & imports
- Shared shapes live in `packages/shared-types`; the typed HTTP client in `packages/api-client`. The embeddable booking widget (R410) is `packages/widget`: dependency-free TypeScript that frames the public site's `/embed/*` pages; its message types in `src/protocol.ts` must match `apps/public-site/src/lib/embed.ts`. `packages/widget-react` wraps it as React components (`BookingWidget`, `BookingButton`) and holds the integration guide (its README). `apps/widget-demo` is its test bench — a stand-in salon site, started only with `pnpm --filter @booking/widget-demo start`, never deployed. The two frontends share the *contract*, not UI.
- **From `apps/api`, import from `@booking/shared-types` with `import type` only** — the API runs compiled JS and cannot load shared-types' raw-ESM runtime values.
- `[R]` Treat `packages/shared-types/src/colors.ts` as the canonical `isValidColor`; re-export or generate the API copy (`apps/api/src/cms/color-validation.ts`) instead of maintaining two hand-copies.
- Import order (keep consistent): node builtins → external packages → `@booking/*` (as `import type`) → local relative.
- `[R]` Standardize on the `@/*` → `./src/*` path alias for new frontend code (currently only in public-site).

## 6. Styling
Both frontends use **Tailwind CSS v4 + daisyUI 5** (same pinned versions). They differ only in where their theme comes from: the CMS has one fixed brand; the public site is themed per tenant at request time.

**Both apps**
- Style with daisyUI component classes (`btn`, `card`, `input`, `badge`, `alert`, `modal`, `steps`, `join`, …) plus Tailwind utilities, directly in `className`. No `.module.css` files, no per-component stylesheets.
- **Colors are semantic, never literal.** Use daisyUI roles — `bg-base-100`, `bg-base-200`, `border-base-300`, `text-base-content/60` (muted), `primary` (main action, selected state), `success`/`warning`/`error`/`info` (status only). Never hex/rgb, never Tailwind palette colors (`text-red-600`) — on the public site a literal color would ignore the tenant's palette.
- Never put two classes for the same property on one element (e.g. `justify-end` + `justify-between`, `mb-4` + `mb-0`) — Tailwind doesn't resolve them by order. Use a component prop or restructure instead.
- When several components must share exact classes (a skeleton and the thing it stands in for; every step of a wizard), put the strings in one `lib/*Classes.ts` module they import (`scheduleGridClasses.ts` in the CMS; `wizardClasses.ts` in public-site).
- Dialogs are native `<dialog>` + `showModal()` with daisyUI `modal` classes (focus trap, Escape, inert background for free): mounted = open, `onCancel` routes Escape to the parent's `onClose`.
- Inline `style={{}}` only for genuinely dynamic runtime values (a bar height, a per-table grid template) — never for static layout. Keep `motion-reduce:` / reduced-motion handling and touch-target sizing.

**CMS (`apps/cms`)**
- **`src/theme.css` is the single brand file**: the two daisyUI themes (`salon` light, `salon-dark` dark, OS-following) plus fonts. The look is an appointment book — ink (`primary`) on cool paper, hairline rules, squared corners, flat surfaces — with `accent` as the one highlighter: it marks "you are here / this is next" (active nav item, next appointment, today) and nothing else. No gradients, blur blobs, shadows on cards, uppercase letter-spaced labels or entrance animations. Restyling the CMS = editing that file. Theme names must match `src/lib/theme.ts` (the light/dark toggle). `src/index.css` holds only the Tailwind/daisyUI setup and the few true globals (icon font, iOS 16px input rule).
- Repeated markup goes into the `components/ui/` primitives (`Button`, `Card`, `Field`, `Alert`, `Table*`, `Select`, …), not copy-pasted class strings. A table or list that can outgrow a screen is paged with `usePagination` (`lib/usePagination.ts`) + `<Pagination {...pager} />`; confirmations use `ConfirmModal`, never `window.confirm`. Use their props (`variant`, `size`, `flush`).
- Fonts are self-hosted, never loaded from Google: Archivo (normal width for text; condensed as `font-display` for headings and times) with Noto Sans Georgian behind it for Georgian, both via `@fontsource-variable` (imported in `index.css`), and Material Symbols as a subset holding only the icons in `lib/iconNames.ts`. A new icon goes into that sorted list (`IconName` makes an unlisted one a type error), then `pnpm --filter @booking/cms icons` rebuilds `src/assets/fonts/material-symbols-outlined.woff2`. Vendor CSS a single screen needs (Leaflet) is imported by that component so it lands in its lazy chunk.

**public-site (`apps/public-site`)**
- One daisyUI theme, `tenant` (`src/app/theme.css`), whose colors are `var(--tenant-*)` references — never fixed values. The look is a printed price list: the tenant's `primary` as flat full-strength blocks (the hero), lists and summaries separated by rules (`border-accent` for the heavy rule — that is the tenant's `secondary`, falling back to the text color when it wouldn't show on the background; `border-base-300` between rows) rather than boxed into cards, squared corners, no gradients, blur or shadows. Tailwind runs through PostCSS (`postcss.config.js`) under Next 14.
- The root `layout.tsx` writes the `--tenant-*` values per request as an **inline `style` on `<html>`** via `lib/tenant-theme.ts` (`tenantThemeVars` → `tenantThemeStyle`), which derives button-text contrast, light/dark `color-scheme` and readable status colors from the tenant's four colors. **Every tenant color passes `isValidColor` first** (injection guard) — `resolveTenantColors` validates, `tenantThemeStyle` checks again.
- Don't render a `<style>` (or other hydrated element) into `<head>` from a component: React 18 hydrates `<head>` children by position, so browser extensions that inject into `<head>` cause hydration errors.
- `PreviewColorListener` (CMS live preview) must apply colors through the same `tenantThemeVars`, so a preview can never differ from what visitors see.
- System fonts only — no web-font download on the P95 < 300ms path.
- `[R]` Remove the unused `packages/config/tailwind/base.js` — a Tailwind v3 JS config wired into nothing; both apps' Tailwind v4 setups are CSS-first and don't use it.

## 7. Formatting & lint
- ESLint config is intentionally legacy `.eslintrc` (Next 14 / react-hooks 4 don't support flat config). Extend `packages/config/eslint/base.js`; don't migrate to flat config until Next is upgraded.
- Prettier defaults (double quotes, semicolons, trailing commas, ~120 col). `[R]` Add a checked-in `.prettierrc` capturing these so formatting is deterministic across machines.
- Unused vars are allowed only with a leading `_`.

## 8. Testing
- `apps/api` runs Jest + ts-jest (`apps/api/jest.config.js`), with **colocated `*.spec.ts`** next to the unit under test. Run via `pnpm test` (Turbo) or `pnpm --filter @booking/api test:watch`.
- These are **unit tests: no database, no Redis, no Nest bootstrap.** Construct the subject directly and hand it stubs — `PrismaService` becomes `{ forTenant: (fn) => fn(txStub) }`, `TenantContextService` becomes `{ current: { tenantId } }` (or a real instance when the AsyncLocalStorage behaviour *is* the thing under test). `pnpm test` must stay runnable with nothing else running.
- Covered so far: `common/timezone`, `common/serializers`, `common/no-show-history` (R360), `common/phone-key`, `common/appointment-summaries`, `booking/blocked-phone.service` (R380), `booking/working-hours` (R390, R460 days off), `cms/business-hours.controller` (R460), `cms/onboarding.service` (R420), `internal/onboarding.service` (salon validation) + `admin/admin-auth.service` + `admin/admin-page` (R430), `common/i18n-validation`, `common/tenant-url`, `cms/color-validation`, `tenant/tenant-context.service`, `prisma/prisma.service` (the `forTenant`/RLS choke point), `auth/guards/roles.guard`, `booking/availability.service`, `booking/booking.service` (incl. the R260 day lock), `booking/visit.service` (visits, R250 holds, R440 "any" enforced), `booking/visit-planner`, `booking/fair-assignment` (R450, "any professional" assigned fairly), `booking/slot-hold`, `booking/magic-link` (R500 one-part link token), `public/public.controller` (magic-link lookup, cancel, resend non-disclosure), `auth/auth.service` (lockout, reset, logout), `auth/guards/jwt-auth.guard` (R320 sessions), `rate-limit/*`, `booking/availability-cache.service`, `health/health.controller`, `cms/dashboard-metrics` + `cms/dashboard.service` (R370), `notifications/notification.service` + `notifications/sms-number` + `notifications/sms-parts` (uBill SMS, `fetch` stubbed; R500 usage counted on acceptance), `billing/*` (R470–R490: Flitt signatures, derived status, settlement, checkout/renewal/callback; Flitt stubbed; `billing/plans` + `cms/locations.controller` for R540 location limits; `billing/plan-catalog.service` for R550 admin-edited plans), `cms/service-order` (R510 categories and order), `booking/status-marking` (R530).
- `packages/shared-types` has its own Jest setup (`jest.config.cjs` + `tsconfig.spec.json`) for the logic both frontends import at *runtime* — currently `i18n.ts`, `services.ts` (R510 grouping) and `dates.ts` (Georgian date names both frontends use). Same rules as above: pure functions, no environment.
- Tag a test with the same `// Rxx:` comment as the code it pins (§3), and prefer asserting the *rule* (`price` is never rewritten on reschedule) over the mechanics.
- **Integration tests** (`*.int-spec.ts`, `pnpm --filter @booking/api test:integration`, `jest.integration.config.js`) run against a real Postgres as the real roles: the RLS policies (every `tenant_id` table has RLS + a policy; cross-tenant reads/writes are refused; no tenant set = nothing visible) the R260 booking lock under concurrency, and that what one salon knows about a customer — no-show history (R360), blocked numbers (R380) — is invisible to another (`booking/customer-record.int-spec.ts`). They need `DATABASE_URL` + `APP_DATABASE_URL` with migrations applied (CI runs them in their own job); fixtures live in `src/testing/integration-fixtures.ts` and clean up after themselves. Never part of `pnpm test`.
- Still open: frontend tests.
