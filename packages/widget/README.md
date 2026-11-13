# @booking/widget

> Building with React? Use [`@booking/widget-react`](../widget-react/README.md),
> which also has the full integration guide.

A salon's online booking on its own website (R410). The widget shows the
salon's booking site in a frame, so everything inside it — colours, language,
services, prices — comes from what the salon set in the CMS, and it keeps the
booking site's phone verification, holds and limits. No API key is needed.

## Sizes

| Size | Shows | When used |
|---|---|---|
| `full` | The whole booking flow, inline. | Books in place. |
| `medium` | Salon name, today's hours, first five services with prices, a book button. | Opens the full flow over the page. |
| `small` | Salon name, today's hours, a book button. | Opens the full flow over the page. |

Every widget is as wide as the element it is placed in, and grows and shrinks
with its content.

## With a `<script>` tag (no build step)

```html
<div data-booking-widget data-site="https://salon.platform.ge" data-size="medium"></div>
<script src="https://<cdn>/booking-widget.js" defer></script>
```

`data-site` is the salon's booking site. Use the address it actually ends up
on: if one address redirects to another (a custom domain to the subdomain,
say), give the final one, or the widget can't hear from its frame.

Optional attributes: `data-size` (`full` | `medium` | `small`, default `full`),
`data-locale` (`en` | `ka`, default the salon's main language),
`data-service-ids` (comma-separated, ticked at the start), `data-location-id`,
`data-title` (accessible name of the frame).

The script also sets `window.BookingWidget` with the functions below.

## With a bundler

```ts
import { mount, openBooking } from "@booking/widget";

const widget = mount("#booking", {
  site: "https://salon.platform.ge",
  size: "small",
  locale: "ka",
  onBooked: ({ startAt }) => console.log("booked for", startAt),
});

widget.open();      // open the full flow over the page
widget.destroy();   // remove it

// The salon's own "Book now" button, no widget on the page:
openBooking({ site: "https://salon.platform.ge" });
```

## Events

A completed booking calls `onBooked` and dispatches a bubbling
`booking-widget:booked` event on the widget's element, with `{ startAt }` in
`event.detail`. The booking's manage link is never passed to the host page: it
is a credential, and it reaches the customer by SMS and on the confirmation
screen.

## Build

`pnpm --filter @booking/widget build` writes `dist/booking-widget.js` (script
tag) and `dist/booking-widget.es.js` (import). Try it on a stand-in salon site:

```bash
pnpm --filter @booking/widget-demo start   # http://localhost:5180, needs the public site running
```
