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
- Every new table carries `tenant_id` + an RLS policy. RLS policies and partial-unique constraints are hand-written in `prisma/migrations/*_rls/migration.sql` (not expressible in the Prisma DSL).
- Tenant identity comes from `TenantContextService` (AsyncLocalStorage): `.current` throws if unset, `.currentOrNull` for optional. Never plumb `tenant_id` manually through call arguments.
- Intra-tenant role checks (owner vs professional) live in the API layer (`RolesGuard` + `@Roles(...)`), **not** in Postgres.
- Prisma schema: camelCase TS fields ↔ snake_case DB via `@map`/`@@map`; UUID PKs `@default(uuid()) @db.Uuid`; `@db.Timestamptz` for times; `@@index([tenantId])` on tenant-scoped tables.

## 3. NestJS (apps/api)
- kebab-case files with a dotted role suffix: `*.controller.ts`, `*.service.ts`, `*.module.ts`, `*.middleware.ts`, `*.guard.ts`, `*.decorator.ts`, `*.strategy.ts`.
- One controller per resource; group by feature module; wire into `app.module.ts`. Keep controllers thin.
- Inject dependencies as `private readonly`. Type every handler's `@Body()` and return value against `@booking/shared-types`.
- Throw Nest HTTP exceptions (`ConflictException`, `NotFoundException`, …). Unimplemented endpoints throw `NotImplementedException` with a message rather than being omitted.
- Convert Prisma `Date`/`Decimal` to wire types **only** through `common/serializers.ts` — never cast inline. The wire contract uses `string` for dates and for `price`.
- **DTO duality:** request/response *types* are interfaces in `@booking/shared-types`; parallel Swagger *classes* with `@ApiProperty()` live in `common/dto.ts`, kept in sync by hand. Update both.
- Tag code that implements a spec requirement with its `// Rxx:` comment linking back to the requirements doc.

## 4. React / Next components
- **Exactly one component per file — no exceptions.** A page's modals and sub-forms get their own files too, even when nothing else will ever use them; a file that renders two components gets split. Each component brings its own co-located `.module.css` with it (§6), so splitting a file means splitting its stylesheet. Component files are PascalCase.
- CMS (`apps/cms`): named exports; route components in `pages/` with a `Page` suffix, every other component in `components/` — including page-specific ones like `EditServiceModal`. Data fetching = `useState`/`useEffect` + a local `load()`, `null` as the loading sentinel, an error string in state. Use Context only for cross-cutting state (auth); consumer hooks like `useAuth` throw when used outside their provider.
- public-site (`apps/public-site`): App Router route files stay lowercase (`page.tsx`, `layout.tsx`, `route.ts`) with default exports (framework-forced); shared components are PascalCase named exports. Server Components by default; add `"use client"` only when needed.
- Relative imports in CMS/API use an explicit `.js` suffix (ESM). Cross-`@booking/*` imports omit extensions.

## 5. Types, shared packages & imports
- Shared shapes live in `packages/shared-types`; the typed HTTP client in `packages/api-client`. The two frontends share the *contract*, not UI.
- **From `apps/api`, import from `@booking/shared-types` with `import type` only** — the API runs compiled JS and cannot load shared-types' raw-ESM runtime values.
- `[R]` Treat `packages/shared-types/src/colors.ts` as the canonical `isValidColor`; re-export or generate the API copy (`apps/api/src/cms/color-validation.ts`) instead of maintaining two hand-copies.
- Import order (keep consistent): node builtins → external packages → `@booking/*` (as `import type`) → local relative.
- `[R]` Standardize on the `@/*` → `./src/*` path alias for new frontend code (currently only in public-site).

## 6. Styling
- **Every component and every page owns its own co-located style file.** No shared catch-all stylesheet for component/page styles, and no ad-hoc inline `style={{}}` for structural layout.
  - Use **CSS Modules** (natively supported by Vite and Next): `Professionals.module.css` next to `Professionals.tsx`, imported as `import styles from "./Professionals.module.css"` and applied via `className={styles.grid}`.
  - This supersedes the old CMS pattern (single global `theme.css` + heavy inline styles). Migrate existing pages to per-file `.module.css` incrementally; all *new* components/pages follow this rule from the start.
- **Design tokens stay global and shared.** Keep CSS custom properties (`--accent`, `--ink`, `--bg`, `--danger`, …) in one root token stylesheet (`theme.css`) imported once. Per-component modules *consume* tokens (`color: var(--accent)`) but never redefine the token layer — this preserves per-tenant theming.
- **Inline `style={{}}` is allowed only for genuinely dynamic values** computed at runtime (a tenant color resolved per request, a computed grid size) — never for static layout that belongs in the module file.
- public-site: tenant colors are injected as CSS custom properties in a server-rendered `<style>` in `layout.tsx`; **always run color values through `isValidColor` before interpolating** into the style tag (injection guard). Components reference `var(--color-primary)` from their own `.module.css`.
- `[R]` Remove the unused `packages/config/tailwind/base.js` — it is wired into nothing and now competes with the CSS-Modules standard.

## 7. Formatting & lint
- ESLint config is intentionally legacy `.eslintrc` (Next 14 / react-hooks 4 don't support flat config). Extend `packages/config/eslint/base.js`; don't migrate to flat config until Next is upgraded.
- Prettier defaults (double quotes, semicolons, trailing commas, ~120 col). `[R]` Add a checked-in `.prettierrc` capturing these so formatting is deterministic across machines.
- Unused vars are allowed only with a leading `_`.

## 8. Testing
- `apps/api` runs Jest + ts-jest (`apps/api/jest.config.js`), with **colocated `*.spec.ts`** next to the unit under test. Run via `pnpm test` (Turbo) or `pnpm --filter @booking/api test:watch`.
- These are **unit tests: no database, no Redis, no Nest bootstrap.** Construct the subject directly and hand it stubs — `PrismaService` becomes `{ forTenant: (fn) => fn(txStub) }`, `TenantContextService` becomes `{ current: { tenantId } }` (or a real instance when the AsyncLocalStorage behaviour *is* the thing under test). `pnpm test` must stay runnable with nothing else running.
- Covered so far: `common/timezone`, `common/serializers`, `common/i18n-validation`, `common/tenant-url`, `cms/color-validation`, `tenant/tenant-context.service`, `prisma/prisma.service` (the `forTenant`/RLS choke point), `auth/guards/roles.guard`, `booking/availability.service`, `booking/booking.service`, `public/public.controller` (magic-link lookup, cancel, resend non-disclosure).
- `packages/shared-types` has its own Jest setup (`jest.config.cjs` + `tsconfig.spec.json`) for the logic both frontends import at *runtime* — currently `i18n.ts`. Same rules as above: pure functions, no environment.
- Tag a test with the same `// Rxx:` comment as the code it pins (§3), and prefer asserting the *rule* (`price` is never rewritten on reschedule) over the mechanics.
- Still open: integration tests that exercise the Postgres RLS policies against a real database — a unit test can only prove `forTenant` sets `app.tenant_id`, not that the policies act on it. Frontend tests come after that.
