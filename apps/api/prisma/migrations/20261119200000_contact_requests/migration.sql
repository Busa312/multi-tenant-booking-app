-- R580: requests from the marketing site's contact page. Platform-wide (no
-- tenant_id, so no RLS): they belong to no salon and only the platform admin
-- reads them. booking_app gets access through docker/postgres/init.sql's
-- DEFAULT PRIVILEGES, as for subscription_plan.
CREATE TABLE "contact_request" (
    "id"         UUID        NOT NULL,
    "name"       TEXT        NOT NULL,
    "business"   TEXT        NOT NULL,
    "phone"      TEXT        NOT NULL,
    "email"      TEXT,
    "message"    TEXT,
    "locale"     TEXT        NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "handled_at" TIMESTAMPTZ,

    CONSTRAINT "contact_request_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "contact_request_locale_check" CHECK ("locale" IN ('ka', 'en', 'ru')),
    CONSTRAINT "contact_request_lengths_check" CHECK (
        char_length("name") BETWEEN 1 AND 100
        AND char_length("business") BETWEEN 1 AND 150
        AND char_length("phone") BETWEEN 1 AND 40
        AND ("email" IS NULL OR char_length("email") <= 200)
        AND ("message" IS NULL OR char_length("message") <= 2000)
    )
);

CREATE INDEX "contact_request_created_at_idx" ON "contact_request"("created_at");
