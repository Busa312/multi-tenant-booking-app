-- Runs once, automatically, on first container start (docker-entrypoint-initdb.d),
-- as the POSTGRES_USER superuser defined in docker-compose.yml.
--
-- Creates the least-privilege runtime role the API connects as (APP_DATABASE_URL).
-- It deliberately is NOT the table owner and NOT a superuser: Postgres RLS
-- policies are bypassed by both, so migrations must keep running as the
-- default superuser role while the running API uses this one instead.
CREATE ROLE booking_app WITH LOGIN PASSWORD 'booking_app' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;

GRANT CONNECT ON DATABASE booking TO booking_app;
GRANT USAGE ON SCHEMA public TO booking_app;

-- Tables created by future `prisma migrate` runs (still executed as the
-- superuser) are automatically granted to booking_app too.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO booking_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO booking_app;
