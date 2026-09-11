-- Row-Level Security for `location`, added by hand for the same reason the
-- original policies were (20260709085720_enable_rls): RLS isn't expressible in
-- Prisma's schema DSL, so `prisma migrate` will never generate it. A new
-- tenant-scoped table without this line is a cross-tenant data leak that no
-- amount of correct application code prevents.
--
-- Identical shape to every other policy: `current_setting(..., true)` returns
-- NULL rather than erroring when `app.tenant_id` is unset, and comparing a NOT
-- NULL uuid to NULL is always false — so a query run with no tenant context
-- sees zero rows rather than every tenant's (fail closed).

ALTER TABLE "location" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "location"
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
