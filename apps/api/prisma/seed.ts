import { PrismaClient } from "../generated/prisma/index.js";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const IDS = {
  vake: "00000000-0000-0000-0000-0000000000a1",
  saburtalo: "00000000-0000-0000-0000-0000000000a2",
  nina: "00000000-0000-0000-0000-000000000001",
  giorgi: "00000000-0000-0000-0000-000000000003",
  dato: "00000000-0000-0000-0000-000000000004",
  haircut: "00000000-0000-0000-0000-000000000002",
  colour: "00000000-0000-0000-0000-000000000005",
};

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { subdomain: "demo" },
    update: {},
    create: {
      name: "Demo Salon",
      timezone: "Asia/Tbilisi",
      subdomain: "demo",
      configJson: {
        colors: { primary: "#7c3aed" },
        enabledLocales: ["en", "ka"],
        copy: {
          title: "Book at Demo Salon",
          titleI18n: { ka: "დაჯავშნეთ დემო სალონში" },
          description: "Two branches in Tbilisi. Book online in under a minute.",
          descriptionI18n: { ka: "ორი ფილიალი თბილისში. დაჯავშნეთ ონლაინ ერთ წუთზე ნაკლებში." },
        },
      },
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

  const locations = [
    {
      id: IDS.vake,
      name: "Vake",
      nameI18n: { ka: "ვაკე" },
      addressLine: "12 Chavchavadze Ave",
      addressLineI18n: { ka: "ჭავჭავაძის გამზ. 12" },
      city: "Tbilisi",
      phone: "+995 322 11 22 33",
      latitude: "41.709000",
      longitude: "44.762000",
      position: 0,
    },
    {
      id: IDS.saburtalo,
      name: "Saburtalo",
      nameI18n: { ka: "საბურთალო" },
      addressLine: "5 Kazbegi Ave",
      addressLineI18n: { ka: "ყაზბეგის გამზ. 5" },
      city: "Tbilisi",
      phone: "+995 322 44 55 66",
      latitude: "41.725000",
      longitude: "44.745000",
      position: 1,
    },
  ];

  for (const location of locations) {
    await prisma.location.upsert({
      where: { id: location.id },
      update: {},
      create: { tenantId: tenant.id, ...location },
    });
  }

  const professionals = [
    { id: IDS.nina, name: "Nina Stylist", locationId: IDS.vake },
    { id: IDS.giorgi, name: "Giorgi Barber", locationId: IDS.saburtalo },
    // R180: no branch = works at every location
    { id: IDS.dato, name: "Dato Colourist", locationId: null },
  ];

  for (const professional of professionals) {
    await prisma.professional.upsert({
      where: { id: professional.id },
      update: {},
      create: { tenantId: tenant.id, ...professional },
    });
  }

  const services = [
    {
      id: IDS.haircut,
      name: "Haircut",
      nameI18n: { ka: "შეჭრა" },
      description: "Wash, cut and finish with a consultation.",
      descriptionI18n: { ka: "დაბანა, შეჭრა და დასრულება კონსულტაციით." },
      durationMinutes: 45,
      price: 40,
    },
    {
      id: IDS.colour,
      name: "Colour",
      nameI18n: { ka: "შეღებვა" },
      description: "Full colour, including toner.",
      descriptionI18n: { ka: "სრული შეღებვა, ტონერის ჩათვლით." },
      durationMinutes: 90,
      price: 120,
    },
  ];

  for (const service of services) {
    await prisma.service.upsert({
      where: { id: service.id },
      update: {},
      create: { tenantId: tenant.id, ...service },
    });
  }

  const assignments = [
    { serviceId: IDS.haircut, professionalId: IDS.nina },
    { serviceId: IDS.haircut, professionalId: IDS.giorgi },
    { serviceId: IDS.haircut, professionalId: IDS.dato },
    { serviceId: IDS.colour, professionalId: IDS.dato },
  ];

  for (const assignment of assignments) {
    await prisma.serviceProfessional.upsert({
      where: { serviceId_professionalId: assignment },
      update: {},
      create: { tenantId: tenant.id, ...assignment },
    });
  }

  const existingHours = await prisma.businessHours.count({ where: { tenantId: tenant.id } });
  if (existingHours === 0) {
    await prisma.businessHours.createMany({
      data: [1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
        tenantId: tenant.id,
        professionalId: null,
        dayOfWeek,
        startTime: new Date("1970-01-01T10:00:00.000Z"),
        endTime: new Date("1970-01-01T19:00:00.000Z"),
      })),
    });
  }

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
