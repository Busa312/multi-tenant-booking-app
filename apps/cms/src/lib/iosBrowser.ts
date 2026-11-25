/**
 * R620: which iPhone/iPad browser this is, for the Add to Home Screen steps.
 * Every iOS browser can add a web app to the Home Screen (iOS 16.4+), but
 * each keeps Share somewhere else — and none lets a page start it.
 */
export interface IosBrowser {
  browser: "safari" | "chrome" | "other";
  ipad: boolean;
  /** Safari 26+ moved Share behind the ••• button in its default layout. */
  shareBehindMore: boolean;
}

export function iosBrowser(userAgent: string = navigator.userAgent): IosBrowser {
  const ipad = /iPad/.test(userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const browser = /CriOS\//.test(userAgent)
    ? "chrome"
    : /FxiOS\/|EdgiOS\/|OPiOS\/|YaBrowser\//.test(userAgent) || !/Safari\//.test(userAgent)
      ? "other"
      : "safari";
  const safariVersion = Number(/Version\/(\d+)/.exec(userAgent)?.[1] ?? 0);
  return { browser, ipad, shareBehindMore: browser === "safari" && safariVersion >= 26 };
}

/**
 * Where the browser's Share (or •••) button sits, for the pointer: Safari on
 * iPhone keeps it in the bottom bar (centre until iOS 26, then the ••• at the
 * right); Safari on iPad and Chrome keep it at the top right. Other browsers
 * vary, so they get no pointer.
 */
export type SharePosition = "bottom" | "bottom-end" | "top-end" | null;

export function sharePosition({ browser, ipad, shareBehindMore }: IosBrowser): SharePosition {
  if (browser === "chrome") return "top-end";
  if (browser !== "safari") return null;
  if (ipad) return "top-end";
  return shareBehindMore ? "bottom-end" : "bottom";
}
