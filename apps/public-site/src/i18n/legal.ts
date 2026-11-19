import type { Locale } from "./locales";

// R340: the privacy policy and terms every tenant's site publishes. Template
// text with {salon} filled in per tenant — a starting point that a lawyer
// should review before launch, not legal advice. Georgian law applies (the
// Law on Personal Data Protection; the Personal Data Protection Service is the
// supervisory authority), and EU rules where EU residents book.

export interface LegalSection {
  heading: string;
  paragraphs: string[];
}

export interface LegalText {
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
}

const UPDATED = { en: "November 2026", ka: "2026 წლის ნოემბერი", ru: "ноябрь 2026 г." };

export const LEGAL: Record<Locale, { privacy: LegalText; terms: LegalText }> = {
  en: {
    privacy: {
      title: "Privacy policy",
      updated: UPDATED.en,
      intro:
        "This policy explains how {salon} uses the personal information you give when you book online. The booking site is run for {salon} by a booking-software provider, which handles the information only on {salon}'s behalf.",
      sections: [
        {
          heading: "What we collect",
          paragraphs: [
            "Your name and phone number. Your phone number is confirmed with a one-time code, so that only you can book and manage bookings in your name.",
            "The details of your booking: the services, the specialist, the branch, the date and time, and the price.",
            "What's needed to run the site safely: your IP address, used to stop abuse such as automated booking attempts, and small amounts of data kept in your browser — your language choice, and your progress through a booking so it isn't lost if you switch language.",
            "We don't ask for your email address, and we don't use advertising or tracking cookies.",
          ],
        },
        {
          heading: "Why we use it",
          paragraphs: [
            "To make, change and cancel your booking, to send you your booking link by SMS, and to let {salon} prepare for your visit. This is necessary to provide the booking you asked for.",
            "To show {salon}'s staff whether your recent visits there were attended or missed, so they can confirm a booking with you by phone. This record is worked out from your past bookings at {salon} only and is never shared with any other business.",
            "To keep the service secure and working — for example limiting repeated requests and investigating errors. This is in our legitimate interest and yours.",
          ],
        },
        {
          heading: "Who sees it",
          paragraphs: [
            "{salon} and its staff, to serve you.",
            "The booking-software provider and the services it relies on to run the site — hosting, database, SMS delivery and error monitoring — only as needed to provide the service. Your information is never sold, and is not used for advertising.",
          ],
        },
        {
          heading: "How long we keep it",
          paragraphs: [
            "Booking details are kept for as long as {salon} needs them to provide your booking and keep its business records, and as long as the law requires. Security data such as request counts is kept only briefly.",
          ],
        },
        {
          heading: "Your rights",
          paragraphs: [
            "You can ask {salon} to see the information held about you, to correct it, or to delete it, and you can object to how it is used. Contact {salon} using the details on this site.",
            "If you think your information has been mishandled, you can complain to the Personal Data Protection Service of Georgia.",
          ],
        },
        {
          heading: "Changes",
          paragraphs: ["If this policy changes, the new version will be published on this page with its date."],
        },
      ],
    },
    terms: {
      title: "Terms of use",
      updated: UPDATED.en,
      intro:
        "These terms apply when you book with {salon} through this site. {salon} provides the services; this site is the tool for booking them.",
      sections: [
        {
          heading: "Booking",
          paragraphs: [
            "A booking is confirmed when you see the confirmation screen. Please use your real name and a phone number you can receive texts on — it's confirmed with a one-time code.",
            "Your booking comes with a private link. Anyone who has it can change or cancel the booking, so don't share it.",
          ],
        },
        {
          heading: "Changing or cancelling",
          paragraphs: [
            "You can change or cancel online through your booking link until the time {salon} allows, which your booking page shows. After that, please contact {salon} directly.",
            "{salon} may need to move or cancel a booking, for example if a specialist is unavailable; it will contact you if so.",
          ],
        },
        {
          heading: "Prices and payment",
          paragraphs: [
            "Prices are those shown when you book. Nothing is paid online — you pay {salon} directly. Any rules about late arrival or missed appointments are {salon}'s own.",
          ],
        },
        {
          heading: "Fair use",
          paragraphs: [
            "Please don't use the site in ways that harm it or other customers — for example automated booking, or holding times you don't intend to book. Requests may be limited or refused to keep the service available.",
          ],
        },
        {
          heading: "Responsibility",
          paragraphs: [
            "{salon} is responsible for the services it provides. The booking site is provided as it is; we work to keep it accurate and available, but can't guarantee it will always be. Nothing in these terms limits rights you have under the law.",
          ],
        },
        {
          heading: "Changes and law",
          paragraphs: [
            "These terms may be updated; the version on this page applies to bookings made after its date. Georgian law applies.",
          ],
        },
      ],
    },
  },
  ka: {
    privacy: {
      title: "კონფიდენციალურობის პოლიტიკა",
      updated: UPDATED.ka,
      intro:
        "ეს პოლიტიკა განმარტავს, როგორ იყენებს {salon} პერსონალურ ინფორმაციას, რომელსაც ონლაინ ჯავშნისას გვაწვდით. ჯავშნის საიტს {salon}-ისთვის მართავს დაჯავშნის პროგრამის მომწოდებელი, რომელიც ინფორმაციას მხოლოდ {salon}-ის სახელით ამუშავებს.",
      sections: [
        {
          heading: "რას ვაგროვებთ",
          paragraphs: [
            "თქვენს სახელსა და ტელეფონის ნომერს. ნომერი დასტურდება ერთჯერადი კოდით, რათა თქვენი სახელით დაჯავშნა და ჯავშნის მართვა მხოლოდ თქვენ შეგეძლოთ.",
            "ჯავშნის დეტალებს: სერვისებს, სპეციალისტს, ფილიალს, თარიღს, დროსა და ფასს.",
            "საიტის უსაფრთხოდ მუშაობისთვის საჭირო მონაცემებს: თქვენს IP მისამართს — ბოროტად გამოყენების, მაგალითად ავტომატური ჯავშნის მცდელობების, შესაჩერებლად — და მცირე მონაცემებს თქვენს ბრაუზერში: არჩეულ ენას და ჯავშნის პროცესს, რომ ენის შეცვლისას არ დაიკარგოს.",
            "ელფოსტის მისამართს არ ვითხოვთ და სარეკლამო ან თვალთვალის ქუქი-ფაილებს არ ვიყენებთ.",
          ],
        },
        {
          heading: "რისთვის ვიყენებთ",
          paragraphs: [
            "ჯავშნის გასაკეთებლად, შესაცვლელად და გასაუქმებლად, ჯავშნის ბმულის SMS-ით გამოსაგზავნად და იმისთვის, რომ {salon} თქვენი ვიზიტისთვის მოემზადოს. ეს აუცილებელია თქვენ მიერ მოთხოვნილი ჯავშნის შესასრულებლად.",
            "იმისთვის, რომ {salon}-ის თანამშრომლებმა დაინახონ, მობრძანდით თუ არა ბოლო ვიზიტებზე, და შეძლონ ჯავშნის ტელეფონით დადასტურება. ეს ჩანაწერი დგება მხოლოდ {salon}-ში თქვენი წინა ჯავშნებიდან და არასოდეს გადაეცემა სხვა ბიზნესს.",
            "სერვისის უსაფრთხოებისა და გამართული მუშაობისთვის — მაგალითად, განმეორებითი მოთხოვნების შეზღუდვისა და შეცდომების გამოძიებისთვის. ეს ჩვენს და თქვენს კანონიერ ინტერესშია.",
          ],
        },
        {
          heading: "ვინ ხედავს",
          paragraphs: [
            "{salon} და მისი თანამშრომლები — თქვენი მომსახურებისთვის.",
            "დაჯავშნის პროგრამის მომწოდებელი და ის სერვისები, რომლებსაც საიტის მუშაობისთვის იყენებს — ჰოსტინგი, მონაცემთა ბაზა, SMS-ის მიწოდება და შეცდომების მონიტორინგი — მხოლოდ იმდენად, რამდენადაც სერვისის მისაწოდებლად არის საჭირო. თქვენი ინფორმაცია არასოდეს იყიდება და რეკლამისთვის არ გამოიყენება.",
          ],
        },
        {
          heading: "რამდენ ხანს ვინახავთ",
          paragraphs: [
            "ჯავშნის დეტალები ინახება იმდენ ხანს, რამდენიც {salon}-ს სჭირდება თქვენი ჯავშნის შესასრულებლად და ბიზნეს-ჩანაწერებისთვის, და იმდენ ხანს, რამდენსაც კანონი მოითხოვს. უსაფრთხოების მონაცემები, როგორიცაა მოთხოვნების რაოდენობა, მხოლოდ მოკლე ხნით ინახება.",
          ],
        },
        {
          heading: "თქვენი უფლებები",
          paragraphs: [
            "შეგიძლიათ მოსთხოვოთ {salon}-ს თქვენ შესახებ არსებული ინფორმაციის ნახვა, შესწორება ან წაშლა და გააპროტესტოთ მისი გამოყენება. დაუკავშირდით {salon}-ს ამ საიტზე მითითებული საკონტაქტო მონაცემებით.",
            "თუ ფიქრობთ, რომ თქვენი ინფორმაცია არასათანადოდ დამუშავდა, შეგიძლიათ მიმართოთ საქართველოს პერსონალურ მონაცემთა დაცვის სამსახურს.",
          ],
        },
        {
          heading: "ცვლილებები",
          paragraphs: ["თუ ეს პოლიტიკა შეიცვლება, ახალი ვერსია თარიღით ამავე გვერდზე გამოქვეყნდება."],
        },
      ],
    },
    terms: {
      title: "გამოყენების წესები",
      updated: UPDATED.ka,
      intro:
        "ეს წესები მოქმედებს, როცა ამ საიტით {salon}-ში ჯავშნით. მომსახურებას {salon} გაწევთ; ეს საიტი მისი დაჯავშნის საშუალებაა.",
      sections: [
        {
          heading: "დაჯავშნა",
          paragraphs: [
            "ჯავშანი დადასტურებულია, როცა დადასტურების გვერდს ხედავთ. გთხოვთ, მიუთითოთ ნამდვილი სახელი და ტელეფონის ნომერი, რომელზეც SMS-ს იღებთ — ის ერთჯერადი კოდით დასტურდება.",
            "ჯავშანს თან ახლავს პირადი ბმული. ვისაც ის აქვს, შეუძლია ჯავშნის შეცვლა ან გაუქმება, ამიტომ ნუ გაუზიარებთ სხვას.",
          ],
        },
        {
          heading: "შეცვლა ან გაუქმება",
          paragraphs: [
            "ჯავშნის ბმულით ონლაინ შეცვლა ან გაუქმება შეგიძლიათ იმ დრომდე, რასაც {salon} უშვებს — ეს თქვენი ჯავშნის გვერდზე ჩანს. ამის შემდეგ, გთხოვთ, პირდაპირ დაუკავშირდეთ {salon}-ს.",
            "შესაძლოა {salon}-ს ჯავშნის გადატანა ან გაუქმება დასჭირდეს, მაგალითად სპეციალისტის მიუწვდომლობის გამო; ასეთ შემთხვევაში დაგიკავშირდებათ.",
          ],
        },
        {
          heading: "ფასები და გადახდა",
          paragraphs: [
            "მოქმედებს დაჯავშნისას ნაჩვენები ფასები. ონლაინ არაფერი იხდება — {salon}-ს პირდაპირ უხდით. დაგვიანებისა და გაცდენილი ვიზიტის წესებს {salon} თავად ადგენს.",
          ],
        },
        {
          heading: "კეთილსინდისიერი გამოყენება",
          paragraphs: [
            "გთხოვთ, საიტი ისე არ გამოიყენოთ, რომ მას ან სხვა მომხმარებლებს ზიანი მიადგეს — მაგალითად ავტომატური დაჯავშნით ან ისეთი დროების დაკავებით, რომლის დაჯავშნასაც არ აპირებთ. სერვისის ხელმისაწვდომობისთვის მოთხოვნები შეიძლება შეიზღუდოს ან უარყოფილ იქნეს.",
          ],
        },
        {
          heading: "პასუხისმგებლობა",
          paragraphs: [
            "{salon} პასუხისმგებელია მის მიერ გაწეულ მომსახურებაზე. ჯავშნის საიტი მოწოდებულია ისე, როგორც არის; ვცდილობთ, იყოს ზუსტი და ხელმისაწვდომი, თუმცა ამის გარანტია ყოველთვის ვერ გვექნება. ეს წესები არ ზღუდავს კანონით მინიჭებულ თქვენს უფლებებს.",
          ],
        },
        {
          heading: "ცვლილებები და კანონი",
          paragraphs: [
            "ეს წესები შეიძლება განახლდეს; ამ გვერდზე არსებული ვერსია მოქმედებს მისი თარიღის შემდეგ გაკეთებულ ჯავშნებზე. მოქმედებს საქართველოს კანონმდებლობა.",
          ],
        },
      ],
    },
  },
  // R570. {salon} stays in the nominative in every sentence: a business's name
  // can't be declined, so it is never put where Russian would inflect it.
  ru: {
    privacy: {
      title: "Политика конфиденциальности",
      updated: UPDATED.ru,
      intro:
        "Эта политика объясняет, как {salon} использует персональные данные, которые вы указываете при онлайн-записи. Сайт записи работает на программе стороннего поставщика, который обрабатывает данные только по поручению бизнеса — {salon}.",
      sections: [
        {
          heading: "Что мы собираем",
          paragraphs: [
            "Ваше имя и номер телефона. Номер подтверждается одноразовым кодом, чтобы записываться и управлять записями от вашего имени могли только вы.",
            "Данные записи: услуги, специалиста, филиал, дату и время, цену.",
            "То, что нужно для безопасной работы сайта: ваш IP-адрес — чтобы пресекать злоупотребления, например автоматические попытки записи, — и немного данных в вашем браузере: выбранный язык и ход записи, чтобы он не терялся при смене языка.",
            "Мы не спрашиваем адрес электронной почты и не используем рекламные и отслеживающие cookie.",
          ],
        },
        {
          heading: "Зачем мы их используем",
          paragraphs: [
            "Чтобы оформить, изменить и отменить запись, отправить вам ссылку на запись по SMS и чтобы {salon} мог подготовиться к вашему визиту. Это необходимо для выполнения записи, о которой вы попросили.",
            "Чтобы сотрудники видели, приходили ли вы на свои последние визиты сюда, и могли подтвердить запись по телефону. Эти сведения вычисляются только по вашим прошлым записям здесь и никогда не передаются другим бизнесам.",
            "Чтобы сервис оставался безопасным и работал — например, ограничивать повторяющиеся запросы и разбирать ошибки. Это отвечает нашим и вашим законным интересам.",
          ],
        },
        {
          heading: "Кто их видит",
          paragraphs: [
            "{salon} и его сотрудники — чтобы вас обслужить.",
            "Поставщик программы для записи и сервисы, на которых работает сайт, — хостинг, база данных, доставка SMS и отслеживание ошибок — только в той мере, в какой это нужно для работы сервиса. Ваши данные никогда не продаются и не используются для рекламы.",
          ],
        },
        {
          heading: "Как долго мы их храним",
          paragraphs: [
            "Данные записи хранятся столько, сколько они нужны для вашей записи и для учёта, и столько, сколько требует закон. Данные безопасности, например счётчики запросов, хранятся недолго.",
          ],
        },
        {
          heading: "Ваши права",
          paragraphs: [
            "Вы можете попросить показать хранящиеся о вас данные, исправить или удалить их, а также возразить против их использования. Свяжитесь с нами по контактам на этом сайте.",
            "Если вы считаете, что с вашими данными обошлись неправильно, вы можете подать жалобу в Службу защиты персональных данных Грузии.",
          ],
        },
        {
          heading: "Изменения",
          paragraphs: ["Если политика изменится, новая версия будет опубликована на этой странице с датой."],
        },
      ],
    },
    terms: {
      title: "Условия использования",
      updated: UPDATED.ru,
      intro:
        "Эти условия действуют, когда вы записываетесь через этот сайт. Услуги оказывает {salon}; сайт — инструмент для записи на них.",
      sections: [
        {
          heading: "Запись",
          paragraphs: [
            "Запись подтверждена, когда вы видите экран подтверждения. Указывайте настоящее имя и номер телефона, на который приходят SMS, — он подтверждается одноразовым кодом.",
            "К записи прилагается личная ссылка. Любой, у кого она есть, может изменить или отменить запись, поэтому не передавайте её другим.",
          ],
        },
        {
          heading: "Перенос и отмена",
          paragraphs: [
            "Перенести или отменить запись онлайн по ссылке можно до срока, который установил {salon}; он указан на странице записи. После этого свяжитесь с нами напрямую.",
            "Иногда запись приходится перенести или отменить с нашей стороны — например, если специалист недоступен; в этом случае с вами свяжутся.",
          ],
        },
        {
          heading: "Цены и оплата",
          paragraphs: [
            "Действуют цены, показанные при записи. Онлайн ничего не оплачивается — вы платите на месте. Правила об опозданиях и пропущенных визитах устанавливает {salon}.",
          ],
        },
        {
          heading: "Добросовестное использование",
          paragraphs: [
            "Не используйте сайт во вред ему или другим клиентам — например, для автоматической записи или удержания времени, на которое вы не собираетесь записываться. Чтобы сервис оставался доступным, запросы могут ограничиваться или отклоняться.",
          ],
        },
        {
          heading: "Ответственность",
          paragraphs: [
            "За оказанные услуги отвечает {salon}. Сайт записи предоставляется как есть; мы стараемся, чтобы он был точным и доступным, но не можем гарантировать этого всегда. Ничто в этих условиях не ограничивает ваших прав по закону.",
          ],
        },
        {
          heading: "Изменения и право",
          paragraphs: [
            "Условия могут обновляться; версия на этой странице действует для записей, сделанных после её даты. Применяется законодательство Грузии.",
          ],
        },
      ],
    },
  },
};
