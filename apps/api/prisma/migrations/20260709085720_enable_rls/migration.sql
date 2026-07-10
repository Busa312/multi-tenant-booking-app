-- Row-Level Security: every tenant-scoped table gets one policy that keys off
-- the `app.tenant_id` session variable set per-transaction by
-- PrismaService.forTenant() (src/prisma/prisma.service.ts). `current_setting`
-- with missing_ok=true returns NULL rather than erroring when unset, and
-- comparing a NOT NULL uuid column to NULL is always false — so a query run
-- without a tenant context sees zero rows rather than every tenant's rows
-- (fail closed, not fail open).
--
-- `Tenant` itself is deliberately NOT included: it has no tenant_id column —
-- a Tenant row IS the tenant. TenantResolverService reads it directly (via
-- DATABASE_URL / booking_app has plain SELECT) to resolve Host -> tenant_id,
-- which must work before any tenant context exists.
--
-- These policies only bind non-owner, non-superuser roles (see
-- docker/postgres/init.sql for `booking_app`, the role the API actually
-- connects as via APP_DATABASE_URL) — Postgres exempts table owners and
-- superusers from RLS regardless of policies defined here.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'professional',
    'tenant_user',
    'service',
    'service_professional',
    'business_hours',
    'time_off',
    'appointment'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I
         USING (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid)
         WITH CHECK (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid)',
      t
    );
  END LOOP;
END $$;

-- Exactly one `owner` TenantUser per tenant (system_design.md §6) — not
-- expressible as a Prisma schema constraint, so added here as a partial
-- unique index.
CREATE UNIQUE INDEX tenant_user_one_owner_per_tenant
  ON tenant_user (tenant_id)
  WHERE role = 'owner';
