-- CreateEnum
CREATE TYPE "tenant_user_role" AS ENUM ('owner', 'professional');

-- CreateEnum
CREATE TYPE "appointment_status" AS ENUM ('booked', 'cancelled', 'completed', 'no_show');

-- CreateTable
CREATE TABLE "tenant" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "subdomain" TEXT NOT NULL,
    "custom_domain" TEXT,
    "domain_verified_at" TIMESTAMPTZ,
    "config_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "professional" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "professional_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_user" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "professional_id" UUID,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "tenant_user_role" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_login_at" TIMESTAMPTZ,

    CONSTRAINT "tenant_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_professional" (
    "service_id" UUID NOT NULL,
    "professional_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,

    CONSTRAINT "service_professional_pkey" PRIMARY KEY ("service_id","professional_id")
);

-- CreateTable
CREATE TABLE "business_hours" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "professional_id" UUID,
    "day_of_week" SMALLINT NOT NULL,
    "start_time" TIME NOT NULL,
    "end_time" TIME NOT NULL,

    CONSTRAINT "business_hours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_off" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "professional_id" UUID,
    "start_at" TIMESTAMPTZ NOT NULL,
    "end_at" TIMESTAMPTZ NOT NULL,
    "reason" TEXT,

    CONSTRAINT "time_off_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointment" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "professional_id" UUID,
    "user_name" TEXT NOT NULL,
    "phone_number" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "start_at" TIMESTAMPTZ NOT NULL,
    "end_at" TIMESTAMPTZ NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "status" "appointment_status" NOT NULL DEFAULT 'booked',
    "access_token_hash" TEXT,
    "access_token_expires_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "appointment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_subdomain_key" ON "tenant"("subdomain");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_custom_domain_key" ON "tenant"("custom_domain");

-- CreateIndex
CREATE INDEX "professional_tenant_id_idx" ON "professional"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_user_professional_id_key" ON "tenant_user"("professional_id");

-- CreateIndex
CREATE INDEX "tenant_user_tenant_id_idx" ON "tenant_user"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_user_tenant_id_email_key" ON "tenant_user"("tenant_id", "email");

-- CreateIndex
CREATE INDEX "service_tenant_id_idx" ON "service"("tenant_id");

-- CreateIndex
CREATE INDEX "service_professional_tenant_id_idx" ON "service_professional"("tenant_id");

-- CreateIndex
CREATE INDEX "business_hours_tenant_id_idx" ON "business_hours"("tenant_id");

-- CreateIndex
CREATE INDEX "business_hours_tenant_id_professional_id_day_of_week_idx" ON "business_hours"("tenant_id", "professional_id", "day_of_week");

-- CreateIndex
CREATE INDEX "time_off_tenant_id_idx" ON "time_off"("tenant_id");

-- CreateIndex
CREATE INDEX "time_off_tenant_id_professional_id_start_at_end_at_idx" ON "time_off"("tenant_id", "professional_id", "start_at", "end_at");

-- CreateIndex
CREATE UNIQUE INDEX "appointment_access_token_hash_key" ON "appointment"("access_token_hash");

-- CreateIndex
CREATE INDEX "appointment_tenant_id_start_at_idx" ON "appointment"("tenant_id", "start_at");

-- CreateIndex
CREATE INDEX "appointment_tenant_id_professional_id_start_at_idx" ON "appointment"("tenant_id", "professional_id", "start_at");

-- AddForeignKey
ALTER TABLE "professional" ADD CONSTRAINT "professional_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_user" ADD CONSTRAINT "tenant_user_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_user" ADD CONSTRAINT "tenant_user_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "professional"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service" ADD CONSTRAINT "service_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_professional" ADD CONSTRAINT "service_professional_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_professional" ADD CONSTRAINT "service_professional_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_professional" ADD CONSTRAINT "service_professional_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "professional"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_hours" ADD CONSTRAINT "business_hours_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_hours" ADD CONSTRAINT "business_hours_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "professional"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_off" ADD CONSTRAINT "time_off_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_off" ADD CONSTRAINT "time_off_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "professional"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment" ADD CONSTRAINT "appointment_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment" ADD CONSTRAINT "appointment_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment" ADD CONSTRAINT "appointment_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "professional"("id") ON DELETE SET NULL ON UPDATE CASCADE;
