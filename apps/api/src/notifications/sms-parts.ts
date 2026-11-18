/**
 * R500: how many SMS parts a text is billed as. GSM-7 texts (plain Latin, as
 * every text we send is) fit 160 characters in one part and 153 per part once
 * split; the extension characters (^ { } \ [ ] ~ | €) take two. A single
 * character outside GSM-7 — a Georgian letter, an emoji — makes the whole
 * text Unicode: 70 in one part, 67 per part once split.
 */

const GSM7_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM7_EXTENSION = "^{}\\[~]|€\f";

export function smsParts(text: string): number {
  let septets = 0;
  let unicode = false;
  for (const char of text) {
    if (GSM7_BASIC.includes(char)) septets += 1;
    else if (GSM7_EXTENSION.includes(char)) septets += 2;
    else {
      unicode = true;
      break;
    }
  }
  if (unicode) {
    // UTF-16 code units: an emoji is two.
    const units = text.length;
    return units <= 70 ? 1 : Math.ceil(units / 67);
  }
  return septets <= 160 ? 1 : Math.ceil(septets / 153);
}
