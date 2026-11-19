# @booking/widget-react

Put a salon's online booking on its own React website.

The widget shows the salon's booking site inside your page. Everything in it —
colours, language, services, prices, opening hours — comes from what the salon
set in its CMS, so there is nothing to configure or keep in sync on your side.
Customers book exactly as they would on the booking site: phone verification,
availability and the booking rules all apply. No API key is needed.

```tsx
import { BookingWidget } from "@booking/widget-react";

export function Booking() {
  return <BookingWidget site="https://salon.platform.ge" size="medium" />;
}
```

Not using React? See [`@booking/widget`](../widget/README.md) for the
`<script>` tag version.

---

## Before you start

You need:

- **React 18 or newer.**
- **The salon's booking site address**, for example
  `https://salon.platform.ge` (or the salon's custom domain). Use the address the site actually ends up on: if one address redirects to another (a custom domain to the subdomain, say), give the final one. The salon owner
  can find it in the CMS: the **Open booking site** link at the bottom of the
  sidebar.

## Install

> The package is not published to npm yet. Inside this monorepo, add
> `"@booking/widget-react": "workspace:*"` to your app's dependencies.
> Once published, it will be:

```bash
npm install @booking/widget-react
```

## Choose a size

| Size | What it shows | When the customer clicks |
|---|---|---|
| `full` | The whole booking flow: services, location, professional, date and time, details, confirmation. | Books right there on your page. |
| `medium` | The salon's name, today's opening hours, its first five services with durations and prices, and a book button. | Opens the full booking flow over your page. |
| `small` | The salon's name, today's opening hours and a book button. | Opens the full booking flow over your page. |

Rules of thumb:
- A dedicated **"Book online" page** → `full`.
- A **services or prices section** → `medium`.
- A **sidebar, footer or contact block** → `small`.
- A **"Book now" button in your header** → [`BookingButton`](#open-booking-from-your-own-button).

## Quick start

```tsx
import { BookingWidget } from "@booking/widget-react";

const SITE = "https://salon.platform.ge";

export function BookingPage() {
  return (
    <main>
      <h1>Book an appointment</h1>
      <BookingWidget site={SITE} size="full" />
    </main>
  );
}
```

The widget fills the width of the element it is in and sets its own height to
fit its content, growing and shrinking as the customer moves through the steps.
It never shows a scrollbar of its own. To make it narrower, give it a
`className` or `style`, or put it in a narrower container:

```tsx
<BookingWidget site={SITE} size="small" style={{ maxWidth: 420 }} />
```

## `<BookingWidget>` props

| Prop | Type | Default | Description |
|---|---|---|---|
| `site` | `string` | — (required) | The salon's booking site, a full `https://` URL. |
| `size` | `"full" \| "medium" \| "small"` | `"full"` | See [Choose a size](#choose-a-size). |
| `locale` | `string` | salon's main language | `"en"`, `"ka"` or `"ru"`. A language the salon doesn't publish in falls back to its main one. |
| `serviceIds` | `string[]` | none | Services to start with ticked. |
| `locationId` | `string` | none | The branch to book at, for a salon with several. Skips the branch step. |
| `onBooked` | `(detail: { startAt: string }) => void` | none | Called when a customer completes a booking. See [Reacting to a booking](#reacting-to-a-booking). |
| `title` | `string` | `"Online booking"` | Accessible name of the widget's frame, for screen readers. |
| `className`, `style` | | | Applied to the element the widget fills. |

The widget reloads only when what it shows changes (`site`, `size`, `locale`,
`serviceIds`, `locationId`, `title`). Passing a new `onBooked` function on
every render is fine: the latest one is always called, and the frame is not
reloaded.

## Open booking from your own button

`<BookingButton>` is a plain `<button>` that you style however you like. On
click it opens the full booking flow in an overlay over your page.

```tsx
import { BookingButton } from "@booking/widget-react";

<BookingButton site={SITE} className="btn-primary">
  Book now
</BookingButton>;
```

It takes `site`, `locale`, `serviceIds`, `locationId` and `onBooked` like
`<BookingWidget>`, plus `frameTitle` for the overlay's accessible name. Every
other prop (`className`, `disabled`, `aria-*`, …) goes to the `<button>`. If
your own `onClick` calls `event.preventDefault()`, the overlay does not open.

A **"Book this" link per service** on your own price list:

```tsx
<BookingButton site={SITE} serviceIds={["8f3c…"]}>
  Book a haircut
</BookingButton>
```

Service ids are in the salon's own booking site: each service's **Book** link
on its home page ends in `/book?serviceIds=<id>`. Branch ids for `locationId`
are in the **Book at …** links (`/book?locationId=<id>`).

To open the flow from code instead, either put a `ref` on a widget:

```tsx
const widget = useRef<BookingWidgetRef>(null);

<BookingWidget ref={widget} site={SITE} size="small" />;
<button onClick={() => widget.current?.open({ serviceIds: ["…"] })}>Book a colour</button>;
```

or call `openBooking` directly (it needs no widget on the page):

```ts
import { openBooking } from "@booking/widget-react";

openBooking({ site: SITE, locale: "ka" });
```

The overlay closes with its × button, the Escape key, or a click outside it.
On phones it fills the screen.

## Reacting to a booking

`onBooked` is called once the booking is made, with the visit's start time as
an ISO timestamp. Use it for analytics or a thank-you message:

```tsx
<BookingWidget
  site={SITE}
  onBooked={({ startAt }) => {
    gtag("event", "booking_completed", { start_at: startAt });
  }}
/>
```

The same event is also dispatched on the widget's element as a bubbling DOM
event, `booking-widget:booked`, with `{ startAt }` in `event.detail`.

That is all your page learns about a booking. It never receives the customer's
name, phone number or the booking's manage link: the link lets anyone change or
cancel the booking, so it goes only to the customer, by SMS and on the
confirmation screen inside the widget.

## Languages

Without `locale`, the widget uses the salon's main language. Pass
`locale="ka"` or `locale="en"` to match your page, for example from your own
language switcher:

```tsx
<BookingWidget site={SITE} locale={currentLanguage} />
```

Changing `locale` reloads the widget in the new language.

## Colours and content

The widget always uses the salon's own palette and text from the CMS. To
change its colours, the salon owner edits **Colors** in the CMS; the widget
shows the new colours on its next load, with no change to your site. The
same goes for services, prices, opening hours and the salon's languages.

## Framework notes

**Next.js (App Router).** The components are client components (the package
starts with `"use client"`), so you can render them from a Server Component.
One catch: functions can't cross from a Server Component to a client one, so a
page that wants `onBooked` needs a small client wrapper:

```tsx
// app/book/BookingSection.tsx
"use client";
import { BookingWidget } from "@booking/widget-react";

export function BookingSection() {
  return <BookingWidget site={process.env.NEXT_PUBLIC_BOOKING_SITE!} onBooked={() => {/* … */}} />;
}
```

**Next.js (Pages Router), Remix, Gatsby, other server rendering.** Works as is.
On the server the component renders an empty `<div>`; the widget appears once
the page loads in the browser.

**Vite, Create React App, plain client-side React.** Works as is.

**StrictMode** is fine: the widget cleans up after itself, so React's
double-mounting in development never leaves a duplicate.

## Content Security Policy

If your site sends a `Content-Security-Policy` header, allow the salon's
booking site as a frame source:

```
Content-Security-Policy: frame-src https://salon.platform.ge;
```

Without it the browser blocks the frame and the widget stays empty.

## Several widgets on one page

Use as many as you like, in any mix of sizes. Each is independent. Only one
booking overlay is open at a time: opening another replaces it.

## Troubleshooting

| What you see | Likely cause |
|---|---|
| The widget's space is empty. | Your `Content-Security-Policy` doesn't allow the booking site as a `frame-src` (see above), or `site` is wrong. Check the browser console. |
| `BookingWidget: "site" must be a full URL…` in the console | `site` is missing `https://`, or isn't a URL. |
| The widget says the salon wasn't found. | `site` points at a subdomain or domain no salon owns. Copy it from the CMS's **Open booking site** link. |
| Wrong language. | `locale` isn't one the salon publishes in; the widget falls back to the salon's main language. The salon enables languages under **Text & languages** in the CMS. |
| Wrong colours. | The colours come from the salon's CMS, not from your CSS. Change them under **Colors** in the CMS. |
| A service is missing. | It is inactive in the CMS. (A service no professional performs is listed but can't be picked.) |
| `onBooked` never fires. | It fires only when a booking is completed, not when the flow is closed. |

## Try it

This monorepo has a stand-in salon website with every component and option
wired up:

```bash
pnpm dev                                   # the API and the booking site
pnpm --filter @booking/widget-demo start   # http://localhost:5180/react.html
```

## Build

```bash
pnpm --filter @booking/widget-react build  # → dist/booking-widget-react.js
```

React and `@booking/widget` are left out of the bundle: your app provides
React, and `@booking/widget` is a dependency.
