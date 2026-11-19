/**
 * The emails the platform sends (R310 password resets, R430 set-password
 * links), as plain text and simple HTML. Pure: no config, no I/O. Everything
 * that comes from a salon or a user is escaped before it goes into the HTML.
 */

/** The CMS's languages (apps/cms/src/i18n; Russian is R570). */
export type MailLang = "en" | "ka" | "ru";

/** A language from a request; anything else is Georgian, the CMS's main audience. */
export function toMailLang(value: unknown): MailLang {
  return value === "en" || value === "ru" ? value : "ka";
}

export interface MailContent {
  subject: string;
  text: string;
  html: string;
}

/** One language's worth of an email, before it's turned into text and HTML. */
interface Part {
  subject: string;
  blocks: Block[];
}

type Block =
  | { kind: "p"; text: string }
  | { kind: "button"; label: string; href: string }
  | { kind: "lines"; lines: string[] };

const escapeHtml = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

function textOf(blocks: Block[]): string {
  return blocks
    .map((block) =>
      block.kind === "p" ? block.text : block.kind === "button" ? `${block.label}:\n${block.href}` : block.lines.join("\n"),
    )
    .join("\n\n");
}

// Email clients ignore stylesheets, so the few styles are inline; the colours
// are a neutral ink on white, readable whatever the salon's palette.
function htmlOf(blocks: Block[]): string {
  return blocks
    .map((block) => {
      if (block.kind === "p") return `<p style="margin:0 0 16px">${escapeHtml(block.text)}</p>`;
      if (block.kind === "lines") return `<p style="margin:0 0 16px">${block.lines.map(escapeHtml).join("<br>")}</p>`;
      const href = escapeHtml(block.href);
      return (
        `<p style="margin:0 0 8px"><a href="${href}" style="display:inline-block;padding:10px 18px;background:#15181b;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600">${escapeHtml(block.label)}</a></p>` +
        `<p style="margin:0 0 16px;font-size:13px;color:#5f666d;word-break:break-all">${href}</p>`
      );
    })
    .join("\n");
}

/** One email from one or more languages: each language in full, the first one on top. */
function compose(parts: Part[]): MailContent {
  const divider = "\n\n— — —\n\n";
  return {
    subject: parts.map((part) => part.subject).join(" / "),
    text: parts.map((part) => textOf(part.blocks)).join(divider),
    html:
      `<div style="font-family:system-ui,-apple-system,'Segoe UI',Roboto,'Noto Sans Georgian',sans-serif;font-size:15px;line-height:1.5;color:#15181b;max-width:560px">\n` +
      parts.map((part) => htmlOf(part.blocks)).join('\n<hr style="border:0;border-top:1px solid #d9dcd5;margin:24px 0">\n') +
      "\n</div>",
  };
}

export interface PasswordResetEmail {
  lang: MailLang;
  salonName: string;
  email: string;
  resetUrl: string;
}

/** R310: the forgot-password link, in the language the CMS was showing. Valid 30 minutes. */
export function passwordResetEmail({ lang, salonName, email, resetUrl }: PasswordResetEmail): MailContent {
  const parts: Record<MailLang, Part> = {
    en: {
      subject: `Reset your password · ${salonName}`,
      blocks: [
        { kind: "p", text: `Someone asked to reset the password of ${email} at ${salonName}.` },
        { kind: "button", label: "Choose a new password", href: resetUrl },
        { kind: "p", text: "The link works once, for 30 minutes. If it wasn't you, ignore this email: your password stays as it is." },
      ],
    },
    ru: {
      subject: `Сброс пароля · ${salonName}`,
      blocks: [
        { kind: "p", text: `Кто-то запросил сброс пароля для ${email} в ${salonName}.` },
        { kind: "button", label: "Выбрать новый пароль", href: resetUrl },
        { kind: "p", text: "Ссылка срабатывает один раз и действует 30 минут. Если это были не вы, просто проигнорируйте письмо: пароль останется прежним." },
      ],
    },
    ka: {
      subject: `პაროლის აღდგენა · ${salonName}`,
      blocks: [
        { kind: "p", text: `მოთხოვნილია ${email}-ის პაროლის აღდგენა (${salonName}).` },
        { kind: "button", label: "ახალი პაროლის არჩევა", href: resetUrl },
        { kind: "p", text: "ბმული ერთხელ მუშაობს, 30 წუთის განმავლობაში. თუ ეს თქვენ არ ყოფილხართ, ყურადღება არ მიაქციოთ ამ წერილს: პაროლი არ შეიცვლება." },
      ],
    },
  };
  return compose([parts[lang]]);
}

export interface SetupLinkEmail {
  salonName: string;
  /** The subdomain: what the CMS sign-in asks for as the "salon workspace". */
  workspace: string;
  email: string;
  cmsUrl: string;
  setPasswordUrl: string;
  /** Never signed in yet: a welcome. Otherwise a new-password link sent by platform support. */
  firstTime: boolean;
}

/**
 * R430: the owner's set-password link, sent by the platform admin — in Georgian
 * and English, since the admin doesn't choose a language. Valid 7 days.
 */
export function setupLinkEmail({ salonName, workspace, email, cmsUrl, setPasswordUrl, firstTime }: SetupLinkEmail): MailContent {
  const ka: Part = {
    subject: firstTime ? `თქვენი სალონი მზადაა · ${salonName}` : `ახალი პაროლის დაყენება · ${salonName}`,
    blocks: [
      firstTime
        ? { kind: "p", text: `თქვენი სალონი „${salonName}“ მზადაა. დააყენეთ პაროლი, რომ შეხვიდეთ და სალონი მოაწყოთ.` }
        : { kind: "p", text: `აქ არის ბმული ${email}-ის ახალი პაროლის დასაყენებლად (${salonName}). ახლანდელი პაროლი იმუშავებს, სანამ ბმულს გამოიყენებთ.` },
      { kind: "button", label: "პაროლის დაყენება", href: setPasswordUrl },
      { kind: "p", text: "ბმული ერთხელ მუშაობს, 7 დღის განმავლობაში." },
      { kind: "lines", lines: [`შემდეგ შედით აქ: ${cmsUrl}`, `სალონის სივრცე: ${workspace}`, `ელფოსტა: ${email}`] },
    ],
  };
  const en: Part = {
    subject: firstTime ? `Your salon is ready · ${salonName}` : `Set a new password · ${salonName}`,
    blocks: [
      firstTime
        ? { kind: "p", text: `Your salon ${salonName} is ready. Set your password to sign in and set it up.` }
        : { kind: "p", text: `Here is a link to set a new password for ${email} at ${salonName}. Your current password keeps working until you use it.` },
      { kind: "button", label: "Set your password", href: setPasswordUrl },
      { kind: "p", text: "The link works once, for 7 days." },
      { kind: "lines", lines: [`Afterwards, sign in at ${cmsUrl}`, `Salon workspace: ${workspace}`, `Email: ${email}`] },
    ],
  };
  return compose([ka, en]);
}

export interface ContactRequestEmail {
  name: string;
  business: string;
  phone: string;
  email: string | null;
  message: string | null;
  locale: string;
  /** The admin page, where the request is marked handled. */
  adminUrl: string | null;
}

/** R580: a new request from the marketing site's contact page, for platform staff (in English, as the admin page is). */
export function contactRequestEmail(request: ContactRequestEmail): MailContent {
  const lines = [
    `Name: ${request.name}`,
    `Business: ${request.business}`,
    `Phone: ${request.phone}`,
    ...(request.email ? [`Email: ${request.email}`] : []),
    `Language: ${request.locale}`,
  ];
  return compose([
    {
      subject: `New contact request · ${request.business}`,
      blocks: [
        { kind: "lines", lines },
        ...(request.message ? [{ kind: "p" as const, text: request.message }] : []),
        ...(request.adminUrl ? [{ kind: "button" as const, label: "Open the admin page", href: request.adminUrl }] : []),
      ],
    },
  ]);
}
