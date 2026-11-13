import { mount, mountAll, openBooking, type WidgetHandle } from "@booking/widget";

const site = (import.meta.env.VITE_BOOKING_SITE as string | undefined) ?? "http://demo.localhost:3000";

const log = (text: string) => {
  const item = document.createElement("li");
  item.textContent = `${new Date().toLocaleTimeString()}  ${text}`;
  document.getElementById("log")?.prepend(item);
};

document.getElementById("site-label")!.textContent = site;

let handles: WidgetHandle[] = [];

function render(locale: string | undefined) {
  handles.forEach((handle) => handle.destroy());

  // Declarative: the small widget's element carries its options as data attributes.
  const small = document.querySelector<HTMLElement>("[data-booking-widget]")!;
  small.dataset.site = site;
  if (locale) small.dataset.locale = locale;
  else delete small.dataset.locale;
  delete small.dataset.bookingWidgetMounted;

  handles = [
    ...mountAll(),
    mount("#medium-widget", { site, size: "medium", locale }),
    mount("#full-widget", { site, size: "full", locale }),
  ];
}

// One listener for every widget: the event bubbles from its element.
document.addEventListener("booking-widget:booked", (event) => {
  log(`booked — starts ${(event as CustomEvent<{ startAt: string }>).detail.startAt}`);
});

document.getElementById("own-button")!.addEventListener("click", () => {
  const locale = (document.getElementById("locale") as HTMLSelectElement).value || undefined;
  openBooking({ site, locale, onBooked: (detail) => log(`booked via own button — starts ${detail.startAt}`) });
});

document.getElementById("locale")!.addEventListener("change", (event) => {
  render((event.target as HTMLSelectElement).value || undefined);
});

render(undefined);
log(`widgets mounted against ${site}`);
