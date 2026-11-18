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

// The car wash (R440): customers book a service, never a person.
const WASH = {
  ana: "00000000-0000-0000-0000-0000000000c1",
  zura: "00000000-0000-0000-0000-0000000000c2",
  luka: "00000000-0000-0000-0000-0000000000c3",
  exterior: "00000000-0000-0000-0000-0000000000c4",
  detail: "00000000-0000-0000-0000-0000000000c5",
};

const clock = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00.000Z`);

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
      cityI18n: { ka: "თბილისი" },
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
      cityI18n: { ka: "თბილისი" },
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

  await seedSubscription(tenant.id);

  // eslint-disable-next-line no-console
  console.log(`Seeded tenant "${tenant.subdomain}" — login as owner@demo.local / password123`);

  await seedCarWash();
  await seedBeautyStudio();
}

/**
 * A second, very different business for trying R440–R460 by hand: no
 * locations, one bookable service (so the booking site skips the services
 * step), three workers customers never see or pick (assigned fairly, R450),
 * and one of them off on Mondays (R460). "Full detail" is inactive —
 * activating it brings the services step back.
 */
async function seedCarWash() {
  const tenant = await prisma.tenant.upsert({
    where: { subdomain: "carwash" },
    update: {},
    create: {
      name: "Demo Car Wash",
      timezone: "Asia/Tbilisi",
      subdomain: "carwash",
      customersChooseProfessional: false,
      onboardingFinishedAt: new Date(),
      configJson: {
        colors: { primary: "#181888", secondary: "#f8b818", background: "#ffffff", text: "#0d0d0d" },
        enabledLocales: ["en", "ka"],
        copy: {
          title: "Book a wash",
          titleI18n: { ka: "დაჯავშნე რეცხვა" },
          description: "Pick a time, drive in, drive out shining.",
          descriptionI18n: { ka: "აირჩიე დრო, შემოდი და გადი გაბრწყინებული." },
        },
      },
    },
  });

  await prisma.tenantUser.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: "owner@carwash.local" } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: "owner@carwash.local",
      passwordHash: await bcrypt.hash("password123", 10),
      role: "owner",
    },
  });

  for (const professional of [
    { id: WASH.ana, name: "Ana" },
    { id: WASH.zura, name: "Zura" },
    { id: WASH.luka, name: "Luka" },
  ]) {
    await prisma.professional.upsert({
      where: { id: professional.id },
      update: {},
      create: { tenantId: tenant.id, locationId: null, ...professional },
    });
  }

  for (const service of [
    {
      id: WASH.exterior,
      name: "Exterior wash",
      nameI18n: { ka: "გარე რეცხვა" },
      description: "Foam, hand wash and dry.",
      descriptionI18n: { ka: "ქაფი, ხელით რეცხვა და გაშრობა." },
      durationMinutes: 30,
      price: 20,
      isActive: true,
    },
    {
      id: WASH.detail,
      name: "Full detail",
      nameI18n: { ka: "სრული წმენდა" },
      description: "Inside and out, seats and mats included.",
      descriptionI18n: { ka: "შიგნით და გარეთ, სავარძლებისა და ხალიჩების ჩათვლით." },
      durationMinutes: 120,
      price: 90,
      isActive: false,
    },
  ]) {
    await prisma.service.upsert({
      where: { id: service.id },
      update: {},
      create: { tenantId: tenant.id, ...service },
    });
  }

  for (const assignment of [
    { serviceId: WASH.exterior, professionalId: WASH.ana },
    { serviceId: WASH.exterior, professionalId: WASH.zura },
    { serviceId: WASH.exterior, professionalId: WASH.luka },
    { serviceId: WASH.detail, professionalId: WASH.ana },
    { serviceId: WASH.detail, professionalId: WASH.luka },
  ]) {
    await prisma.serviceProfessional.upsert({
      where: { serviceId_professionalId: assignment },
      update: {},
      create: { tenantId: tenant.id, ...assignment },
    });
  }

  const existingHours = await prisma.businessHours.count({ where: { tenantId: tenant.id } });
  if (existingHours === 0) {
    await prisma.businessHours.createMany({
      data: [
        // Open every day, 09:00–20:00
        ...[0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
          tenantId: tenant.id,
          professionalId: null,
          dayOfWeek,
          startTime: clock("09:00"),
          endTime: clock("20:00"),
        })),
        // R460: Luka is off on Mondays (stored as 00:00–00:00)
        { tenantId: tenant.id, professionalId: WASH.luka, dayOfWeek: 1, startTime: clock("00:00"), endTime: clock("00:00"), isDayOff: true },
        // Zura works a short Saturday
        { tenantId: tenant.id, professionalId: WASH.zura, dayOfWeek: 6, startTime: clock("10:00"), endTime: clock("16:00") },
      ],
    });
  }

  await seedSubscription(tenant.id);

  // eslint-disable-next-line no-console
  console.log(`Seeded tenant "${tenant.subdomain}" — login as owner@carwash.local / password123`);
}

/**
 * A real salon's price list (nails, hair removal, brows, permanent makeup,
 * lashes) for trying R510/R520 by hand: 9 categories in the menu's order, the
 * prices as printed, ranges ("10/15", "80/100", "from 2") as starting prices
 * with a note. The menu gives no durations: the ones here are estimates for
 * the salon to correct.
 */
async function seedBeautyStudio() {
  const tenant = await prisma.tenant.upsert({
    where: { subdomain: "beauty" },
    update: {},
    create: {
      name: "Demo Beauty Studio",
      timezone: "Asia/Tbilisi",
      subdomain: "beauty",
      onboardingFinishedAt: new Date(),
      configJson: {
        colors: { primary: "#5a4636", secondary: "#c9b8a6", background: "#f4efe8", text: "#2b211a" },
        enabledLocales: ["en", "ka"],
        copy: {
          title: "Nails, lashes & brows",
          titleI18n: { ka: "ფრჩხილები, წამწამები და წარბები" },
          description: "Book your next appointment online in a minute.",
          descriptionI18n: { ka: "დაჯავშნე შემდეგი ვიზიტი ონლაინ, ერთ წუთში." },
        },
      },
    },
  });

  await prisma.tenantUser.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: "owner@beauty.local" } },
    update: {},
    create: { tenantId: tenant.id, email: "owner@beauty.local", passwordHash: await bcrypt.hash("password123", 10), role: "owner" },
  });

  const uuid = (prefix: string, n: number) => `00000000-0000-0000-0000-0000000${prefix}${String(n).padStart(3, "0")}`;

  const staff = {
    mariam: { id: uuid("bd", 1), name: "Mariam", nameI18n: { ka: "მარიამი" } },
    tamar: { id: uuid("bd", 2), name: "Tamar", nameI18n: { ka: "თამარი" } },
    nino: { id: uuid("bd", 3), name: "Nino", nameI18n: { ka: "ნინო" } },
    eka: { id: uuid("bd", 4), name: "Eka", nameI18n: { ka: "ეკა" } },
  };
  for (const professional of Object.values(staff)) {
    await prisma.professional.upsert({ where: { id: professional.id }, update: {}, create: { tenantId: tenant.id, locationId: null, ...professional } });
  }
  const nails = [staff.mariam.id, staff.tamar.id];
  const feet = [staff.tamar.id];
  const lashBrow = [staff.nino.id];
  const face = [staff.eka.id];

  type Item = { name: string; ka: string; price: number; minutes: number; from?: boolean; note?: string; noteKa?: string };
  const menu: { name: string; ka: string; staff: string[]; items: Item[] }[] = [
    {
      name: "Manicure & gel polish",
      ka: "მანიკური და გელ-ლაქი",
      staff: nails,
      items: [
        { name: "Hot Combo: gel polish + manicure", ka: "ჰოთ კომბო: გელ-ლაქი + მანიკური", price: 25, minutes: 75, note: "Cuticle care included.", noteKa: "კუტიკულის მოვლის ჩათვლით." },
        { name: "Gel polish · Elpaza", ka: "გელ-ლაქი · Elpaza", price: 15, minutes: 60 },
        { name: "Gel polish · Uno", ka: "გელ-ლაქი · Uno", price: 20, minutes: 60 },
        { name: "Gel polish · Luxio Premium", ka: "გელ-ლაქი · Luxio Premium", price: 35, minutes: 60 },
        { name: "Cuticle care", ka: "კუტიკულის მოვლა", price: 15, minutes: 30 },
      ],
    },
    {
      name: "Extensions",
      ka: "დაგრძელება",
      staff: nails,
      items: [
        { name: "Colored gel extensions", ka: "ფერადი გელით დაგრძელება", price: 45, minutes: 150, note: "Up to length 3.", noteKa: "მე-3 სიგრძემდე." },
        { name: "Milky gel extensions", ka: "რძისფერი გელით დაგრძელება", price: 55, minutes: 150 },
        { name: "Refill", ka: "კორექცია", price: 40, minutes: 120 },
        { name: "Milky gel refill", ka: "რძისფერი გელის კორექცია", price: 45, minutes: 120, note: "Up to length 3.", noteKa: "მე-3 სიგრძემდე." },
        { name: "Extensions with tips", ka: "ტიპსებით დაგრძელება", price: 65, minutes: 150 },
      ],
    },
    {
      name: "Pedicure",
      ka: "პედიკური",
      staff: feet,
      items: [
        { name: "Combo: gel polish + cuticle care", ka: "კომბო: გელ-ლაქი + კუტიკულის მოვლა", price: 45, minutes: 90 },
        { name: "Combo: regular polish + cuticle care", ka: "კომბო: ჩვეულებრივი ლაქი + კუტიკულის მოვლა", price: 45, minutes: 75 },
        { name: "Wet pedicure", ka: "სველი პედიკური", price: 80, minutes: 90, note: "Gel polish, cuticle care, scrub and heel care.", noteKa: "გელ-ლაქი, კუტიკულის მოვლა, სკრაბი და ქუსლის მოვლა." },
        { name: "Men's pedicure", ka: "მამაკაცის პედიკური", price: 80, minutes: 75 },
        { name: "Regular polish application", ka: "ჩვეულებრივი ლაქის წასმა", price: 30, minutes: 30 },
        { name: "Gel polish application", ka: "გელ-ლაქის წასმა", price: 30, minutes: 45 },
        { name: "Cuticle care only (feet)", ka: "მხოლოდ კუტიკულის მოვლა (ფეხი)", price: 30, minutes: 45 },
        { name: "Polish removal (feet)", ka: "ლაქის მოხსნა (ფეხი)", price: 10, minutes: 15 },
        { name: "Smart heel treatment", ka: "ქუსლის სმარტ-მოვლა", price: 15, minutes: 20 },
      ],
    },
    {
      name: "Strengthening & removal",
      ka: "გამაგრება და მოხსნა",
      staff: nails,
      items: [
        { name: "Acrylic strengthening", ka: "აკრილით გამაგრება", price: 15, minutes: 30 },
        { name: "Colored gel strengthening", ka: "ფერადი გელით გამაგრება", price: 30, minutes: 45, note: "25 ₾ together with gel polish.", noteKa: "გელ-ლაქთან ერთად 25 ₾." },
        { name: "Gel polish removal", ka: "გელ-ლაქის მოხსნა", price: 5, minutes: 15 },
        { name: "Strengthening removal", ka: "გამაგრების მოხსნა", price: 8, minutes: 15 },
        { name: "Extension removal", ka: "დაგრძელების მოხსნა", price: 10, minutes: 20, from: true, note: "10 ₾ if the extensions were done at our salon, 15 ₾ otherwise.", noteKa: "10 ₾, თუ დაგრძელება ჩვენთან გაკეთდა, სხვა შემთხვევაში 15 ₾." },
      ],
    },
    {
      name: "Nail design",
      ka: "ფრჩხილის დიზაინი",
      staff: nails,
      items: [
        { name: "French", ka: "ფრენჩი", price: 15, minutes: 20 },
        { name: "Ombré", ka: "ომბრე", price: 25, minutes: 30 },
        { name: "Chrome", ka: "ქრომი", price: 20, minutes: 15 },
        { name: "Stickers", ka: "სტიკერები", price: 2, minutes: 10, from: true, note: "Priced by the number of nails.", noteKa: "ფასი დამოკიდებულია ფრჩხილების რაოდენობაზე." },
        { name: "Hand-painted / intricate designs", ka: "ხელით მოხატვა / რთული დიზაინი", price: 2, minutes: 15, from: true, note: "Priced by the design.", noteKa: "ფასი დამოკიდებულია დიზაინზე." },
        { name: "One nail extension", ka: "ერთი ფრჩხილის დაგრძელება", price: 5, minutes: 10 },
        { name: "One nail strengthening", ka: "ერთი ფრჩხილის გამაგრება", price: 3, minutes: 10 },
      ],
    },
    {
      name: "Hair removal",
      ka: "ეპილაცია",
      staff: face,
      items: [
        { name: "Electrolysis · 30 minutes", ka: "ელექტროეპილაცია · 30 წუთი", price: 20, minutes: 30 },
        { name: "Waxing: upper lip", ka: "ცვილით: ზედა ტუჩი", price: 10, minutes: 15 },
        { name: "Waxing: sideburns", ka: "ცვილით: ბაკენბარდები", price: 15, minutes: 15 },
        { name: "Waxing: full face", ka: "ცვილით: მთლიანი სახე", price: 35, minutes: 30 },
      ],
    },
    {
      name: "Brows",
      ka: "წარბები",
      staff: lashBrow,
      items: [
        { name: "Eyebrow shaping with tweezers", ka: "წარბის ფორმირება პინცეტით", price: 20, minutes: 30 },
        { name: "Eyebrow waxing", ka: "წარბის ფორმირება ცვილით", price: 25, minutes: 30 },
        { name: "Brow lamination", ka: "წარბის ლამინირება", price: 40, minutes: 45, from: true, note: "40–50 ₾ depending on the work.", noteKa: "40–50 ₾, სამუშაოს მიხედვით." },
      ],
    },
    {
      name: "Permanent makeup",
      ka: "პერმანენტული მაკიაჟი",
      staff: face,
      items: [
        { name: "Lips", ka: "ტუჩები", price: 250, minutes: 120 },
        { name: "Lash line", ka: "წამწამების ხაზი", price: 250, minutes: 120 },
        { name: "Brows", ka: "წარბები", price: 300, minutes: 150 },
      ],
    },
    {
      name: "Lashes",
      ka: "წამწამები",
      staff: lashBrow,
      items: [
        { name: "Classic lashes", ka: "კლასიკური წამწამები", price: 50, minutes: 120 },
        { name: "2D lashes", ka: "2D წამწამები", price: 60, minutes: 150 },
        { name: "3D lashes", ka: "3D წამწამები", price: 70, minutes: 150 },
        { name: "4D lashes", ka: "4D წამწამები", price: 80, minutes: 180 },
        { name: "Mega volume", ka: "მეგა მოცულობა", price: 100, minutes: 180 },
        { name: "Lash removal", ka: "წამწამების მოხსნა", price: 15, minutes: 20 },
        { name: "Lash lamination", ka: "წამწამების ლამინირება", price: 80, minutes: 60, from: true, note: "80–100 ₾ depending on the work.", noteKa: "80–100 ₾, სამუშაოს მიხედვით." },
        { name: "Lash & brow lamination set", ka: "წამწამების და წარბების ლამინირება", price: 100, minutes: 90, from: true, note: "100–120 ₾ depending on the work.", noteKa: "100–120 ₾, სამუშაოს მიხედვით." },
      ],
    },
  ];

  let serviceNumber = 0;
  for (const [categoryIndex, category] of menu.entries()) {
    const categoryId = uuid("bc", categoryIndex + 1);
    await prisma.serviceCategory.upsert({
      where: { id: categoryId },
      update: {},
      create: { id: categoryId, tenantId: tenant.id, name: category.name, nameI18n: { ka: category.ka }, position: categoryIndex },
    });
    for (const [position, item] of category.items.entries()) {
      serviceNumber += 1;
      const serviceId = uuid("be", serviceNumber);
      await prisma.service.upsert({
        where: { id: serviceId },
        update: {},
        create: {
          id: serviceId,
          tenantId: tenant.id,
          categoryId,
          position,
          name: item.name,
          nameI18n: { ka: item.ka },
          description: item.note ?? null,
          descriptionI18n: item.noteKa ? { ka: item.noteKa } : undefined,
          durationMinutes: item.minutes,
          price: item.price,
          priceFrom: item.from ?? false,
        },
      });
      for (const professionalId of category.staff) {
        await prisma.serviceProfessional.upsert({
          where: { serviceId_professionalId: { serviceId, professionalId } },
          update: {},
          create: { tenantId: tenant.id, serviceId, professionalId },
        });
      }
    }
  }

  const existingHours = await prisma.businessHours.count({ where: { tenantId: tenant.id } });
  if (existingHours === 0) {
    await prisma.businessHours.createMany({
      data: [
        // Mon–Sat 10:00–20:00, Sunday 11:00–18:00
        ...[1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({ tenantId: tenant.id, professionalId: null, dayOfWeek, startTime: clock("10:00"), endTime: clock("20:00") })),
        { tenantId: tenant.id, professionalId: null, dayOfWeek: 0, startTime: clock("11:00"), endTime: clock("18:00") },
      ],
    });
  }

  await seedSubscription(tenant.id);

  // eslint-disable-next-line no-console
  console.log(`Seeded tenant "${tenant.subdomain}" — ${serviceNumber} services in ${menu.length} categories — login as owner@beauty.local / password123`);
}

/** R480: a 14-day trial from when the salon was first seeded; left alone on re-runs. */
async function seedSubscription(tenantId: string) {
  await prisma.subscription.upsert({
    where: { tenantId },
    update: {},
    create: { tenantId, planId: "early", trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) },
  });
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
