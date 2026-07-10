# multi-tenant-booking-app

Multi-tenant salon booking platform: a NestJS + Fastify API, a React CMS for
salon owners/professionals, and a Next.js public booking site — one shared
Postgres database, tenants isolated via Row-Level Security. See
[`system_design.md`](./system_design.md) and
[`Unified Requirements and Data Model.md`](./Unified%20Requirements%20and%20Data%20Model.md)
for the architecture and data model this scaffold implements.

## Structure

```
apps/
  api/            NestJS + Fastify — business logic, RLS-aware DB access
  cms/             React (Vite) — owner/professional login, tenant management
  public-site/     Next.js — customer-facing booking site
packages/
  shared-types/    Tenant/Service/Professional/Appointment/DTO shapes
  api-client/      typed client shared by cms + public-site
  config/          shared eslint/tsconfig/tailwind config
```

## Prerequisites

- Node 20 (see `.nvmrc`)
- pnpm (`corepack enable` will pick up the version pinned in `package.json`)
- Docker (for Postgres + Redis)

## First-time setup

```bash
pnpm setup          # copies each app's .env.example -> .env, then pnpm install
docker compose up -d postgres redis
pnpm db:migrate     # applies prisma/migrations (schema + RLS policies)
pnpm db:seed        # creates a demo tenant: owner@demo.local / password123
```

Then run everything:

```bash
pnpm dev            # turbo run dev — api :3001, cms :5173, public-site :3000
```

Or via Docker (also starts Postgres/Redis, but the app images are built once
from source — re-run `docker compose up --build` after pulling changes; for
day-to-day development, native `pnpm dev` has a faster reload loop):

```bash
docker compose up
```

## Multi-tenancy & RLS

Every tenant-scoped table has a Postgres RLS policy keyed off the
`app.tenant_id` session variable, set per-transaction by
`PrismaService.forTenant()` (`apps/api/src/prisma/prisma.service.ts`) from
`TenantContextService`. Two things make this actually enforce something
rather than being decorative:

- The API connects to Postgres as **`booking_app`**, a plain non-superuser
  role — not the role that owns the tables. Postgres RLS is bypassed by table
  owners and superusers regardless of policy, so migrations run as the owner
  (`DATABASE_URL`) while the running API uses a separate, least-privilege
  connection (`APP_DATABASE_URL`). See `docker/postgres/init.sql`.
- Tenant identity enters the request pipeline exactly once per request, via
  `RequestContextMiddleware` (opens the AsyncLocalStorage frame) plus either
  `HostTenantMiddleware` (public routes — Host header, via Redis, per
  `system_design.md` §4/§7/§8) or `JwtAuthGuard` (CMS routes — JWT claims).
  Application code never passes `tenant_id` around manually.

## What's stubbed vs. real

This scaffold wires up the full architecture (tenancy, auth, RLS, routing)
and real CRUD for tenant config/services/professionals/business
hours/time-off/appointment listing+cancellation. Left as
`NotImplementedException` stubs, since they're genuine business logic rather
than plumbing:

- Availability computation (`BusinessHours` − `TimeOff` − `Appointment`s)
- Public booking creation + magic-link issuance/reschedule/cancel/resend
- CMS appointment reschedule (needs the same slot-conflict check)

## Scripts

- `pnpm dev` / `pnpm build` / `pnpm lint` / `pnpm typecheck` — run across all
  packages via Turborepo
- `pnpm db:migrate` / `pnpm db:generate` / `pnpm db:seed` — Prisma, scoped to
  `apps/api`
