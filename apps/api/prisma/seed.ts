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
  await seedBeautyStudio(DEMO_BEAUTY);
  await seedBeautyStudio(AURA_BEAUTY);
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

interface BeautyStudio {
  name: string;
  subdomain: string;
  email: string;
  colors: { primary: string; secondary: string; background: string; text: string };
  /** First hex digit of the studio's fixed ids (uuid("<series>d", n) …), unique per studio. */
  idSeries: string;
}

const DEMO_BEAUTY: BeautyStudio = {
  name: "Demo Beauty Studio",
  subdomain: "beauty",
  email: "owner@beauty.local",
  colors: { primary: "#5a4636", secondary: "#c9b8a6", background: "#f4efe8", text: "#2b211a" },
  idSeries: "b",
};

/**
 * The same menu under a real-sounding name: the business the marketing site's
 * screenshots show (apps/marketing/scripts/capture-screens.mjs), so they never
 * say "Demo".
 */
const AURA_BEAUTY: BeautyStudio = {
  name: "Aura Beauty Studio",
  subdomain: "aura",
  email: "owner@aura.local",
  colors: { primary: "#3f4a3c", secondary: "#a9b79c", background: "#f3f2ec", text: "#22281f" },
  idSeries: "a",
};

/**
 * A real salon's price list (nails, hair removal, brows, permanent makeup,
 * lashes) for trying R510/R520 by hand: 9 categories in the menu's order, the
 * prices as printed, ranges ("10/15", "80/100", "from 2") as starting prices
 * with a note. The menu gives no durations: the ones here are estimates for
 * the salon to correct.
 */
/** The beauty studios' copy in Georgian and Russian (R160, R570). */
const COPY_I18N = {
  title: { ka: "ფრჩხილები, წამწამები და წარბები", ru: "Ногти, ресницы и брови" },
  description: { ka: "დაჯავშნე შემდეგი ვიზიტი ონლაინ, ერთ წუთში.", ru: "Запишитесь на следующий визит онлайн за минуту." },
};

/**
 * R570: adds a Russian translation to a row seeded before Russian existed —
 * only where it has none, so a re-run never overwrites a hand-made edit.
 * Each field is [the row's current map, the Russian text].
 */
async function addRussian(
  model: "service" | "serviceCategory" | "professional",
  id: string,
  fields: Record<string, [unknown, string | undefined]>,
) {
  const data: Record<string, Record<string, string>> = {};
  for (const [field, [current, ru]] of Object.entries(fields)) {
    const map = current && typeof current === "object" ? (current as Record<string, string>) : {};
    if (ru && !map.ru) data[field] = { ...map, ru };
  }
  if (Object.keys(data).length === 0) return;
  // The three delegates share `update({ where: { id }, data })`.
  const delegate = prisma[model] as unknown as { update: (args: { where: { id: string }; data: object }) => Promise<unknown> };
  await delegate.update({ where: { id }, data });
}

async function seedBeautyStudio(studio: BeautyStudio) {
  const tenant = await prisma.tenant.upsert({
    where: { subdomain: studio.subdomain },
    update: {},
    create: {
      name: studio.name,
      timezone: "Asia/Tbilisi",
      subdomain: studio.subdomain,
      onboardingFinishedAt: new Date(),
      configJson: {
        colors: studio.colors,
        enabledLocales: ["en", "ka", "ru"],
        copy: {
          title: "Nails, lashes & brows",
          titleI18n: COPY_I18N.title,
          description: "Book your next appointment online in a minute.",
          descriptionI18n: COPY_I18N.description,
        },
      },
    },
  });

  await prisma.tenantUser.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: studio.email } },
    update: {},
    create: { tenantId: tenant.id, email: studio.email, passwordHash: await bcrypt.hash("password123", 10), role: "owner" },
  });

  const uuid = (kind: string, n: number) => `00000000-0000-0000-0000-0000000${studio.idSeries}${kind}${String(n).padStart(3, "0")}`;

  const staff = {
    mariam: { id: uuid("d", 1), name: "Mariam", nameI18n: { ka: "მარიამი", ru: "Мариам" } },
    tamar: { id: uuid("d", 2), name: "Tamar", nameI18n: { ka: "თამარი", ru: "Тамар" } },
    nino: { id: uuid("d", 3), name: "Nino", nameI18n: { ka: "ნინო", ru: "Нино" } },
    eka: { id: uuid("d", 4), name: "Eka", nameI18n: { ka: "ეკა", ru: "Эка" } },
  };
  for (const professional of Object.values(staff)) {
    const row = await prisma.professional.upsert({ where: { id: professional.id }, update: {}, create: { tenantId: tenant.id, locationId: null, ...professional } });
    await addRussian("professional", row.id, { nameI18n: [row.nameI18n, professional.nameI18n.ru] });
  }
  const nails = [staff.mariam.id, staff.tamar.id];
  const feet = [staff.tamar.id];
  const lashBrow = [staff.nino.id];
  const face = [staff.eka.id];

  type Item = { name: string; ka: string; ru: string; price: number; minutes: number; from?: boolean; note?: string; noteKa?: string; noteRu?: string };
  const menu: { name: string; ka: string; ru: string; staff: string[]; items: Item[] }[] = [
    {
      name: "Manicure & gel polish",
      ka: "მანიკური და გელ-ლაქი",
      ru: "Маникюр и гель-лак",
      staff: nails,
      items: [
        { name: "Hot Combo: gel polish + manicure", ka: "ჰოთ კომბო: გელ-ლაქი + მანიკური", ru: "Хот-комбо: гель-лак + маникюр", price: 25, minutes: 75, note: "Cuticle care included.", noteKa: "კუტიკულის მოვლის ჩათვლით.", noteRu: "Уход за кутикулой включён." },
        { name: "Gel polish · Elpaza", ka: "გელ-ლაქი · Elpaza", ru: "Гель-лак · Elpaza", price: 15, minutes: 60 },
        { name: "Gel polish · Uno", ka: "გელ-ლაქი · Uno", ru: "Гель-лак · Uno", price: 20, minutes: 60 },
        { name: "Gel polish · Luxio Premium", ka: "გელ-ლაქი · Luxio Premium", ru: "Гель-лак · Luxio Premium", price: 35, minutes: 60 },
        { name: "Cuticle care", ka: "კუტიკულის მოვლა", ru: "Уход за кутикулой", price: 15, minutes: 30 },
      ],
    },
    {
      name: "Extensions",
      ka: "დაგრძელება",
      ru: "Наращивание",
      staff: nails,
      items: [
        { name: "Colored gel extensions", ka: "ფერადი გელით დაგრძელება", ru: "Наращивание цветным гелем", price: 45, minutes: 150, note: "Up to length 3.", noteKa: "მე-3 სიგრძემდე.", noteRu: "До 3-й длины." },
        { name: "Milky gel extensions", ka: "რძისფერი გელით დაგრძელება", ru: "Наращивание молочным гелем", price: 55, minutes: 150 },
        { name: "Refill", ka: "კორექცია", ru: "Коррекция", price: 40, minutes: 120 },
        { name: "Milky gel refill", ka: "რძისფერი გელის კორექცია", ru: "Коррекция молочным гелем", price: 45, minutes: 120, note: "Up to length 3.", noteKa: "მე-3 სიგრძემდე.", noteRu: "До 3-й длины." },
        { name: "Extensions with tips", ka: "ტიპსებით დაგრძელება", ru: "Наращивание на типсы", price: 65, minutes: 150 },
      ],
    },
    {
      name: "Pedicure",
      ka: "პედიკური",
      ru: "Педикюр",
      staff: feet,
      items: [
        { name: "Combo: gel polish + cuticle care", ka: "კომბო: გელ-ლაქი + კუტიკულის მოვლა", ru: "Комбо: гель-лак + уход за кутикулой", price: 45, minutes: 90 },
        { name: "Combo: regular polish + cuticle care", ka: "კომბო: ჩვეულებრივი ლაქი + კუტიკულის მოვლა", ru: "Комбо: обычный лак + уход за кутикулой", price: 45, minutes: 75 },
        { name: "Wet pedicure", ka: "სველი პედიკური", ru: "Влажный педикюр", price: 80, minutes: 90, note: "Gel polish, cuticle care, scrub and heel care.", noteKa: "გელ-ლაქი, კუტიკულის მოვლა, სკრაბი და ქუსლის მოვლა.", noteRu: "Гель-лак, уход за кутикулой, скраб и уход за пятками." },
        { name: "Men's pedicure", ka: "მამაკაცის პედიკური", ru: "Мужской педикюр", price: 80, minutes: 75 },
        { name: "Regular polish application", ka: "ჩვეულებრივი ლაქის წასმა", ru: "Покрытие обычным лаком", price: 30, minutes: 30 },
        { name: "Gel polish application", ka: "გელ-ლაქის წასმა", ru: "Покрытие гель-лаком", price: 30, minutes: 45 },
        { name: "Cuticle care only (feet)", ka: "მხოლოდ კუტიკულის მოვლა (ფეხი)", ru: "Только уход за кутикулой (ноги)", price: 30, minutes: 45 },
        { name: "Polish removal (feet)", ka: "ლაქის მოხსნა (ფეხი)", ru: "Снятие лака (ноги)", price: 10, minutes: 15 },
        { name: "Smart heel treatment", ka: "ქუსლის სმარტ-მოვლა", ru: "Смарт-уход за пятками", price: 15, minutes: 20 },
      ],
    },
    {
      name: "Strengthening & removal",
      ka: "გამაგრება და მოხსნა",
      ru: "Укрепление и снятие",
      staff: nails,
      items: [
        { name: "Acrylic strengthening", ka: "აკრილით გამაგრება", ru: "Укрепление акрилом", price: 15, minutes: 30 },
        { name: "Colored gel strengthening", ka: "ფერადი გელით გამაგრება", ru: "Укрепление цветным гелем", price: 30, minutes: 45, note: "25 ₾ together with gel polish.", noteKa: "გელ-ლაქთან ერთად 25 ₾.", noteRu: "25 ₾ вместе с гель-лаком." },
        { name: "Gel polish removal", ka: "გელ-ლაქის მოხსნა", ru: "Снятие гель-лака", price: 5, minutes: 15 },
        { name: "Strengthening removal", ka: "გამაგრების მოხსნა", ru: "Снятие укрепления", price: 8, minutes: 15 },
        { name: "Extension removal", ka: "დაგრძელების მოხსნა", ru: "Снятие наращивания", price: 10, minutes: 20, from: true, note: "10 ₾ if the extensions were done at our salon, 15 ₾ otherwise.", noteKa: "10 ₾, თუ დაგრძელება ჩვენთან გაკეთდა, სხვა შემთხვევაში 15 ₾.", noteRu: "10 ₾, если наращивание делали у нас, иначе 15 ₾." },
      ],
    },
    {
      name: "Nail design",
      ka: "ფრჩხილის დიზაინი",
      ru: "Дизайн ногтей",
      staff: nails,
      items: [
        { name: "French", ka: "ფრენჩი", ru: "Френч", price: 15, minutes: 20 },
        { name: "Ombré", ka: "ომბრე", ru: "Омбре", price: 25, minutes: 30 },
        { name: "Chrome", ka: "ქრომი", ru: "Хром", price: 20, minutes: 15 },
        { name: "Stickers", ka: "სტიკერები", ru: "Наклейки", price: 2, minutes: 10, from: true, note: "Priced by the number of nails.", noteKa: "ფასი დამოკიდებულია ფრჩხილების რაოდენობაზე.", noteRu: "Цена зависит от количества ногтей." },
        { name: "Hand-painted / intricate designs", ka: "ხელით მოხატვა / რთული დიზაინი", ru: "Роспись / сложный дизайн", price: 2, minutes: 15, from: true, note: "Priced by the design.", noteKa: "ფასი დამოკიდებულია დიზაინზე.", noteRu: "Цена зависит от дизайна." },
        { name: "One nail extension", ka: "ერთი ფრჩხილის დაგრძელება", ru: "Наращивание одного ногтя", price: 5, minutes: 10 },
        { name: "One nail strengthening", ka: "ერთი ფრჩხილის გამაგრება", ru: "Укрепление одного ногтя", price: 3, minutes: 10 },
      ],
    },
    {
      name: "Hair removal",
      ka: "ეპილაცია",
      ru: "Эпиляция",
      staff: face,
      items: [
        { name: "Electrolysis · 30 minutes", ka: "ელექტროეპილაცია · 30 წუთი", ru: "Электроэпиляция · 30 минут", price: 20, minutes: 30 },
        { name: "Waxing: upper lip", ka: "ცვილით: ზედა ტუჩი", ru: "Воск: верхняя губа", price: 10, minutes: 15 },
        { name: "Waxing: sideburns", ka: "ცვილით: ბაკენბარდები", ru: "Воск: виски", price: 15, minutes: 15 },
        { name: "Waxing: full face", ka: "ცვილით: მთლიანი სახე", ru: "Воск: всё лицо", price: 35, minutes: 30 },
      ],
    },
    {
      name: "Brows",
      ka: "წარბები",
      ru: "Брови",
      staff: lashBrow,
      items: [
        { name: "Eyebrow shaping with tweezers", ka: "წარბის ფორმირება პინცეტით", ru: "Коррекция бровей пинцетом", price: 20, minutes: 30 },
        { name: "Eyebrow waxing", ka: "წარბის ფორმირება ცვილით", ru: "Коррекция бровей воском", price: 25, minutes: 30 },
        { name: "Brow lamination", ka: "წარბის ლამინირება", ru: "Ламинирование бровей", price: 40, minutes: 45, from: true, note: "40–50 ₾ depending on the work.", noteKa: "40–50 ₾, სამუშაოს მიხედვით.", noteRu: "40–50 ₾ в зависимости от работы." },
      ],
    },
    {
      name: "Permanent makeup",
      ka: "პერმანენტული მაკიაჟი",
      ru: "Перманентный макияж",
      staff: face,
      items: [
        { name: "Lips", ka: "ტუჩები", ru: "Губы", price: 250, minutes: 120 },
        { name: "Lash line", ka: "წამწამების ხაზი", ru: "Межресничка", price: 250, minutes: 120 },
        { name: "Brows", ka: "წარბები", ru: "Брови", price: 300, minutes: 150 },
      ],
    },
    {
      name: "Lashes",
      ka: "წამწამები",
      ru: "Ресницы",
      staff: lashBrow,
      items: [
        { name: "Classic lashes", ka: "კლასიკური წამწამები", ru: "Классические ресницы", price: 50, minutes: 120 },
        { name: "2D lashes", ka: "2D წამწამები", ru: "2D-ресницы", price: 60, minutes: 150 },
        { name: "3D lashes", ka: "3D წამწამები", ru: "3D-ресницы", price: 70, minutes: 150 },
        { name: "4D lashes", ka: "4D წამწამები", ru: "4D-ресницы", price: 80, minutes: 180 },
        { name: "Mega volume", ka: "მეგა მოცულობა", ru: "Мега-объём", price: 100, minutes: 180 },
        { name: "Lash removal", ka: "წამწამების მოხსნა", ru: "Снятие ресниц", price: 15, minutes: 20 },
        { name: "Lash lamination", ka: "წამწამების ლამინირება", ru: "Ламинирование ресниц", price: 80, minutes: 60, from: true, note: "80–100 ₾ depending on the work.", noteKa: "80–100 ₾, სამუშაოს მიხედვით.", noteRu: "80–100 ₾ в зависимости от работы." },
        { name: "Lash & brow lamination set", ka: "წამწამების და წარბების ლამინირება", ru: "Ламинирование ресниц и бровей", price: 100, minutes: 90, from: true, note: "100–120 ₾ depending on the work.", noteKa: "100–120 ₾, სამუშაოს მიხედვით.", noteRu: "100–120 ₾ в зависимости от работы." },
      ],
    },
  ];

  let serviceNumber = 0;
  for (const [categoryIndex, category] of menu.entries()) {
    const categoryId = uuid("c", categoryIndex + 1);
    const categoryRow = await prisma.serviceCategory.upsert({
      where: { id: categoryId },
      update: {},
      create: { id: categoryId, tenantId: tenant.id, name: category.name, nameI18n: { ka: category.ka, ru: category.ru }, position: categoryIndex },
    });
    await addRussian("serviceCategory", categoryId, { nameI18n: [categoryRow.nameI18n, category.ru] });
    for (const [position, item] of category.items.entries()) {
      serviceNumber += 1;
      const serviceId = uuid("e", serviceNumber);
      const serviceRow = await prisma.service.upsert({
        where: { id: serviceId },
        update: {},
        create: {
          id: serviceId,
          tenantId: tenant.id,
          categoryId,
          position,
          name: item.name,
          nameI18n: { ka: item.ka, ru: item.ru },
          description: item.note ?? null,
          descriptionI18n: item.noteKa ? { ka: item.noteKa, ...(item.noteRu ? { ru: item.noteRu } : {}) } : undefined,
          durationMinutes: item.minutes,
          price: item.price,
          priceFrom: item.from ?? false,
        },
      });
      await addRussian("service", serviceId, { nameI18n: [serviceRow.nameI18n, item.ru], descriptionI18n: [serviceRow.descriptionI18n, item.noteRu] });
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

  // R570: a studio seeded before Russian existed publishes in it too.
  const config = (tenant.configJson ?? {}) as { enabledLocales?: string[]; copy?: { titleI18n?: object; descriptionI18n?: object } };
  if (!config.enabledLocales?.includes("ru")) {
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        configJson: {
          ...config,
          enabledLocales: [...(config.enabledLocales ?? ["en", "ka"]), "ru"],
          copy: {
            ...config.copy,
            titleI18n: { ...config.copy?.titleI18n, ru: COPY_I18N.title.ru },
            descriptionI18n: { ...config.copy?.descriptionI18n, ru: COPY_I18N.description.ru },
          },
        },
      },
    });
  }

  await seedSubscription(tenant.id);

  // eslint-disable-next-line no-console
  console.log(`Seeded tenant "${tenant.subdomain}" — ${serviceNumber} services in ${menu.length} categories — login as ${studio.email} / password123`);
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
