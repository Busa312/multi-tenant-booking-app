This document is a source of truth for both client and tenant side apps. System design and infrastructure should be built based on this document.

## Functional Requirements

### Client side (customer-facing booking site)

- **User** can see information about **Tenant**
- **User** can choose one or more services — at most five per booking (R210)
- **User** can have different professionals perform different services in one booking: the booking becomes a *visit* of back-to-back segments, each with its own professional (R200)
- **User** can see open appointment time slots, filtered by chosen service(s) and duration
- **User** can choose a specific **Professional** to book with, or "any available" — unless the tenant has turned that choice off (R440); "any available" is assigned fairly (R450)
- **User** can choose which **Location** to book at, when the tenant has more than one (R150)
- **User** can view, reschedule, or cancel an existing booking via a magic link (see below) — no account/login required. The link covers the whole visit; rescheduling or cancelling moves or cancels every segment together (R230)
- **User** can read the site in any of the tenant's enabled locales, chosen with a switcher (R160)
- **Tenant** can edit colors and logo for the client side page (via `config_json`)
- **Tenant** can set a public-site title and description, per enabled locale (R170)

**Scope of the public site.** It exists to take a booking. Its whole content inventory is: the
tenant's title/description and logo, the service list, the location list, the booking flow, and
the magic-link management pages. Gallery, about-us, team biographies, testimonials and blog are
deliberately *not* part of it — a tenant wanting those has a marketing site elsewhere and links
to this one. This is a product decision, not a deferral.

### Tenant side (CMS)

- **Tenant** can edit service list and service details (name, price, duration, assigned professionals)
- **Tenant** can edit list of professionals
- **Tenant** can edit business hours
- **Tenant** can set the longest gap allowed between two segments of one visit, 0–60 minutes, 0 = strictly back to back (R220)
- **Tenant** can turn off customers choosing a professional, for a business that books services rather than people (R440)
- **Tenant** can block off time (vacation, breaks, holidays) per professional or business-wide
- **Tenant** can book, reschedule, or cancel appointments on a customer's behalf
- **Tenant** can monitor booked appointments (calendar/list view)
- **Tenant** can edit the list of locations (branches) and assign each professional to one (R150)
- **Tenant** can write the public-site title and description, and translate service and location names, per enabled locale (R160/R170)
- **Professional** can log into the CMS with a restricted role: view/reschedule/cancel their own appointments and manage their own availability (hours, time-off) — cannot edit services, pricing, other professionals, or branding

## Requirement Ids

Code that implements a requirement is tagged with an `// Rxx:` comment naming it, and the test
that pins that behaviour carries the same tag. The ids are stable; they are never renumbered.

`R10`–`R140` were assigned as the CMS and booking engine were built and currently exist **only**
as those code comments — they are not written down here yet, and back-filling them from
`grep -rn "R[0-9]*:" apps packages` is worth doing. The ids this feature introduces:

| id | requirement |
|---|---|
| R150 | A customer picks which location to book at when the tenant has more than one; the choice filters the professionals offered and is recorded on the appointment. |
| R160 | The public site renders in any of the tenant's enabled locales, and the URL decides which: a path with no language prefix (`/book`) is the tenant's default locale, every other enabled locale lives under its code (`/ka/book`). Nothing else is consulted — no cookie, no `Accept-Language` — so one URL always shows one language. Each page declares its canonical URL and its translations (`hreflang`), the switcher is plain links between them, and a prefix that names the default locale or one the tenant hasn't enabled redirects to the unprefixed page. Supersedes the earlier cookie-based choice. |
| R170 | A tenant authors a public-site title and description, per enabled locale. |
| R180 | A professional with no location works at every location. |
| R190 | A location with appointment history is deactivated, never deleted. |
| R200 | A booking of several services may be split across professionals. It is one **visit**: an ordered chain of segments in the order the customer chose them, each segment one ordinary appointment with exactly one professional. Consecutive services by the same professional with no gap between them share one appointment. |
| R210 | A booking covers one to five services, enforced by the API as well as the UI. |
| R220 | `tenant.max_visit_gap_minutes` (0–60, default 0) is the longest idle gap allowed between consecutive segments of a visit. The planner always prefers the smallest gap. |
| R230 | The customer manages a visit as a unit: one magic link, and rescheduling or cancelling applies to every segment. Staff in the CMS still act on each appointment separately (a professional sees and edits only their own segment, R20). |
| R240 | The public site never books a segment with no professional. A service nobody performs (at the chosen location) can't be selected online; the old "unassigned" fallback applies only to staff bookings in the CMS. |
| R250 | When a customer picks a time on the public site, the professionals in that plan are **held** for 10 minutes: nobody else is offered that time or can book it. One hold per customer — picking another time replaces it. A hold that has expired doesn't stop the booking while the time is still free. If someone else got there first, the customer is told and shown the times that are still open. In the CMS a hold is a conflict warning like any other (R60). |
| R260 | Two bookings can't both be written for the same time by arriving together. Every write that can create a conflict — a customer booking, a hold, a reschedule, a CMS create or move — is serialized per tenant and local day, and checks availability only once it holds that turn. Staff override (R60) skips the check, not the queue. |
| R270 | No email address is asked for when booking — not on the public site, not in the CMS. The customer's phone is verified by code, and the magic link goes to that phone by SMS (and is shown on the confirmation screen). This supersedes the optional email of R30. |
| R280 | `tenant.min_booking_notice_minutes`: online bookings and reschedules must start at least this long from now (default 0). |
| R290 | `tenant.max_booking_advance_days`: online bookings and reschedules can't start more than this many days ahead (default 365). |
| R300 | `tenant.change_cutoff_hours`: a customer can reschedule or cancel online only until this many hours before the visit starts (default 0); after that the manage page says to contact the salon. Staff in the CMS are bound by none of R280–R300. |
| R310 | A CMS user who forgot their password requests a reset link by business and email. The answer never reveals whether the account exists; the link is single-use, expires in 30 minutes, and using it ends every session of that user. |
| R320 | CMS sessions can be ended server-side: logging out revokes that session's token, and a password change, a reset or deactivating the login ends all of that user's sessions immediately. The session token lives only in an httpOnly, SameSite=Strict cookie — the CMS's own JavaScript never sees it — and every state-changing CMS request must carry a header a cross-site form can't send. |
| R330 | Every endpoint that can be called without a login, or that guards one (login, password reset, code verification, availability, holds, booking, manage-link actions), is rate limited per client address, and the sensitive ones per account or phone as well. Hitting a limit answers 429. |
| R340 | The public site publishes a privacy policy and terms of use, linked from every page and from the booking form. |
| R360 | Staff see when a booking's customer has missed recent visits. For each appointment the CMS lists, the API reports how many of that phone's last three *finished* visits in the salon (marked *completed* or *no-show*, before that appointment) were no-shows; cancelled and still-booked ones don't count, a visit counts once however many segments it has, and counts as missed only if every segment was. It is derived on read, never stored, and never leaves the salon or reaches the public site. The CMS shows it on the bookings views, the booking's details, the dashboard agenda and the override-conflict warning, and the dashboard lists the next 7 days' bookings from such customers. A customer with no finished visit is not flagged. |
| R370 | The CMS home page shows numbers computed by the API (`GET /cms/dashboard`), following the location tab: past bookings still marked *booked*, which staff can mark *completed* or *no-show* right there (R100); the next 7 days' bookings and occupancy (booked minutes ÷ working minutes, where working minutes are business hours minus time off); and the last 30 days against the 30 before (bookings, no-show and cancellation rates, share booked online, new vs returning clients by phone, and the value of completed appointments). A professional login sees only their own appointments and never a money figure. |
| R380 | A salon's owner can block a phone number from booking online, and unblock it. A block is that salon's alone: the number books normally at every other salon, and no salon can see another's list (`blocked_phone`, tenant-scoped with RLS). Numbers are matched however they are typed (spaces, `+`, `00`, or a 9-digit Georgian mobile without its country code). A blocked number is refused when it asks for a verification code — before any SMS is sent — and again when the booking is made, with 403 `phone_blocked`; the site tells the customer to call the salon. Bookings the number already has are untouched and stay manageable by their link, and staff can still book the customer from the CMS, where bookings from a blocked number are marked. |
| R390 | The public home page shows the salon's opening hours for the week, today marked. They are the tenant-wide business hours; a tenant that set none, only per-professional hours, is shown as open from its first active professional's start to its last one's finish. One window per day, closed days shown as closed. The tenant's site also answers `/robots.txt` and `/sitemap.xml` (every public page in every enabled locale; manage links excluded) and serves its own icon. |
| R400 | A customer is identified by phone number in one canonical spelling (`appointment.phone_key`): digits only, a leading `00` dropped, and a 9-digit Georgian mobile given its `995` country code, so `598 55 05 94` and `+995598550594` are one customer. The no-show history (R360), new-vs-returning clients (R370), blocked numbers (R380), the lost-link lookup and the per-phone limits (R330) all match on it. `phone_number` keeps what was typed, for display and for texting. |
| R410 | A salon can put its booking on its own website with an embeddable widget (`packages/widget`) in three sizes: *full* (the whole booking flow inline), *medium* (name, today's hours, the first services with prices, a book button) and *small* (name, today's hours, a book button); medium and small open the full flow in an overlay. The widget frames the salon's booking site (`/embed/{full,medium,small}`, in any enabled locale), so its palette, language, services and every booking rule are the site's own, and it needs no key. Only the embed pages may be framed by other sites; they are not indexed. They tell the host page their height, when to open or close the overlay, and that a booking was made (its start time only — never the manage link). |
| R420 | A salon's owner is guided through setting the salon up, in order: locations, opening hours, services, team, booking-site look, going live. Every step can be skipped and reopened. Whether a step is done is read from the salon's data (a location exists; tenant-wide business hours exist; an active service; an active professional; colours or site text saved), never stored; only the skipped steps and whether the setup was finished or dismissed are kept on the tenant. The first time an owner opens the CMS for a salon with nothing set up, the setup opens; until it is finished or dismissed, the dashboard shows the owner its progress. Professional logins never see it. |
| R430 | Platform staff onboard new salons from an admin page served by the API (`/admin`): sign in, create a salon with its owner (name, subdomain, time zone, owner email and an initial password, which can be generated), and see every salon with its setup progress. The admin is not a CMS user: one account, configured in the API's environment (`ADMIN_EMAIL` and a bcrypt `ADMIN_PASSWORD_HASH`); with neither set the page doesn't exist. Its session is a separate httpOnly cookie scoped to `/admin`, revocable, expiring after 2 hours; sign-in is rate limited per address and in total, and state-changing requests need the same anti-CSRF header as the CMS. Subdomains are lowercase letters, digits and hyphens, not reserved (`www`, `api`, `cms`, `admin`, …), and owner passwords meet the CMS's minimum length. |
| R440 | `tenant.customers_choose_professional` (default true): whether customers pick who serves them online. Off — for a business where customers book a service, not a person (a car wash) — the booking site has no professional step and never names who will do the job (time picker, summary, confirmation, manage page); every segment is booked as "any professional" and assigned by R450. The CMS is unchanged: professionals, their hours and services still decide availability, and staff see who is assigned. Independently of the setting, the booking flow leaves out a step with nothing to choose: the services step when exactly one service can be booked (it is picked), the professional step when no chosen service has more than one qualified professional at the chosen location, the location step when there is one location (R150). |
| R450 | "Any professional" is assigned fairly. Among the qualified professionals free for a segment, the one with the lowest share of their working time that day already booked is chosen — booked appointments and other customers' live holds (R250) over working hours minus time off — so a part-timer is filled in proportion to their hours, not first. Ties go to fewer booked minutes, then to an order that rotates daily, so nobody is first in line every day by name. The professional of the previous segment is still preferred for the next one (R200), so a one-person visit stays one appointment. |
| R460 | Each professional's week can mark days off, chosen per weekday like the organisation's open days. A professional's weekday is one of: following the organisation's hours (the default; closed when the organisation is closed), their own hours, or a day off — a day off means no bookings with them that weekday even when the organisation is open. Recurring days off are part of the weekly schedule; one-off absences stay time off. |
| R470 | A salon pays the platform a monthly subscription by card, through Flitt's hosted payment page (system_design.md §12b). The owner — never a professional login — picks a plan in the CMS: **Early adopter** (60 GEL, 600 texts, 1 location), **Early Pro** (90 GEL, 1,000 texts, up to 3 locations) or **Pro** (150 GEL, 1,500 texts, any number of locations, priority support); **Standard** (90 GEL, 600 texts, 1 location) exists but isn't offered until SMS reminders ship. The two early plans stop being offered when the early-adopter period ends; a salon on one keeps renewing on it. These are the starting values: the platform admin edits them (R550). Months are paid in advance; the card is saved (Flitt token) and the platform charges it on each renewal date, together with the month just ended's extra texts (R500). A plan switch takes effect at the next renewal. Cancelling stops the next renewal and can be undone until the paid month ends. The card is replaced by a verification payment that is refunded at once. Every payment attempt is listed as an invoice with its outcome. No card number ever reaches the platform. |
| R480 | A new salon starts with a 14-day free trial (salons that existed before billing: 14 days from its rollout). Paying during the trial keeps the remaining trial days — the first paid month starts when the trial ends. A salon's status is derived, never stored: *free* (granted by the platform admin, R430), *trial*, *active* (paid through a future date), *past due* (up to 7 days after the trial or the paid month ended without payment; a failed renewal is retried daily) or *lapsed*. The platform admin (R430) can grant free use, and extend or end a trial. The CMS tells the owner when the trial is ending, when a payment failed and when booking is paused. |
| R490 | A lapsed salon's booking site stops taking new online bookings: it says booking is unavailable, and the API refuses holds and bookings. Everything else keeps working — the CMS (so the owner can pay), staff bookings, and customers' manage links. Paying lifts the pause at once. A server with no payment provider configured pauses nobody, since nobody there could pay. |
| R500 | Texts are counted per **billing month** — the salon's paid month — against the allowance of the plan paid for it (R470), and shown on the subscription page as they're used; outside a paid month (trial, free use, lapsed) the calendar month in the salon's time zone is shown instead and nothing is charged. A text counts once the SMS provider accepts it, by the SMS parts it is billed as (160 Latin characters per part, 153 each when split); only texts sent on the salon's behalf count — booking codes and booking links — and what was sent, and to whom, isn't kept. Both texts are written to fit **one part** in plain Latin: the booking link's text stays within 160 characters for any salon address up to 80 characters (subdomain or custom domain), so a long salon name never doubles its cost. Texts beyond the allowance cost **0.07 GEL each** and are added to the next renewal: one card payment covers the coming month and the month just ended's extra texts, and the invoice shows both. Texts are never blocked over the allowance — every online booking needs one. A cancelled subscription's last month isn't followed by a renewal, so its extra texts aren't charged. The owner is warned in the CMS at 80% and 100% of the allowance; the platform admin sees each salon's usage. |
| R510 | Services are grouped into **categories** the salon names (translatable, R160) — e.g. Nails, Lashes, Brows — and the salon sets the order of the categories and of the services in each. The booking site and the CMS show services in that order, under their category's heading; services in no category come last, under a general heading. Deleting a category keeps its services, uncategorized. A price list with options ("3 lengths", "short/long") is entered as one service per option in the same category. |
| R520 | A service's price can be a **starting price**, shown as "from 15 ₾". The amount stored is that starting price; a booking records it (R40), and a booking — or a visit total — that includes a starting price is shown as "from" too, on the booking site, its confirmation, the manage page and in the CMS. The salon settles the final amount in person. |
| R530 | Staff mark a booking *completed* or *no-show* (R100) only once it has started — a no-show can't happen before the appointment, and marking one early would count against the customer's history (R360). The CMS offers both only from the start time on, and the API refuses them before it; putting a booking back to *booked*, and cancelling, stay available any time. |
| R540 | A plan limits how many **active** locations (R150) a salon may have: Early adopter 1, Early Pro 3, Pro any number (R470). Adding a location, or reopening a closed one, beyond the limit is refused with the limit and a pointer to the Subscription page; closed locations don't count, and having no location at all stays allowed. The limit is that of the plan the salon renews on: a switch waiting for the next renewal counts at once (an upgrade's room is usable straight away, the bigger plan being charged at renewal), except after cancelling, when the current plan's limit holds. It doesn't apply on the free trial (nothing has been chosen yet), to a salon the platform admin made free (R430), or on a server with no payment provider (R490's valve: nobody there could upgrade). Paying for a plan, or switching to one, is refused while the salon has more active locations than that plan allows; nothing is ever closed automatically. |
| R550 | The platform admin (R430) edits the plans on the admin page, without a deploy: each plan's monthly price, texts included, active-location limit (or none) and whether owners can choose it (*offered*); at least one plan stays offered. Changes apply at once and to salons already on the plan: a new price is charged from each salon's next renewal (the page says so before saving), the allowance and location limit count straight away — including for the billing month in progress. Plans can't be added or deleted here (a new plan needs its name translated in the CMS); one that is no longer wanted is made not offered. Every change is logged with the old and new values. |

## Booking Access — Magic Link

Resolves the open question "should User log in to book an appointment?" — decision: **no login system**. Instead, each customer booking (a `Visit`, R200) gets a single-use-context access token.

**Flow**

1. Customer books an appointment (name + a verified phone number — no account, no email, R270).
2. Server generates a random, high-entropy token, stores its hash on the `Visit` row, and sets an expiry (end of the visit's last segment + 24h grace period).
3. Server texts the link to the verified phone (`https://{tenant-domain}/manage/{token}`) and shows it on the confirmation screen.
4. Visiting that link authorizes read/reschedule/cancel actions against that one visit only (all of its segments, together — R230) — it does not authenticate a customer identity or grant access to other bookings.
5. The link stays the same for the life of the visit. Rescheduling — by the customer, or staff moving a segment in the CMS — keeps the token and only moves its expiry to the new end + 24h, so the link already texted keeps working and no new SMS is sent. (Rotating on every move was dropped: it only guarded against someone who already held the link, who could reschedule or cancel anyway, and it cost an SMS per move and stranded customers whose booking staff had moved.) The token is replaced only by lost-link recovery, below.

**Recovering a lost link**: customer enters their phone number on a "resend link" page; server looks up upcoming, non-cancelled appointments for that phone number and texts fresh tokens to that number. Rate-limit this endpoint (phone-number enumeration risk).

## CMS Access & Roles

The CMS is single shared deployment, tenant-scoped via JWT (per project architecture). Within a tenant, two roles:

- **owner**: full access — services, pricing, professionals, hours, branding/config, all appointments, staff logins. Exactly one `owner` per tenant.
- **professional**: restricted — own appointments (view/reschedule/cancel), own hours and time-off only. No access to pricing, other professionals' data, or branding. A tenant can have any number of `professional` logins.

Deactivating a `Professional` (business record) does not automatically disable their `TenantUser` login — the owner deactivates the login by hand as a separate step. No cascade automation between the two.

Login identity is separated from the business-facing `Professional` record (a `Professional` can exist without ever logging in — e.g. a stylist whose schedule the owner manages directly). `TenantUser` holds credentials + role and optionally links to a `Professional` row when role is `professional`.

JWT claims: `sub` (user id), `tenant_id`, `role`, `professional_id` (present only for `professional` role), `jti` (this session) and `sv` (the user's `session_version`, R320) — the CMS enforces role-based feature access at the API layer, separate from and in addition to Postgres RLS (RLS scopes rows to a tenant; it doesn't know about roles within a tenant, so professional-vs-owner restrictions must be enforced in application logic).

## Non-Functional Requirements

- SEO optimization on the public booking site
- Public site P95 load time target: 300ms under normal traffic (flag: aggressive once per-request tenant/domain resolution is in the path — validate early against the Redis-cached lookup, don't assume it holds under cold cache or custom-domain verification lookups)
- Mobile-first on the client side; easy-to-navigate UI on both apps
- Every table carries `tenant_id` with Row-Level Security — no exceptions, including junction and lookup tables added below

## Out of Scope (for now)

- In-app booking payment collection (see note below) — customers paying salons. Salons paying the platform (R470) is in scope.
- Customer accounts / login
- Client-side template/layout customization by tenant. The tenant controls colors, logo, title and description (all via `config_json`) — the layout itself is fixed.

**Note on payment (confirmed)**: the website is reservation-only. The customer pays in person at the salon after the appointment; no online checkout happens during booking, and `Appointment` carries no payment-status or payment-session fields. Online payment (gateway integration, adapters, etc.) is out of scope for now — not designed here, revisit if/when that work is scheduled.

## Assumptions Made Resolving Prior Conflicts

- **Service ↔ Professional is many-to-many** (a professional can perform several services; a service can be performed by several professionals), via a join table. The two original docs disagreed on this (array-style fields vs. singular FK) — confirm this matches reality before building the schema, since it's the one modeling decision with the biggest schema impact.
- **Time-slots are computed, not stored.** Rather than a granular `Time-slot` row per bookable interval, availability is derived at query time from `BusinessHours` minus existing `Appointment`s minus `TimeOff` blocks. This is what "Tenant can change status of time slots" is modeled as below (create/remove a `TimeOff` block) rather than a giant pre-generated slot table.
  The one stored exception is `SlotHold` (R250): short-lived rows that read as busy time while a customer finishes booking, then expire. They hold a planned visit's segments, not a grid of slots.

## Data Model

All tables include `tenant_id uuid` + RLS policy scoping to the current tenant, even where not repeated below.

### Tenant
| column | type | notes |
|---|---|---|
| `id` | uuid, PK | |
| `name` | text | |
| `timezone` | text | IANA tz, needed for hours/slot math |
| `subdomain` | text, unique | e.g. `acme` for `acme.platform.ge` |
| `custom_domain` | text, unique, nullable | CNAME target |
| `domain_verified_at` | timestamptz, nullable | null until DNS TXT verification passes |
| `config_json` | jsonb | theme/presentation config (colors, logo, copy) |
| `max_visit_gap_minutes` | smallint, default 0 | R220: longest gap between visit segments, 0–60. A booking rule, so a column rather than `config_json` |
| `min_booking_notice_minutes` | smallint, default 0 | R280: 0–2880 |
| `max_booking_advance_days` | smallint, default 365 | R290: 1–365 |
| `change_cutoff_hours` | smallint, default 0 | R300: 0–168 |
| `customers_choose_professional` | boolean, default true | R440: false = the booking site never offers or names a professional |
| `created_at` | timestamptz | |

### Localized content (convention)

Tenant-authored text that customers read is stored twice: the **plain column holds the default
locale** (`config_json.enabled_locales[0]`) and stays a normal, queryable, indexable column; a
sibling `*_i18n jsonb` column holds only the *other* locales, as `{"ka": "…"}`. A locale absent
from the map falls back to the plain column.

This is the one narrow exception to "everything queryable is normalized columns, not JSON blobs"
(`system_design.md` §5), and it is bounded: only presentation text is ever stored this way. Nothing
is filtered, sorted or joined on a translation.

Resolution is done by the *frontends*, never by the API — `apps/api` returns both the plain value
and the map and stays locale-agnostic, so there is exactly one copy of the fallback rule
(`packages/shared-types/src/i18n.ts`) rather than a hand-maintained second copy inside the API.

Columns following this convention: `service.name`, `service.description`, `professional.name`,
`location.name`, `location.address_line`, and `config_json.copy.title` / `.description`.

**Which locales a tenant publishes in** is `config_json.enabled_locales`, editable by the owner
(R160). Both platform locales are on by default. The *first* entry is the tenant's default
locale — the one the plain columns hold — and it cannot be switched off, because every missing
translation falls back to those columns: dropping it would serve text labelled as a language it
isn't written in. Changing which language is default is a data migration, not a setting.

### Location

A tenant's physical branch. A tenant may have none (the common case — a single salon with no
address worth modelling), one, or several.

| column | type | notes |
|---|---|---|
| `id` | uuid, PK | |
| `tenant_id` | uuid, FK | |
| `name` | text | e.g. "Vake", "Saburtalo" |
| `name_i18n` | jsonb, nullable | non-default locales, per the convention above |
| `address_line` | text | street address as one line |
| `address_line_i18n` | jsonb, nullable | |
| `city` | text, nullable | |
| `city_i18n` | jsonb, nullable | non-default locales, as for the address line — so a translated address doesn't end in the default-language city |
| `phone` | text, nullable | branch phone, shown on the public site |
| `latitude` | numeric(9,6), nullable | for the map link; both coords set or neither. Set in the CMS by placing a pin on a map (searchable by address), not typed |
| `longitude` | numeric(9,6), nullable | |
| `position` | smallint | display order on the public site |
| `is_active` | boolean, default true | R190: deactivated, never deleted, once it has history |
| `created_at` | timestamptz | |

**Locations are a bookable dimension, not decoration.** The location a customer picks filters
which professionals they can book (below), and is recorded on the `Appointment` so the
confirmation and the magic link can say where to turn up.

**Per-location business hours are deliberately absent.** A professional belongs to one location
and already carries their own `BusinessHours` rows, so hours are location-scoped by consequence.
The case this cannot express is one person working mornings at one branch and afternoons at
another; supporting it means making `Professional.location_id` a join table and scoping
`BusinessHours` to (professional, location). Deferred until a real tenant needs it.

### Professional
| column | type | notes |
|---|---|---|
| `id` | uuid, PK | |
| `tenant_id` | uuid, FK | |
| `location_id` | uuid, FK, nullable | R180: null = works at every location |
| `name` | text | |
| `name_i18n` | jsonb, nullable | non-default locales, per the convention above |
| `created_at` | timestamptz | |

`location_id` is nullable in the same sense `professional_id` is nullable on `BusinessHours` and
`TimeOff`: null means "applies everywhere" rather than "unknown". A tenant with no locations has
every professional at null, which is why adding locations does not disturb existing tenants.

### TenantUser
| column | type | notes |
|---|---|---|
| `id` | uuid, PK | |
| `tenant_id` | uuid, FK | |
| `professional_id` | uuid, FK, nullable | set only when `role = professional`; null for `owner` |
| `email` | text, unique per tenant | login identifier |
| `password_hash` | text | email+password login |
| `role` | text | `owner` \| `professional` — exactly one `owner` row per `tenant_id` (partial unique constraint) |
| `is_active` | boolean, default true | manually toggled by the owner; not auto-linked to `Professional` deactivation. Turning it off ends the user's sessions (R320) |
| `session_version` | int, default 0 | R320: carried in every JWT; bumping it (password change/reset, deactivation) invalidates all of the user's tokens at once |
| `password_reset_token_hash` | text, unique, nullable | R310: sha256 of the reset token; cleared when used |
| `password_reset_expires_at` | timestamptz, nullable | R310: issue + 30 min |
| `created_at` | timestamptz | |
| `last_login_at` | timestamptz, nullable | |

### Service
| column | type | notes |
|---|---|---|
| `id` | uuid, PK | |
| `tenant_id` | uuid, FK | |
| `name` | text | |
| `name_i18n` | jsonb, nullable | non-default locales, per the Localized content convention |
| `description` | text, nullable | optional long text, shown on the public site |
| `description_i18n` | jsonb, nullable | |
| `duration_minutes` | int | |
| `price` | numeric | current price; appointments snapshot this at booking time |
| `price_from` | boolean, default false | R520: `price` is a starting price ("from 15 ₾") |
| `category_id` | uuid, FK, nullable | R510: null = uncategorized; set null when the category is deleted |
| `position` | int, default 0 | R510: order within its category |
| `is_active` | boolean, default true | R60/R70: deactivated, never deleted, once it has history |
| `created_at` | timestamptz | |

### ServiceCategory
R510: how a salon groups its price list.

| column | type | notes |
|---|---|---|
| `id` | uuid, PK | |
| `tenant_id` | uuid, FK | |
| `name` | text | |
| `name_i18n` | jsonb, nullable | non-default locales, per the Localized content convention |
| `position` | int, default 0 | order of the categories |
| `created_at` | timestamptz | |

### ServiceProfessional (join table)
| column | type | notes |
|---|---|---|
| `service_id` | uuid, FK | |
| `professional_id` | uuid, FK | |
| `tenant_id` | uuid, FK | denormalized for RLS simplicity |

Composite PK on (`service_id`, `professional_id`).

### BusinessHours
| column            | type               | notes                      |
| ----------------- | ------------------ | -------------------------- |
| `id`              | uuid, PK           |                            |
| `tenant_id`       | uuid, FK           |                            |
| `professional_id` | uuid, FK, nullable | null = applies tenant-wide |
| `day_of_week`     | smallint           | 0–6                        |
| `start_time`      | time               |                            |
| `end_time`        | time               |                            |
| `is_day_off`      | boolean, default false | R460: the professional doesn't work this weekday. Only on a professional's row (`professional_id` set); its times are stored as 00:00–00:00, so it carries no working window |

### TimeOff
| column | type | notes |
|---|---|---|
| `id` | uuid, PK | |
| `tenant_id` | uuid, FK | |
| `professional_id` | uuid, FK, nullable | null = whole business closed |
| `start_at` | timestamptz | |
| `end_at` | timestamptz | |
| `reason` | text, nullable | e.g. "vacation", "holiday" |

### Appointment
| column                    | type                   | notes                                                                                   |
| ------------------------- | ---------------------- | --------------------------------------------------------------------------------------- |
| `id`                      | uuid, PK               |                                                                                         |
| `tenant_id`               | uuid, FK               |                                                                                         |
| `professional_id`         | uuid, FK, nullable     | null = "any available" was chosen                                                       |
| `location_id`             | uuid, FK, nullable     | R150: the branch booked. null = the tenant has no locations. **Restrict** on delete — deleting a branch must not erase where past appointments happened, which is why locations deactivate instead (R190) |
| `user_name`               | text                   |                                                                                         |
| `phone_number`            | text                   |                                                                                         |
| `email`                   | text                   | legacy: no longer collected (R270); kept for history, written as an empty string |
| `start_at`                | timestamptz            |                                                                                         |
| `end_at`                  | timestamptz            | derived from `start_at` + the summed durations of its `AppointmentService` rows at booking time, stored for query simplicity |
| `price`                   | numeric                | sum of its `AppointmentService` prices, each snapshotted when that service was added    |
| `status`                  | text                   | `booked` \| `cancelled` \| `completed` \| `no_show`                                     |
| `visit_id`                | uuid, FK, nullable     | R200: the customer visit this segment belongs to. null = a staff-created booking (R70: no link). **Restrict** on delete |
| `created_at`              | timestamptz            |                                                                                         |
| `updated_at`              | timestamptz            |                                                                                         |

### Visit
A customer booking from the public site (R200). It owns the magic link and groups the
appointments — one per professional segment — that the customer sees as one booking.
Contact details stay on each `Appointment` (identical across a visit's segments), so
the CMS reads an appointment exactly as before; the visit adds only what is per-booking.

| column | type | notes |
|---|---|---|
| `id` | uuid, PK | |
| `tenant_id` | uuid, FK | |
| `access_token_hash` | text, unique, nullable | null once cancelled |
| `access_token_expires_at` | timestamptz, nullable | end of the last segment + 24h |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

A visit's status is derived, not stored: cancelled when every segment is cancelled, otherwise
the status of its segments. Staff-created bookings have no visit — they never had a link (R70).

**Planning a visit.** Segments run in the customer's order. Each service needs a professional
who performs it (and works at the chosen location, R180), is inside their own hours, and is
free. Between one segment's end and the next one's start the gap is 0 to
`max_visit_gap_minutes`, smallest first; the same professional is preferred for consecutive
segments, so a one-person booking is still one appointment. Otherwise "any professional" goes to
the least-booked qualified professional that day, as a share of their working time (R450). A
visit never spans midnight.

### SlotHold
A customer's claim on the time they just picked, while they type their details and verify
their phone (R250). One row per segment of the planned visit; the segments of one hold share
a `hold_id`, which is what the browser keeps and sends back with the booking.

| column | type | notes |
|---|---|---|
| `id` | uuid, PK | |
| `tenant_id` | uuid, FK | |
| `hold_id` | uuid | groups one hold's segments. Random, and known only to the browser that took it — it lets that browser replace, release or book against its own hold |
| `professional_id` | uuid, FK | always set: public segments always have a professional (R240). Cascade on delete |
| `start_at` | timestamptz | |
| `end_at` | timestamptz | |
| `expires_at` | timestamptz | creation + 10 min. Rows past it are ignored everywhere, so nothing has to delete them on time; they are swept opportunistically when the next hold is taken |
| `created_at` | timestamptz | |

A live hold is busy time to availability, to visit planning and to the CMS conflict check,
except to the booking that presents its own `hold_id`. Booking converts the hold: its rows
are deleted in the same transaction that writes the visit.

Hold creation is limited per visitor (by IP, forwarded by the public site's server) and per
tenant (a cap on live holds), so nobody can freeze a calendar by clicking through times.
Hitting a limit just means no hold: the customer can still book, and the booking re-checks.

**Concurrency (R260).** Availability is computed, so a check-then-write could pass twice for
two requests arriving together. Each booking write takes a Postgres transaction-scoped
advisory lock on (tenant, local date) *before* it checks, then writes in the same transaction:
the second request waits for the first to commit, then sees its rows. A per-day lock rather
than a per-professional one, because "any available" plans can land on anyone; at salon
volumes a day's bookings queueing for a few milliseconds is invisible. Not a database
exclusion constraint, because R60 lets staff overlap appointments on purpose.

### AppointmentService (join table)
The services one appointment covers — one or more, per "User can choose one or more
services" in the requirements above. They run as a single contiguous block with one
professional, which is what lets `Appointment` keep a single `professional_id`,
`start_at` and `end_at`.

| column | type | notes |
|---|---|---|
| `id` | uuid, PK | surrogate rather than a composite PK, so allowing the same service twice later is a validation change rather than a migration |
| `tenant_id` | uuid, FK | denormalized for RLS simplicity |
| `appointment_id` | uuid, FK | cascade on delete |
| `service_id` | uuid, FK | **restrict** on delete — the database-level backstop behind the "service has history" 409 |
| `position` | smallint | order the services were chosen in; unique per appointment |
| `duration_minutes` | int | snapshot of `Service.duration_minutes` when this service was added |
| `price` | numeric | snapshot of `Service.price` when this service was added |
| `price_from` | boolean, default false | R520: snapshot of `Service.price_from` — the price was a starting price |

Note that `Appointment` therefore has no database-level guarantee of at least one
service — a join table can't express "≥1 row" without a deferred constraint
trigger. That invariant is the booking service's to keep.

### Subscription
One per tenant (R470/R480). Its status is derived from these facts (`billing/subscription-status.ts`), never stored.

| column | type | notes |
|---|---|---|
| `id` | uuid, PK | |
| `tenant_id` | uuid, FK, unique | |
| `plan_id` | text, FK → `subscription_plan` | the plan of the current (or last) paid month |
| `next_plan_id` | text, nullable | a switch waiting for the next renewal |
| `trial_ends_at` | timestamptz | |
| `paid_through` | timestamptz, nullable | end of the last paid month; null = never paid |
| `cancel_at_period_end` | boolean, default false | the owner cancelled: no renewal at `paid_through` |
| `free` | boolean, default false | granted by the platform admin (R430): never charged, never paused |
| `rectoken` | text, nullable | Flitt's token for the saved card — useless without the platform's merchant key |
| `card_masked` | text, nullable | e.g. `444455XXXXXX1111`, as Flitt returns it |
| `card_brand` | text, nullable | |
| `failed_attempts` | integer, default 0 | renewals failed since the last success |
| `retry_at` | timestamptz, nullable | earliest next renewal attempt; also a short lease while one is in flight |
| `created_at`, `updated_at` | timestamptz | |

### SubscriptionPlan
The plans (R470), edited by the platform admin (R550). Platform-wide: no `tenant_id`, no RLS — every salon reads the same rows, and nothing in them belongs to a salon.

| column | type | notes |
|---|---|---|
| `id` | text, PK | `early` / `early_pro` / `standard` / `pro`; referenced by `subscription.plan_id`, `subscription.next_plan_id` and `subscription_payment.plan_id` (restrict on delete) |
| `price` | numeric(10,2) | GEL per month, > 0 |
| `sms_included` | integer | texts per billing month (R500), ≥ 0 |
| `max_locations` | integer, nullable | active locations allowed (R540); null = no limit |
| `priority_support` | boolean | |
| `offered` | boolean | an owner can choose it now |
| `position` | integer | order on the subscription page |
| `updated_at` | timestamptz | |

### SmsMessage
One row per text the SMS provider accepted (R500) — the usage count, nothing more: no phone number, no text.

| column | type | notes |
|---|---|---|
| `id` | uuid, PK | |
| `tenant_id` | uuid, FK | |
| `kind` | text | `otp` (booking code) or `manage_link` |
| `parts` | integer | SMS parts billed |
| `sent_at` | timestamptz | |

### SubscriptionPayment
Every payment attempt (R470) — the invoices.

| column | type | notes |
|---|---|---|
| `id` | uuid, PK | |
| `tenant_id` | uuid, FK | |
| `order_id` | text, unique | sent to Flitt; `<tenant id>.<kind>.<suffix>`, so a callback names its tenant |
| `kind` | text | `signup` (paid on Flitt's page), `renewal` (saved card), `card` (verification, refunded) |
| `plan_id` | text, nullable | the plan paid for; null for `card` |
| `amount` | numeric(10,2) | GEL |
| `period_start`, `period_end` | timestamptz, nullable | the month paid for; null for `card` |
| `status` | text | `pending`, `approved`, `declined`, `expired` |
| `flitt_payment_id` | text, nullable | |
| `card_masked` | text, nullable | |
| `failure_reason` | text, nullable | Flitt's response description on a decline |
| `extra_texts` | integer, default 0 | R500: texts beyond the allowance in the month before `period_start`, charged with this renewal |
| `extra_texts_amount` | numeric(10,2), default 0 | their price (0.07 GEL each), included in `amount` |
| `extra_texts_from` | timestamptz, nullable | start of the month they were counted in (it ends at `period_start`) |
| `created_at`, `settled_at` | timestamptz | |

## ER Diagram

```mermaid
erDiagram
    TENANT ||--o{ LOCATION : has
    TENANT ||--o{ PROFESSIONAL : has
    TENANT ||--o{ TENANT_USER : has
    TENANT ||--o{ SERVICE : has
    TENANT ||--o{ BUSINESS_HOURS : has
    TENANT ||--o{ TIME_OFF : has
    TENANT ||--o{ APPOINTMENT : has
    TENANT ||--o{ APPOINTMENT_SERVICE : has
    TENANT ||--o{ VISIT : has
    VISIT ||--o{ APPOINTMENT : "segments (R200)"
    TENANT ||--o{ SLOT_HOLD : has

    LOCATION ||--o{ PROFESSIONAL : "based at (optional)"
    LOCATION ||--o{ APPOINTMENT : "booked at (optional)"

    PROFESSIONAL ||--o| TENANT_USER : "logs in as (optional)"
    PROFESSIONAL ||--o{ SERVICE_PROFESSIONAL : performs
    PROFESSIONAL ||--o{ BUSINESS_HOURS : "scoped to (optional)"
    PROFESSIONAL ||--o{ TIME_OFF : "scoped to (optional)"
    PROFESSIONAL ||--o{ APPOINTMENT : "booked with (optional)"
    PROFESSIONAL ||--o{ SLOT_HOLD : "held for (R250)"

    SERVICE ||--o{ SERVICE_PROFESSIONAL : "offered by"
    SERVICE ||--o{ APPOINTMENT_SERVICE : "booked as"
    APPOINTMENT ||--o{ APPOINTMENT_SERVICE : covers

    TENANT {
        uuid id PK
        text name
        text timezone
        text subdomain
        text custom_domain
        timestamptz domain_verified_at
        jsonb config_json
        smallint max_visit_gap_minutes
        timestamptz created_at
    }

    VISIT {
        uuid id PK
        uuid tenant_id FK
        text access_token_hash
        timestamptz access_token_expires_at
        timestamptz created_at
        timestamptz updated_at
    }

    SLOT_HOLD {
        uuid id PK
        uuid tenant_id FK
        uuid hold_id
        uuid professional_id FK
        timestamptz start_at
        timestamptz end_at
        timestamptz expires_at
        timestamptz created_at
    }

    LOCATION {
        uuid id PK
        uuid tenant_id FK
        text name
        jsonb name_i18n
        text address_line
        jsonb address_line_i18n
        text city
        text phone
        numeric latitude
        numeric longitude
        smallint position
        boolean is_active
        timestamptz created_at
    }

    PROFESSIONAL {
        uuid id PK
        uuid tenant_id FK
        uuid location_id FK
        text name
        jsonb name_i18n
        timestamptz created_at
    }

    TENANT_USER {
        uuid id PK
        uuid tenant_id FK
        uuid professional_id FK
        text email
        text password_hash
        text role
        boolean is_active
        timestamptz created_at
        timestamptz last_login_at
    }

    SERVICE {
        uuid id PK
        uuid tenant_id FK
        text name
        jsonb name_i18n
        text description
        jsonb description_i18n
        int duration_minutes
        numeric price
        boolean is_active
        timestamptz created_at
    }

    SERVICE_PROFESSIONAL {
        uuid service_id FK
        uuid professional_id FK
        uuid tenant_id FK
    }

    BUSINESS_HOURS {
        uuid id PK
        uuid tenant_id FK
        uuid professional_id FK
        smallint day_of_week
        time start_time
        time end_time
    }

    TIME_OFF {
        uuid id PK
        uuid tenant_id FK
        uuid professional_id FK
        timestamptz start_at
        timestamptz end_at
        text reason
    }

    APPOINTMENT {
        uuid id PK
        uuid tenant_id FK
        uuid professional_id FK
        uuid location_id FK
        text user_name
        text phone_number
        text email
        timestamptz start_at
        timestamptz end_at
        numeric price
        text status
        uuid visit_id FK
        timestamptz created_at
        timestamptz updated_at
    }

    APPOINTMENT_SERVICE {
        uuid id PK
        uuid tenant_id FK
        uuid appointment_id FK
        uuid service_id FK
        smallint position
        int duration_minutes
        numeric price
    }
```

Notes: `PROFESSIONAL ||--o| TENANT_USER` is optional in both directions — a `Professional` may have no login, and a `TENANT_USER` with role `owner` has no `professional_id`. Nullable `professional_id` on `BUSINESS_HOURS`, `TIME_OFF`, and `APPOINTMENT` means "applies tenant-wide" / "any available," per the notes in the tables above. Nullable `location_id` reads the same way: on `PROFESSIONAL` it means "works at every location" (R180), and on `APPOINTMENT` it means the tenant has no locations to pick from.

## Read/Write Pattern

- **Client-side app**: read-heavy, ~10:1. Reads: services, professionals, computed availability, tenant config. Writes: create appointment, reschedule/cancel via magic link.
- **Tenant-side app (CMS)**: read-heavy, ~5:1. Reads: services, professionals, hours, time-off, appointments, config. Writes: edit services/professionals/hours/config, create/edit/cancel appointments, create/remove time-off blocks.

## Capacity Estimates

Assumptions (order-of-magnitude, adjust once real pilot data exists): 5 professionals/tenant, 15 services/tenant, 25 booked appointments/tenant/day, 10:1 read:write ratio on the public site (established above), traffic concentrated in a ~12h operating window with peak load ~5x the daily average, ~15–20% of tenants adopt a custom domain, 3-year appointment retention for history/reporting.

| metric | 500 tenants | 10,000 tenants | 100,000 tenants |
|---|---|---|---|
| Professionals | 2,500 | 50,000 | 500,000 |
| Services | 7,500 | 150,000 | 1,500,000 |
| Appointments/day | 12,500 | 250,000 | 2,500,000 |
| Appointment rows after 3 years | ~14M | ~275M | ~2.75B |
| Public-site reads/day | ~125K | ~2.5M | ~25M |
| Avg req/s (12h window) | ~3 | ~58 | ~580 |
| Peak req/s (~5x avg) | ~15 | ~290 | ~2,900 |
| Custom domains (~15–20%) | ~75–100 | ~1,500–2,000 | ~15,000–20,000 |

**500 tenants** — everything from earlier answers holds as-is: one Postgres primary, one Redis instance, a couple of app-server replicas for uptime rather than load. 14M appointment rows over 3 years is trivial with a `(tenant_id, start_at)` index — no partitioning, no read replica, no connection pooler needed yet. Custom domains (under ~100) are cheap to onboard by hand via your host's dashboard, consistent with the "onboard pilot tenants manually" approach in your project scope.

**10,000 tenants** — this is where a few things stop being optional. Peak ~290 req/s means the public site needs to actually scale horizontally (multiple app instances behind a load balancer), and at that point Postgres' default connection limits get exceeded by pooled connections from every app replica — add PgBouncer (transaction-pooling mode) in front of Postgres. A read replica becomes worth it to keep CMS/reporting reads off the primary that's serving latency-sensitive public traffic. 275M appointment rows is still fine on one well-indexed table, but start planning partitioning (by month) before it becomes urgent. Custom domains in the 1,500–2,000 range outgrow manual dashboard onboarding — this is the point to build (or buy, via Cloudflare for SaaS / Vercel Domains API) automated verification + certificate issuance, since hand-verifying DNS TXT records one tenant at a time doesn't scale past a few hundred.

**100,000 tenants** — raw data volume, not the multi-tenancy model, becomes the constraint. ~2.75B appointment rows in a single unpartitioned table will fight you on vacuum, index bloat, and query planning — partition by month (and likely sub-partition by `tenant_id` hash) so RLS filtering and partition pruning work together instead of against each other. At ~2,900 req/s peak you need a real caching layer for availability computation (not just domain resolution) and a Redis deployment that's itself highly available — a Redis outage here takes tenant resolution down for 100K businesses at once, not one. Depending on write concentration, a single Postgres primary may still hold if well-tuned, but this is the scale at which sharding tenants across multiple Postgres clusters (routed by `tenant_id`) starts being a legitimate conversation rather than premature optimization. 15,000–20,000 custom domains needs the automated domain lifecycle from the 10K stage to also handle renewal monitoring and cleanup for churned tenants, not just initial issuance.

The shared-tables-plus-RLS decision itself doesn't need revisiting at any of these scales — what changes is the amount of *operational* scaffolding (pooling, replicas, partitioning, sharding) layered on top of it as row counts and QPS grow.

## Still Open

**Resolved:** this document required "User can choose one or more services" while its
own data model gave `Appointment` a single `service_id`. The `AppointmentService` join
table above settles it in favour of the requirement. Availability already worked this
way — it has always taken a list of service ids and summed their durations — so only
persistence and the CMS contract changed.

Still open:

- ~~**Per-line professional.**~~ **Resolved by R200–R240:** a booking that needs several
  professionals is a `Visit` of ordinary single-professional appointments rather than one
  appointment with per-line professionals. That keeps R20 meaning what it did (each
  professional owns their segment), lets conflicts and statuses stay per appointment, and
  reuses the single-professional availability check per segment.
- **Same service twice on one appointment.** Rejected with a 400 for now rather than
  modelled as a quantity; the surrogate PK means allowing it later is a validation
  change, not a migration.
- **One professional split across branches.** `Professional.location_id` is singular, so a
  stylist working mornings in Vake and afternoons in Saburtalo can't be modelled — today they
  are either at one branch or (with a null) at all of them, with one set of hours either way.
  The fix is a `ProfessionalLocation` join table plus a `location_id` on `BusinessHours`, which
  is additive: nothing about the singular column has to be unpicked first.
- **Locale-specific URLs.** Language is a cookie, not a path segment, so a tenant's Georgian and
  English content share one URL and search engines only ever see the default locale. Moving to
  `/ka/…` later is a routing change on the public site plus `hreflang` tags; nothing in the data
  model assumes either shape.
