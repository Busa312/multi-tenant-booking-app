import { PrismaClient } from "../generated/prisma/index.js";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { subdomain: "demo" },
    update: {},
    create: {
      name: "Demo Salon",
      timezone: "Asia/Tbilisi",
      subdomain: "demo",
      configJson: { colors: { primary: "#7c3aed" } },
    },
  });

  const professional = await prisma.professional.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      tenantId: tenant.id,
      name: "Nina Stylist",
    },
  });

  await prisma.tenantUser.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: "owner@demo.local" } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: "owner@demo.local",
      passwordHash: await bcrypt.hash("password123", 10),
      role: "owner",
    },
  });

  const service = await prisma.service.upsert({
    where: { id: "00000000-0000-0000-0000-000000000002" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000002",
      tenantId: tenant.id,
      name: "Haircut",
      durationMinutes: 45,
      price: 40,
    },
  });

  await prisma.serviceProfessional.upsert({
    where: { serviceId_professionalId: { serviceId: service.id, professionalId: professional.id } },
    update: {},
    create: { tenantId: tenant.id, serviceId: service.id, professionalId: professional.id },
  });

  // eslint-disable-next-line no-console
  console.log(`Seeded tenant "${tenant.subdomain}" — login as owner@demo.local / password123`);
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
