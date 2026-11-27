# GeoZentra design system

The source of truth for colour, type, spacing, components and layout in the property client
(CLAUDE.md: "Follow DESIGN.md"). Decided on Nov 18, 2026 from the design audit:

- **Base:** Direction A (navy and copper, tables first), DM Sans only.
- **Missing values:** the final unavailable marker (hatched cell), plus Direction B's ruled sections on data-heavy screens.
- **Layout:** the Desk.
  - Pro screens get a labelled rail, a register and a docked record pane.
  - Guests and buyers get a search-first top bar.
- **Maps:** the map sits beside the list only on Explore and comparables.

Evidence and specimens are in `design-audit/` (§18). Every figure in the specimens comes from the mock
fixtures.

---

## 1. Principles

1. **Show the record as it is.** Every screen shows what the county record and the backend return, and says plainly what is missing. Nothing is invented, and nothing missing is shown as zero.
2. **Tables for work, records for reading.** Lists are real tables. A single record is ruled sections, like a property card.
3. **One signature element.** The ZentraValue block (§9) is the memorable thing. Everything around it stays quiet.
4. **Colour has fixed jobs:**
   - Copper means action or selection.
   - Hatch means missing.
   - Navy is the frame.
   - Positive, negative and attention colour words, never stand in for them.
5. **Motion only answers an action**, a page change or a chart drawing in (§4). Under reduced motion nothing moves.

---

## 2. Colour

Tokens live in `:root` in `src/styles.css`. Components use tokens, never raw hex values. This
replaces the 136 ad-hoc values the audit found.

| Token | Hex | Use | Contrast |
|---|---|---|---|
| `--ink` | `#172735` | Text, headings, table figures, recorded-data marks | 15.24:1 on white |
| `--ink-2` | `#4E6170` | Secondary text, captions, labels, axis text. **Replaces `--muted` `#77818B` and the old `--ink-2` `#526773`.** | 6.43:1 on white, 5.94:1 on paper |
| `--paper` | `#F5F6F7` | Page background | |
| `--surface` | `#FFFFFF` | Tables, records, panes, top bars | |
| `--rule` | `#E2E7EA` | Row rules, gridlines, section edges | decorative |
| `--rule-strong` | `#C5CED4` | Header rules, pane edge, chart baseline | decorative, never a control boundary |
| `--control` | `#7D8C97` | Borders of inputs, selects, checkboxes and secondary buttons | 3.46:1 (non-text 3:1) |
| `--placeholder` | `#5E6E7B` | Placeholder text | 5.26:1 |
| `--copper` | `#8A5636` | Primary button fill, links, active tab and filter underline, selection mark, focus ring. **Fixes the button: white on it is 6.06:1 (was `#AD724C`, 3.97:1).** | 6.06:1 on white, 5.60:1 on paper |
| `--copper-hover` | `#74462B` | Primary button hover and pressed | 7.91:1 with white |
| `--copper-tint` | `#F4ECE6` | Selected row background | ink-2 on it 5.50:1, copper on it 5.19:1 |
| `--copper-band` | `#E6D3C5` | The ZentraValue 80% range band | decorative |
| `--navy` | `#172735` | Rail, brand tile (same value as ink) | |
| `--navy-2` | `#22384A` | Active rail item | white on it 12.12:1 |
| `--rail-ink` | `#C3CCD2` | Rail labels and icons | 9.35:1 on navy |
| `--copper-mark` | `#D39A73` | **On navy only:** brand glyph, active-rail bar, focus ring inside the rail. Never on white. | 6.27:1 on navy |
| `--positive` | `#23695B` | Funded, approved, income | 6.48:1 |
| `--negative` | `#A63E32` | Rejected, losses, errors | 6.26:1 |
| `--attention` | `#8C4F17` | Low confidence, limited estimate, overdue, "Partial:" | 6.47:1 |
| `--hatch-line` | `#D9E0E5` | The unavailable hatch (§6) | ink-2 crossing a line: 4.82:1 |

Rules:

- **State colours sit next to a word** (Funded, Rejected, Low confidence), never alone. State is text colour, not tinted chips.
- **No gradients, glass, glow or neon.** The only repeating pattern is the hatch. The property dialog's navy gradient card and the three-stop range track are removed. **One exception** (asked for on Nov 22, 2026): the route progress line (§4) is a horizontal gradient in the app's two colours, `--copper-mark` 0 %, `--copper` 55 %, `--navy-2` 100 %, as angular.dev's bar is one gradient in its brand colours.
- **The Material theme stops compiling azure/blue M3 palettes.** Dialog system colours map to these tokens.
- **The favourite heart uses `--copper`** (filled when saved), not `#D73550`.
- **Light mode only.** Dark mode is out of scope; tokens are named by role so it can be added later.

Chart and map colours are in §10 and §11.

---

## 3. Type

**DM Sans only.** Load a single latin file, 36.1 kB, which is 24 kB less than today. Manrope comes out of
the `index.html` link:

`https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap`

Weights:
- 400 for body.
- 500 for labels, active nav and emphasis.
- 600 for headings and figures.
- 700 is unused.

Eight sizes, nothing else. 12 px is the minimum anywhere; the 9–11 px labels go.

| Size / line height | Role |
|---|---|
| 12 / 16 | Captions, second lines in table rows, axis ticks, legends, bottom-bar labels, map attribution |
| 13 / 16–18 | Table cells and headers, record labels and values, row actions, rail labels |
| 14 / 20 | Body, buttons, inputs |
| 16 / 22 | Section headings (h2 in records), top-bar links, the top-bar search, account menu and More sheet items |
| 20 / 26 | Record-pane title, phone h1, brand name |
| 24 / 30 | Page h1 (pro pages, Explore), summary-strip figures |
| 32 / 38 | Property page h1, ZentraValue figure in panes |
| 40 / 44 | ZentraValue figure on the property page |

- **Numerals:**
  - `font-variant-numeric: tabular-nums lining-nums` wherever numbers align vertically: table columns, axis ticks, ranges, ruled record values.
  - Proportional figures for standalone numbers: the ZentraValue figure and summary-strip figures.
- **Case:** sentence case everywhere. No uppercase tracked labels, no eyebrows, no letter-spacing on small text.
- **Tracking:** headings use −0.015em at 24 px and −0.02em at 32 px and above.
- **Line length:** prose (notes, help text, empty states) stays at 80 characters or fewer.

---

## 4. Spacing, radius, elevation, motion, layers

- **Spacing** runs on a 4 px base: 4, 8, 12, 16, 24, 32, 48, 64.
  - Page gutters: 32 px in the public shell, 24 px in pro registers, 14–16 px on phones.
  - Table cells: 8 px vertical, 10 px horizontal, giving rows of about 34–36 px. Record rows have a minimum height of 34 px.
- **Radius:**
  - **0** for tables, record sections, panes, sheets, the map slot, the rail and map labels.
  - **4 px** for controls (buttons, inputs, selects, segmented controls), menus and the brand tile.
  - **50%** for avatars and map markers.
  - Nothing else; this replaces the audit's 20 values.
- **Elevation:**
  - Content has no shadows.
  - Floating menus (notifications, select menus) get one shadow, `0 6px 20px rgba(23,39,53,.14)`, plus a 1 px `--rule-strong` border.
  - Panes and sheets are separated by a rule. Modal layers sit behind a scrim.
- **Motion:**
  - 120 ms for colour changes on hover and press.
  - 180 ms ease-out (transform only) to open or close a pane or sheet.
  - Added on Nov 22, 2026, at the user's request:
    - **Route progress:** a 3 px line on the very top edge (`gz-route-progress`, z-index 70) while the next page loads, as on angular.dev. It shows for navigations longer than 30 ms (angular.dev's threshold), creeps towards 90 %, fills and fades in 450 ms when the page is ready. One still gradient, copper into navy (§2). Under reduced motion it is a still, full-width line.
    - **Page change:** the page area cross-fades (old page out in 90 ms, new page in 200 ms with a 4 px rise) through the router's view transitions. The bars and the rail keep still. A change of query parameters only (filters, tabs, paging) doesn't animate. The page area gets its `view-transition-name` only while the transition runs (`.page-changing` on `<html>`): a named element is a stacking context, and a lasting one held the record sheet under the scrim at 1024–1359 px, so nothing in it could be clicked. Don't give `main` or a page wrapper anything that makes a stacking context (a lasting transform, filter, opacity animation with a fill mode, `isolation`, `contain`).
    - **Chart lines draw in** once, left to right, 700 ms: recorded first, then the model (§11).
    - **Small motion:** menus drop in (140 ms, 4 px and 98 % scale from the top right), the phone More sheet rises (200 ms, 16 px), toasts slide up and fade (200 ms), tab content fades in (160 ms, opacity only), the active tab's underline fades (160 ms), and buttons press in by 1 px (80 ms). Opacity and transform only.
  - Nothing else. The motion section of `styles.css` (lines 1859–2094) goes: staggered card entrances, the conic ring, button lift, sliding icons.
  - Under `prefers-reduced-motion: reduce`, changes are instant. That includes motion started by script, which the CSS rule can't stop: a scroll asked for with `behavior: 'smooth'` checks the setting (pagination), and the maps jump instead of gliding (Explore, the Comparables map and, since item 9, the parcel search's Leaflet flags and moves).
- **Layers:** z-index runs in this order:
  - Content 0, sticky table header 2, sticky tabs 20, top bar and rail 30.
  - The sheet at 1024–1359 px 40, the scrim 45, dialogs 50, menus 55, toasts 60.
  - **There is one scrim, at shell level. It covers the rail, the top bar and the content** (this fixes bug 2 in §14).
- **Controls:**
  - `--control-h` 36 px (was 40) and `--control-h-sm` 30 px; 44 px on `(pointer: coarse)`.
  - Navigation is larger than page controls (changed Nov 19, 2026, after review: the first build felt small): `--nav-btn` 40 px for top-bar buttons and the search field (44 px on `(pointer: coarse)`), `--nav-icon` 24 px for rail, bottom-bar, More-sheet and top-bar icons, `--nav-text` 16 px, `--nav-label` 13 px. Content icons stay 20 px.
  - The shared `:where()` field rules and the `.ng-touched` invalid state stay as they are (HANDOFF). Only token values change.
- **Focus:**
  - A 2 px solid `--copper` outline with a 2 px offset on every interactive element; inside the rail, `--copper-mark`.
  - Never removed.

---

## 5. App layout: the Desk

Specimens: [desk](design-audit/screenshots/layouts/desk.png),
[desk at 390](design-audit/screenshots/layouts/desk-390.png),
[record at 390](design-audit/screenshots/layouts/desk-390-record.png),
[public property](design-audit/screenshots/layouts/public-property.png),
[public property, guest, 390](design-audit/screenshots/layouts/public-property-guest-390.png),
[Explore with docked map](design-audit/screenshots/layouts/explore-docked-map.png).

### Account types and shells (backend SCRUM-204, Nov 26, 2026)

The account type is the user's Keycloak realm role: **investor**, **realtor** or **lender**, at most one per
account; none is a **home buyer**. It is read from `GET /api/users/me/entitlements` (after every sign-in and
every token refresh), never chosen in a select: the user requests a role and an administrator approves it.
`persona` no longer exists anywhere in the frontend.

| Shell | Who | Frame |
|---|---|---|
| **Public** | Guests, and home buyers (no professional feature) | Search-first top bar, no rail |
| **Pro** | Any account with `features.investment`, `realtorCrm`, `lender` or `administration` | Navy rail and a work top bar |

- **Nothing is taken away:** every account has the home-buyer pages. A professional feature adds one rail
  section, named over its items: **Investments**, **CRM**, **Lending**; `administration` adds **Admin**. The
  backend gives an admin every feature, so an admin sees every section. Admin is never an account type.
- **Pending role:** the section shows one locked entry (lock icon, "Waiting for approval", not a link); in the
  public top bar it is a locked link-like entry after Alerts. The pending banner sits above every page.
- **Guards:** each area is hidden and blocked by its feature (`featureGuard`); a signed-in account without it
  lands on "No access", which says why. A 403 refreshes the token, re-reads the entitlements and leaves an
  area that is no longer allowed for the home overview.
- **Onboarding:** an account whose entitlements say `onboardingCompleted: false` is sent to `/onboarding`
  first: four choices as ruled rows (Home buyer, Investor, Realtor, Lender), each answering the page.
### Pro shell

```
+----+-------------------------------------------+---------------+
| ~  | Scope v   [Search address or folio]       |       (!)  AU |   top bar 52 px
|Over|-------------------------------------------+---------------|
|Pipe| Applications 22               [Import][New]| record pane   |
|Apps| All 22  Draft 3  Submitted 4 ...           | 420 px        |
|... | table: sticky header, sortable, selection  | ruled sections|
|----|                                            |               |
|Expl|                                            |               |
|Set |                                            |               |
+----+--------------------------------------------+---------------+
 84 px rail
```

**Rail**
- 96 px wide, `--navy`, full height. (The specimen drew 84 px with 20 px icons and 12 px labels; enlarged Nov 19, 2026.)
- At the top, the brand glyph in `--copper-mark` links to Overview, in a cell as tall as the top bar.
- Each item is a 24 px icon with a 13 px label underneath, about 68 px tall (60 px on screens under 820 px high).
  - Labels fit on one line.
  - Nothing relies on a tooltip.
  - The active item gets `--navy-2`, a 3 px `--copper-mark` bar on the left edge and a white label.
- A 56 px rule separates the groups. Settings is pinned at the bottom.
- The rail has no hide toggle. It replaces the sidebar, its "YOUR WORKSPACE" label, the footer slogan and the drawer.

Rail sections by feature:

| Section | Feature | Items | Notes |
|---|---|---|---|
| (home, no name) | every account | Overview, Explore, For you, Compare, Studio, Saved, Alerts | Studio's Rental tab and Opportunities' Top scored tab appear only with `investment` |
| Investments | `investment` | Overview (`/dashboard/investments`), Portfolio | The property page's opportunity score also needs `investment` |
| CRM | `realtorCrm` | Overview (`/dashboard/crm`), Clients, Leads, Tasks, Deals | The existing `crm/:tab` routes |
| Lending | `lender` | Overview (`/dashboard/lending`), Pipeline, Applications, Import, Team | Pipeline to Team are the loan-review tabs (`?tab=`) |
| Admin | `administration` | Import jobs, Data quality, Valuations, Role requests, Licenses, Users | Users (`/admin/users`) finds an account by its email or name and opens its Role history (`/admin/users/:id`), which the queues also link to; the search stays at the top of Role history. From 2 characters, after a 250 ms pause, the field lists up to 10 accounts whose email, full name or last name starts with the text (name, then email and User ID); arrows and Enter pick one. Find with a full email looks it up exactly; with other text it opens the only match, or asks for a pick |

Phones (pro): the bottom bar leads with the account's own area (up to three items), then Explore; the rest is
in More.
**Top bar** (60 px, white, with a rule under it):
- On the left, the scope switcher where the area has one: the lender organization or the investor portfolio.
- Search for an address or folio, 360 px wide and 40 px high, 16 px text.
- Notifications (a 40 px button with a 24 px icon).
- The avatar menu (36 px avatar): Settings and Sign out, in 44 px rows with 16 px text.
- The "Workspace / Title" breadcrumb goes, because it repeats the h1.

### Public shell

```
+-------------------------------------------------------------------------------+
| [~] GeoZentra  [Search address or folio]  Explore Opportunities Compare Studio |
|                                           Saved Alerts         (!) AU | Sign in|
+-------------------------------------------------------------------------------+
| page in a 12-column frame, max 1200 px, aligned with the brand                  |
```

- **Top bar:** 64 px, white, sticky.
  - The brand tile (32 px) is navy with a copper-mark glyph, followed by "GeoZentra" at 20 px.
  - Search comes first, 360 px wide and 40 px high (240 px under 1360 px wide, 180 px under 1024).
  - Links at 16 px, 28 px apart: Explore, Opportunities, Compare, then Studio, Saved and Alerts when signed in. The current link is ink with a 2 px copper underline. Under 1024 px they scroll sideways with an edge fade.
  - On the right, notifications and the avatar for buyers, or "Sign in" and "Create account" for guests.
- **Guests and property data (decided Nov 26, 2026).** The backend answers 401 to every property, location, parcel, map and comparison read without an account (SecurityConfig, SCRUM-94). So a guest gets no search in the top bar, and Explore, Parcel search, a property page and Compare show `gz-sign-in-prompt` instead of their content: one heading (the page's h1 where the page has none of its own), one sentence of what signing in gives, Sign in and Create account. Nothing is requested for a guest. If the backend opens these reads to guests, these pages and the top-bar search go back to public.
- **No rail and no footer.** The assistant link stays hidden until the assistant ships; today it carries a "Soon" tag.

### Start-up

What shows before the app is usable (index.html before Angular, the wait for the sign-in check, then
the first page's code):
- **A small centred logo on a plain background.** The logo is the public top bar's brand: the 32 px navy
  tile with the copper-mark glyph and "GeoZentra" at 20 px/600, on `--paper`. Under it, centred as one
  group, a 160 × 3 px progress line (the in-app loading line's gradient, copper-mark → copper → navy-2,
  sliding on `--rule`) and "Opening GeoZentra…" in ink-2. Same screen for every account.
- **It stays until the first page has drawn, then fades out (200 ms)** onto the complete page: never the
  top bar over an empty page while the page's code still loads. The splash sits over the app
  (`#gz-boot`, outside `<app-root>`), the app is `inert` under it, and `core/boot-splash.ts` takes it
  away after the first NavigationEnd (or NavigationError) has rendered, or after 6 s at most.
- **A fast start doesn't flash it:** its contents fade in after 120 ms.
- **No colour flash:** index.html carries its own copies of the token values it uses (paper, ink, ink-2,
  rule, copper, navy, copper-mark), because the stylesheet and the font may still be loading. The app's
  page background is the same `--paper`.
- **Reduced motion:** nothing moves or fades; the progress line stands still and the splash goes at once.
- **Slow start-up:** after 8 seconds, one quiet line under the logo: "Taking longer than usual. Reload"
  (Reload reloads the page). A timer shows it, not a CSS animation, so it also appears under reduced
  motion.
- Not the shell's frame: item 0 drew the rail and top bar during start-up; that was reverted on Nov 19,
  2026 after review.

### Breakpoints

| Name | Width |
|---|---|
| Desktop | ≥ 1360 px |
| Laptop | 1024–1359 px |
| Tablet | 701–1023 px |
| Phone | ≤ 700 px (390 px is the reference) |

### Page frames

1. **Register** (every pro list):
   - **Size:** fluid, with 24 px gutters and no max width.
   - **Header:** h1 with the count, filters or stage links underneath, actions on the right ("New …", Import).
   - **Opening a row** puts the record in the docked pane (in the public shell the page drops its 1200 px measure while a pane is docked, so the pane meets the window's edge as in the pro shell: item 9):
     - 420 px at desktop width, and the table hides its priority-3 columns.
     - At laptop width, a 420 px sheet over the content with the shell scrim.
     - At tablet width and below, its own page.
   - **Keyboard:** Up and Down move the selection and the pane follows; Enter opens; Esc closes.
   - **Pane:**
     - Header: previous, next and close, then the title, meta and actions.
     - Body: ruled sections.
     - "New …" forms open in the same pane, never above the list.
   - **Saved** (built in item 6, Nov 20, 2026; `features/saved/`): h1 "Saved" and one line; tabs Properties and Searches with their counts, kept in the address (`?view=searches`) and following it.
     - Properties: a table, not cards (the photo-card exception is Explore's only): Property (address link and place; facts and a Remove link as second lines on phones), Beds, Living area, Built, ZentraValue (the existing bulk prediction action once per set of rows, §9 confidence line; one merged Unavailable span with Retry when the values fail), Saved (the viewer's day), Remove. A row opens the property's page; Remove moves focus to the tab first, since its row goes. Newest first; the columns sort within the list, with a note.
     - Searches: Search (name, then its filters in words: "ZIP 33133 · Single family · 3+ beds"; the county by name when the location lists hold it, never its id), Checked, Status, Saved; server pages of 20. A row opens the record pane: Open in Explore and Delete in its header; What it matches; Checking (name, how often, pause, one Save changes that sends only what changed and says why it can't run); Matches today (the search's results: the count and the first 8 as links).
     - Guests: one sentence with Sign in and Create account. Nothing saved: one sentence and Explore properties.
   - **CRM** (built in item 7, Nov 20, 2026; `features/crm/`): the h1 is the list's name (Overview, Clients, Leads, Tasks, Deals: the realtor's rail), the tabs are links to `/crm/:tab` and the page follows the address, filters included (`?stage=` for leads and deals, `?status=` for tasks; `?open=<id>` opens a record, from the overview's activity, and says so when it isn't on the page; `?new=1` opens the New form, from the realtor overview's New task, New lead, New deal and Add a client).
     - Overview: Tasks as a summary strip (Open, In progress, Overdue, Done; each opens Tasks on that status), Deals by stage (`gz-stage-bars`, each stage opens Deals on it), Recent activity as a table (a row opens its record).
     - Lists: stage or status links with the CRM's own counts (deals from the pipeline, tasks from the task summary; leads have none, so no counts); tables of Client (email, phone, added), Lead (client, stage, source, property, changed), Task (due with Overdue in attention, status, client), Deal (client, stage, property, expected close or closed); server pages of 20.
     - The pane: the record's next stages as buttons (the way forward primary; Mark lost / Cancel deal secondary; final stages ask first), Delete for clients and tasks, the details as ruled rows (a client's in one form that sends only what changed), then notes and history. New client, lead, task and deal open their forms in the pane.
     - A client name outside the CRM's 100 newest reads "Unavailable (not among your 100 newest clients)", never "Client 12"; a system source ("WEBSITE") reads in words.
   - **Loan review** (built in item 7): the h1 is the tab's name (Pipeline, Applications, Import, Team: the lender's rail, `?tab=`); the organization select (and Owner or Member) and New application / New organization in the header. No banner on top: "Recording a stage doesn't approve credit or move any funds." sits under the applications and in each record.
     - Pipeline: a summary strip (Applications; Approved and Funded with the approved and funded amounts the pipeline sums, approved including funded) and the stages as bars with counts and requested amounts; a stage opens Applications on it. No sums across stages on the client.
     - Applications: stage links with the pipeline's counts; a table (Applicant with loan type, Stage, Requested, Approved or funded, Property, Changed). The pane: the next stages (Submit, Start review, Approve…, Mark funded…, Reject, Withdraw; Approve and Fund ask for the amount in the record, said back when it is too high; final stages ask first), the application's rows (the import source as a Source field), Collateral with Check LTV and the LTV as the backend works it out.
     - Import: the snapshot form and its result as a strip and a table (Row, Result, Application ID, Reason in words; nothing where nothing applies).
     - Team: members as a table, the names one merged Unavailable span ("The team list sends user IDs only.") beside each user ID, the role, Remove for the owner; Give access by email: the owner types the email the colleague signs in with and presses Find, the account found shows as a ruled row (name, email) with Give access, or "Already has access"; a 404 says no account uses the email and to ask them to sign in once. The confirmation names the person. A member already on the list is still never "User 112" in prose: "the member with user ID 112".
     - No organization: one section to create it.
   - **Alerts** (built in item 6): h1 "Alerts", one line, New alert (primary) in the header.
     - Table: Alert (name, then what it follows: the saved search by name or the property's address), Watches for (with the change that notifies for ZentraValue rules: "Moves 3% or more, up or down"), Checked, Status ("Active", "Paused", "Paused with its search", "Can't run" and "Checks are off" in attention), Last check (the viewer's day, "Not yet"); server pages of 20; "7 alerts · 2 paused" above it.
     - A row opens the record pane: Check now (primary, aria-disabled with the reason beside it: "Listing prices aren't available yet.", "Resume the rule to check it."), Pause or Resume, Delete; Rule (watches for, notifies when, follows, created, then one form for name, how often and the change that notifies); Checks (status in words, last and next check, properties checked, notifications sent, waiting and failed, a failure as a sentence with its code under Details, Refresh).
     - New alert opens its form in the pane (name, watch for, follow, the saved search or property, the change that notifies, how often; Create alert says what is missing); once created, the new rule opens in the pane.
     - No rules: one sentence and New alert. Guests: one sentence with Sign in and Create account.
   - **Admin pages** (built in item 8, Nov 20, 2026; `features/admin/`; realm role `admin`): a guest gets one section with Sign in, a signed-in account without the role one section that says so with Back to overview (`gz-admin-gate`); nothing loads for either.
     - **Import jobs** (the admin landing page): h1 "Import jobs" and one line; Refresh and Import county data (primary) in the header. "12 jobs · 3 queued or running, refreshed every 5 seconds" over a table: Job (what it loads, "Sales", then "CSV import · Miami-Dade, FL · attempt 2"; an image backfill by its number, a county named only by ID as "County ID 17"), Status in words (Failed, Interrupted and Partly completed in attention; the running step under it), Processed (a 96 × 4 px bar and "31,877 of 48,210"), Written, Skipped, Failed, Queued (day and time on the viewer's clock); server pages of 20; polled every 5 s only while a job is queued or running. On phones the Job and Status columns, with "N of M processed · N failed" under the job. The untracked job kinds and the backend's note under the table. No error code in the table.
     - A row opens the job in the pane: Retry (finished ingestion jobs that didn't complete) with "Resumes from the last checkpoint." or the reason it can't run ("Its input files are no longer available."); What went wrong (the message as a sentence, the code and input files under Details); Progress; Job (kind, county, job ID, attempt, Resumes: the earlier job, which opens in the pane); Failed and skipped records ("sales.csv, row 1,200", Failed or Skipped, the reason in words with the message under it; the first 50, then Show all; the server's 1,000 cap said) or, for an image backfill, each property's result. A retried or uploaded job opens in the pane in place of the old one or the form.
     - Import county data opens its form in the pane: what to load (One CSV file, Owners, A county folder) as radios with a line each, county and state, the dataset and files, the backend's rules for the kind, Start import with its reason.
     - **Data quality:** h1 "Data quality" and "Read-only: nothing here changes data."; Refresh. "301 issues across 7 rules · counted at 3:57 PM" (or "No issues: every record passes the 7 rules") over the rules as a table (Rule, Kind, Tables read, Issues; no rule codes). Choosing a rule (click, Enter or the arrow keys; kept in the address as `?rule=`, replacing the entry) lists its issues under the table with the rule as an h2: Issue, Property (the folio, a link), Source (county and state, "Source property ID 1234"; "Not from a county file"), Reference (mono, priority 3); server pages of 20; a rule with no issues says "No record breaks this rule in the latest count."
     - **Valuation operations:** h1 and one line; Refresh. Opportunity scores first: Update missing and stale scores (primary) and Rescore every property… (asks first); while a run is under way both say why they wait; the last run in this session as a summary strip (Scored with "N with a score · N without enough evidence", Removed, Took with the score version). Then Revaluation requests: status links (All, Pending, In progress, Completed, Failed, Cancelled: no counts, the API has none; `?status=`), "16 requests" over a table (Change with the property's address or "Whole market" and the sale ID, Status with the outcome in words or "Last attempt failed", Attempts "2 of 5", Next attempt, Updated); a row opens the pane: Retry (failed source changes; a failed model publication says the valuation worker retries it) and Cancel (pending or failed; asks first), What went wrong with the code under Details, Request and Attempts as ruled rows. A retry moves the pane to the new request.
2. **Record** (reading pages: property, settings, studio, assistant):
   - **Grid:** 12 columns with 24 px gutters; content max 1200 px, aligned left with the shell gutter.
   - **Property page** (built in item 1, Nov 19, 2026; `features/property-detail/`):
     - Header: the address as h1 at 32 px (20 px on phones), then one facts line (city and ZIP, folio, use, neighbourhood). No header actions.
     - Sticky tabs: Overview, Valuation, Location, Sales, Features, Comparables.
     - Then 8 columns of main content and a 4-column sticky ZentraValue aside. The aside holds the page's actions under the ZentraValue: Save, Compare, Open in Studio, then "Ask about this property" (full width).
     - Overview: photos (only when there are some, or while they load or fail), Property facts (`gz-property-facts`: Building, Land, County record, Owners), then Sales and ZentraValue over time with the monthly line from the newest page of published valuations.
     - Sales: the same chart and sales table, then Assessments (`gz-property-assessments`, sortable).
     - Valuation: Forecast (the time chart with the monthly line, the estimate and the 1-, 3- and 5-year fan (7 years on a valuation scored before the 5-year forecast replaced it), plus its table twin), What drives this estimate, Supporting comparable sales, then Opportunity score and Valuation history. Model details are in "Method" disclosures.
     - Under 900 px the record is one column with the ZentraValue under the header (tablets as well as phones: at 4/12 of a tablet the aside is too narrow for the 40 px figure).
   - **Removed from the property page:**
     - The sale-history block above the tabs moves into Overview and Sales.
     - The address shown twice.
     - The contact form on every tab. It becomes one "Ask about this property" button in the aside, which opens the form in a sheet (`gz-sheet`).
     - "Back to results" (the top bar's Explore link goes back to the same results).
   - **Investment studio** (built in item 5, Nov 20, 2026; `features/investment-studio/`):
     - Header: h1 "Investment studio" and one line ("Monthly payments, what you can afford and rental returns, worked out on your own figures."). Opened from a property ("Open in Studio", `/investment-studio/:id`), a line under it names the property with a link back to its record and says to enter one's own price; nothing is filled in from the record.
     - Tabs Mortgage, Affordability, Rental (short enough for 390 px), kept in the address as `?mode=` with `replaceUrl`. All three calculators stay mounted, so switching keeps what was typed.
     - Each calculator: the assumptions (5 of 12 columns) beside the result (7), both white sections under a 2 px ink rule; one column below 1024 px, the result under the form. Fields sit in ruled groups (legend 13 px/600 over a 1 px ink rule; "(optional)" groups say so), two fields a row down to 390 px.
     - The primary button is never `disabled`: it is `aria-disabled` with the reason written beside it ("Enter the price, down payment and rate.", "The down payment can't be more than the price."). A blank field is sent as missing, never as 0.
     - The result leads with one figure (32 px; 28 on phones), its label and a caption, then record groups or a table. When an answer arrives, focus moves to the result's heading (and, stacked, the page scrolls to it).
     - Mortgage: "Each month" cost of the costs entered, the lines (principal and interest, tax, insurance, HOA, total; a cost left blank is Unavailable, "left blank, so the total leaves it out") and the loan amount.
     - Affordability: the highest home price and the loan, the monthly figures, the limits used (housing costs and all debts as shares of income, rate and term, the rate source), the backend's notes and disclaimer in plain words.
     - Rental: cash flow each month (signed, polarity colours) when the loan is known, otherwise net operating income; income and costs as a table by month and year (costs the backend gives by the year leave the monthly cell blank: not applicable, never divided by 12); financing and returns, or one sentence on what to add when there is no financing; "After N years" when a holding period is given; the backend's notes once each. When the form no longer matches the figures the result was calculated from, it says so.
     - Saved scenarios (rental): a full-width section under the calculator with the name field (Save, Save as new, New scenario) and a table: Scenario, Rent a month, Property (a link to the record when one is linked), Changed, Open/Reload and Delete. The scenario in the form is marked "In the form above" with a copper edge. Guests get one sentence and Sign in; no scenarios, one sentence.
     - Not on the overview: "Your home budget" and "Mortgage context" (item 4 removed them) ran the same calculations on inputs typed elsewhere, so the Studio stays the one place for them; the unused `finance-cards.ts` goes in item 9.
   - **Settings** (built in item 8, Nov 20, 2026; `features/settings/`): h1 "Settings" with one line and Sign out in the header. Each part is a white section under a 2 px ink rule: its h2, one line and any status on the left (4 of 12 columns), its form on the right (8); one column below 1024 px. Each form has its own Save, `aria-disabled` with the reason beside it ("Nothing has changed.", "The minimum is more than the maximum."), never a toast for a wrong field; a failed save is said under its button; a form answered again by the store keeps the fields being typed.
     - Profile: first and last name (sent only when changed; a name can be changed, not removed: the update has no way to clear it), the email as a ruled row ("From your sign-in account"), and nothing else. The account type has its own section (Account type): the role held with "To change your account type, contact support", or a pending request with Cancel, or, for a home buyer, Investor, Lender and Realtor (the license form), each approved by an administrator (§5).
     - Property preferences: the budget (minimum, maximum), the counties as ruled rows with Remove ("No counties chosen."), added with the shared state and county picker (Add county says why it can't run), and the goals, one per line. A county without a name reads "Unavailable" with its ID in the reason.
     - Notifications: Tell me about (new matches, contact requests, ZentraValue changes) and Where (the bell, email with the address and how often); "Email isn't switched on for this environment yet…" or the next email's day and time; event types the form doesn't know are sent back as they were.
     - Realtor license (realtors, or anyone with a submission; `#license` scrolls to it): the status on the left; the latest submission as ruled rows; Waiting for review or the rejection as a sentence; the form (prefilled from a rejection; state Florida written, not a one-option select) when none is pending or verified; earlier submissions as a table.
     - Guests: one sentence with Sign in and Create account.
   - **Compare** (built in item 10, Nov 20, 2026; `features/compare/`): h1 "Compare" and one line; tabs Side by side and Comparable sales, kept in the address (`?view=`, replacing the entry) and following it. `/compare/:id` opens the comparable sales of that property (the property page's "Open in Compare") and `?property=` holds one picked on the page; `/compare?ids=12,34` restores and runs a comparison (the compare tray), and from then on `?ids=` follows the selection (added, removed, cleared) without running it, so a reload or a copied link shows what is chosen. Both tabs stay mounted, so switching keeps what was chosen and typed.
     - **Side by side:** a white section under a 2 px ink rule like Settings': "Properties", one line and "3 of 5 chosen" on the left (4 of 12); on the right the chosen properties as ruled rows (the address, a link, and the place; Remove, which moves focus to the next Remove or the heading), the address picker ("Five are chosen…" when full) and Compare (`aria-disabled` with "Choose at least 2 properties." / "Choose one more property." beside it) with Clear all. No chips, no tag buttons.
     - The comparison under it: "4 properties side by side" as its h2, the backend's warnings as plain notes, then one table of fields by property: the property's address (a link) and place head each column, the groups Facts, Assessment, Last recorded sale, ZentraValue (the figure, the 80% range as "$877,000 to $1,093,000", Confidence "78 of 100", Change since last sale signed, Estimated) and Location (scores "74 of 100") are 13 px/600 titles over a 1 px ink rule. Units in the row names ("Living area, sq ft"). A missing value is the Unavailable marker with its reason (written in the cell; facts share one footnote, "Unavailable facts are not in the county record."); a group the backend left out for a property is one merged span ("No ZentraValue was returned for this property"). The largest figure in a row where more is plainly more (beds, baths, areas, confidence, change, scores) is set at 600 with "Highest" under it, in words, not a tint. Values sit left: a column is one property's mixed fields, so there is nothing to align down it; the numerals are tabular. The header row sticks under the top bar.
     - Properties chosen after the comparison ran are said in attention ("1 property was added after this comparison. Choose Compare to include it."); a property removed leaves the table at once, and the backend's notes (which may count or name it) give way to "1 property was removed after this comparison, so its notes are left out. Choose Compare to update them." Refetching keeps the table at 60% with `aria-busy`. Nothing chosen: "Properties you compare appear here, field by field." and Explore properties.
     - **Below 1024 px** the section is one column and the table scrolls sideways inside its own frame with the field names held at the left (each column is a property, so none can be dropped); "Scroll the table sideways to see all 4." shows only while it overflows. The page itself never scrolls sideways: the table's width is the field names plus one column per property (132 + 160 px each on tablets; 112 + 120 px on phones, so two properties fit at 390 px and "Transportation" fits its column).
     - **Comparable sales:** a white section under a 2 px ink rule with the property picker, "Within, miles" (0.1 to 6.2, the API's 100 m to 10 km; 1.25 by default, covering the property page's 2 km) and "Sold in the last, months" (1 to 120) and Find comparable sales, `aria-disabled` with its reason ("Choose a property first.", "Enter a distance from 0.1 to 6.2 miles."). The answer: "12 comparable sales" (h2), "Within 1.25 mi, sold since Nov 14, 2024, most similar first · records as of Nov 14", the property's own facts, a status the warnings don't already say (in attention), the backend's warnings as notes, then the table: Rank, Property (address link; facts; "Not on record: year built", never `yearBuilt`), Sold, Price, Distance in miles, Match (the similarity as a percent), Evidence and Why it was chosen (`gz-reasons`); below 1024 px Evidence and Why it was chosen leave the table and their words go under the property ("Same subdivision · Sold 5 months ago · evidence 90%"); on phones Rank, Property (sold, distance and match under it) and Price. A missing distance is Unavailable with "Unavailable distance: none was returned for that sale." under the table. A row (keyed by the sale: one property can have two) opens the sold property. None found: "No comparable sales" as the heading, with the backend's warnings saying why, or "Nothing matched this search. A longer distance or sale history may find some." when it sends none. The selection and ranking versions, the weights and the filters sit under Method only. No property yet: "Choose a property by address to list the recorded sales most like it."
3. **Map page** (Explore, the Comparables tab, the live map):
   - **Explore** (rebuilt Zillow-like on Nov 19, 2026, at the user's request; `features/explore/`). This overrides, for Explore only, the table plan in §7 and CLAUDE.md's "no grid of identical cards": the user wants the familiar map-and-photo-cards pattern for buyers.
     - **Frame:** the filters across the top (state, county, address, city, minimum beds, sort), then the map on the left and the results on the right (`clamp(480px, 46vw, 860px)`). On desktop the page fills the screen: the map stays still and the cards scroll in their own column. The map has no card around it and a rule on its right. Map pages are full bleed (`.page.wide` has no padding).
     - **Start:** with no state chosen, the map shows the whole country and the results column asks "Choose a state to see its properties on the map." with a button per state from the backend's location list. Choosing one (there or in the filter) searches that state.
     - **Cards** (`gz-explore-card`): a photo (16:10; "No photo" when there is none) with the property type and the save heart over it; the ZentraValue first, as Zillow leads with a price (20 px/600, the word ZentraValue beside it, the confidence under it, Low in attention; Unavailable on the hatch with "No estimate was returned for this property." when there is none; a solid skeleton while loading); one facts line ("3 beds · 2 baths · 1,840 sq ft · Built 1952") and "Unavailable: beds, baths" for what the record lacks; the address (a link to the record) and the place; then Compare (checkbox) and "Show on map". The picked card has a copper border. Two columns when the results column allows, one on phones.
     - **Header and notes:** "Explore" and "25 properties in Florida"; Parcel search and Save search. Under the cards: "ZentraValue is GeoZentra's estimate of market value, not an asking price.", the Unavailable reason, and the sort note. Sorting is one select over the API's sort keys ("Living area, largest first", …); there is no ZentraValue sort because the API has none.
     - **Map:** every result on the page is placed from its parcel (the `exploreMap` slice looks each folio up, four at a time) and drawn as a white pill with its compact ZentraValue ("$985K"), or a hatched dot when it has none. A page is fitted into view once its results are placed; a new page replaces the lookups still pending for the one before. Until the values are in (or when they failed) pins are plain ink dots, never the hatch, and the legend says when values failed. The card under the pointer turns its pill ink. Picking a card (click or "Show on map") or a pill selects it: the map zooms to its parcel and outlines it in copper (3 px, 20% fill), its pill turns copper with a permanent label, and a pill click scrolls its card into view. "Show all on this page" fits the page again. The legend counts what is placed, names results whose folio has no boundary on record, and offers Retry when lookups failed.
   - **Comparables tab:** the comparable-sales table takes 7 columns and a sticky map 5, inside the record frame. The ZentraValue aside shrinks to one line above the table, with the page's actions at its end, and the section header links to Compare (`/compare/:id`). A row is selected by click or arrow keys (the shared table), which highlights its pill; Enter or a click also opens its popup. Nearby qualified sales follow as a full-width table. Under 1024 px the map sits above the table.
   - **Live map:**
     - The map fills the page, with the parcel search docked on the left at 420 px.
     - Built in item 2 as "Parcel search" (`/explore/live`, linked from Explore's header). The panel holds the h1, the folio or address search (a disabled Search says why under it), address matches as ruled rows, and the growth section (`gz-growth-panel`); the page itself doesn't scroll on desktop. Map chrome: "Parcels / Growth since last sale" and "Street / Satellite / Terrain" as segmented controls at top left, zoom at top right, one legend at bottom left. Street (greyscale) is the default base map.
     - The property dialog stays a Material dialog for now, restyled to tokens, using the ZentraValue component, with no gradients and with the scrim fix.
     - Moving it into the docked pane is a later page-session decision, because its markup is spec-asserted (`.dialog-actions`, `.range-track i`).
4. **Overview:** one lead element, then at most two columns (§8).

### Phones (≤ 700 px)

- **Pro shell:**
  - The rail becomes a 64 px navy bottom bar: four own-work items plus More, which opens a sheet with the rest. Icons are 24 px; labels stay 12 px so "Applications" fits in a fifth of 390 px.
  - The top bar (60 px, both shells on phones) keeps the glyph, scope switcher, search icon, notifications and avatar.
  - The More sheet lists the rest in 52 px rows with 16 px text.
- **Public shell:**
  - A white bottom bar: Explore, For you, Saved, Alerts, More. Guests see the same bar; Saved and Alerts ask them to sign in.
  - The top bar keeps the brand, the search icon, and the avatar or "Sign in".
- **Registers:**
  - Two columns: identity, and the key figure. Each has a 12 px second line (where, and stage).
  - No horizontal scroll. Every other column is in the record.
  - Stage links become one picker.
- **Records:**
  - A single column, with the ZentraValue block directly under the header.
  - Tabs scroll sideways with a right-edge fade, so the cut-off tab shows there are more.
  - Tables keep three columns at most.
  - The record replaces the list, with Back, previous and next at the top. Actions wrap rather than overflow.
- **Charts** re-render at the actual width with fewer ticks. Labels stay 12 px.
- **Map pages:** a List / Map toggle. The map and Leaflet load only when Map is chosen.
  - Explore uses the toggle below 1024 px, tablets included. The map component is behind `@defer`, so Leaflet's JavaScript and stylesheet load (and results are placed) only when Map is chosen. In Map view the map fills the screen under the switch, the header and the picked property; on phones the filters stay in the List view. "Show on map: <address>" on a card switches to the map and moves focus to the picked property, named above the map with its ZentraValue and a link to its record.
  - Parcel search stacks on tablets and phones: the search, then the map (64% of the screen height), then matches and growth.
  - On the Comparables tab (item 1) the toggle is CSS only: the map is created, and its tiles load, only when Map is chosen, but Leaflet's JavaScript still arrives with the property page, because `comparables-map.ts` imports it statically and its Leaflet lifecycle is on the HANDOFF fragile list.
- **Sheets and dialogs** go full screen.

### Detail routes

New routes such as `loan-review/applications/:id` and `crm/leads/:id` may be **added** to
`app.routes.ts` in the foundation and page sessions:
- **Do not** change or reorder existing routes.
- **Do not** touch their providers.

The selection comes from the route parameter through existing load actions (§16).

---

## 6. Missing and partial values: one rule

Specimen: [directions/unavailable.html](design-audit/directions/unavailable.html)
([screenshot](design-audit/screenshots/directions/unavailable.png)).

| State | Meaning | Shown as |
|---|---|---|
| **Unavailable** | The backend has no value where one is expected (`null`) | The word **Unavailable** on the hatch (below), with the reason visible nearby. Never `0`, `—`, `null` or blank. |
| **Partial** | An aggregate over some of the records | The known figure, with the caption **"Partial: N of M …"** directly under it and a coverage bar |
| **Zero** | A recorded zero | `$0`, with context where it could be misread ("Paid in cash") |
| **Not applicable** | The field can't have a value in this state (a funded amount before funding) | A blank cell: no hatch, no dash. A whole section that doesn't apply collapses to one sentence. |
| **Empty collection** | No records yet | One sentence on what will appear, plus the button that creates the first one. No zero tiles. |

### The unavailable marker

```css
.na      { background-image: repeating-linear-gradient(135deg, var(--hatch-line) 0 1px, transparent 1px 6px); }
.na-word { color: var(--ink-2); }   /* the literal word "Unavailable" */
```

- **Shape:** the hatch fills the cell or value slot from rule to rule (the padding box). It has **no border, fill or corner of its own**. That is what keeps it from reading as an input; inputs have a 3:1 border, a white fill, 4 px corners and a fixed height.
- **Position:** the word sits where the number would, in the column's alignment (right-aligned in money columns).
- **Behaviour:** the marker isn't focusable, doesn't change on hover, and keeps the default cursor.
- **Reason:** always written out, never only in a tooltip:
  - In a group note when adjacent fields share a reason.
  - In a footnote under a table.
  - Inside a merged span.
  - As a caption under a single value.
  - The reason is also in the accessible text, after the word.
- **Merging:** when a block of cells is missing for one reason, merge them (rowspan or colspan) into one hatched span with the word once and the reason. The word is not repeated down a column.
- **Reserved:** the hatch means missing data only. It is never used for disabled controls, skeletons, selection or not-applicable cells.
- **Forced colours and print:** in forced-colours mode the hatch drops out and the word stays. Print keeps the hatch.
- **Summary-strip figures:** the summary strip (today's `gz-kpi`) shows the word on the hatch in the figure slot, with the reason as its caption (the component's `unavailable` input). This replaces `—`. If a spec asserts `—`, update the spec in the same change.
- **A property named by ID** (`gz-property-ref`, item 9): its address once the catalog has it (the folio, formatted, when the record has no address); a skeleton while it loads; "Address unavailable" (still a link to the record) when the lookup failed. Never "Property #42". It asks once per property shown; a list of hundreds (an image backfill's results) links "Property ID 42" instead of looking each one up. The property picker's chosen property follows the same rule ("Loading the address…", then the address, the folio or "Address unavailable"; item 10).

### Partial values

- **Caption:** the figure is always followed by the caption `Partial: 3 of 5 holdings valued` (this exact text is spec-asserted). *Partial:* is set in `--attention` at weight 600.
- **Coverage bar:** an 88 × 6 px bar. Ink fills the covered share; the hatch fills the rest. The counts come from the backend (`coveredHoldings` / `totalHoldings`) and are never estimated client-side.
- **Same on both pages:** the **investor overview and Portfolio use the same component and wording.** The overview never shows a known total without the label.
  - Debt: "Partial: 3 of 5 holdings with a known balance".
  - Equity: "Partial: 2 of 5 holdings with value and debt".
- **Equity** is partial whenever the backend marks it `PARTIAL`. If no holding is covered, the figure is **Unavailable**: never `$0`, never "Partial: 0 of 5".
- **Complete but not universal:** a metric the backend reports as complete by definition (cash flow, status `OK`) shows coverage ("From records on 2 of 5 holdings") without the Partial label.
- **Never show:**
  - `0` for unknown.
  - `null`, `undefined` or `NaN`.
  - Dangling separators ("data through ·", " · /100").
  - A bare partial sum.

### Helpers and loading

- **Formatters:** `usdCompact` and `amount()` keep returning `null` for missing values (HANDOFF). Templates render `null` through the marker and never through `?? 0`.
- **Text:** counts are pluralised ("1 search"). Folios are formatted `01-4137-012-0450`.
- **Loading:**
  - Skeletons are solid `#E7ECEF` blocks with no text, no hatch and no shimmer.
  - On refetch, the previous render stays at 60% opacity with `aria-busy`, so the layout doesn't jump.
- **Section errors:** one sentence saying what failed, plus a Retry button. Errors don't apologise.

---

## 7. Tables

Every list is a real `<table>`. Pro screens are dense: tabular numerals, aligned columns, a sticky
header and sortable columns.

- **Markup:** `<thead>` with `<th scope="col">`. Sortable headers contain a `<button>`; the active column carries `aria-sort` and one arrow glyph in copper.
- **Alignment:**
  - Numbers are right-aligned and tabular; text is left-aligned.
  - Units go in the header ("Lot, sq ft"), not in every cell.
  - Money is shown in full in tables (`$1,180,000`). Compact money (`$2.93M`) appears only in the summary strip and on map labels.
- **Sticky header:** offset by the top-bar height (52 px pro, 60 px public), or 0 inside a pane or its own scroll container.
- **Sorting:**
  - Server-side wherever the API takes sort parameters: Explore sorts by `sortBy` on `bedrooms`, `bathrooms`, `livingAreaSqft`, `lotSize` or `yearBuilt` (the five keys backend master accepts besides `id`).
  - Columns without backend sort are sorted client-side within the loaded page, with "Sorted within this page" under the table, until the backend sort parameters in §16 land.
- **Rows:**
  - 13 px text, hover background `#F7F9FA`.
  - Selected: `--copper-tint` plus a 3 px copper inset on the first cell.
  - The row's main action is a click or Enter. Other actions go in one overflow menu; no clusters of four buttons.
- **Column priority:** each column has a priority from 1 to 3 (`data-priority`).
  - Priority 3 hides while a record pane is open.
  - On phones, only priority 1 shows, with second lines.
- **Empty and filtered:**
  - An empty table shows one sentence plus the create action in the body area.
  - A filtered empty table says what is empty ("No applications in Rejected.") and offers Clear filter.
- **Paging:** "1 to 20 of 22" with Previous and Next, over the server's pages.
- **Stage filters** are links with counts (`.stages a`, spec-asserted). Counts come from backend summaries, such as the lender pipeline.
- **Screens that become tables:**
  - Loan applications.
  - CRM clients, leads, tasks and deals.
  - Alert rules and saved searches.
  - Opportunities, as a ranked table with a rank column. Built in item 3 (`features/opportunities/`):
    - **Top scored:** Rank, Property (address link, place, county), Score of 100 (a 64 × 6 px bar: ink the score, `--rule-strong` what the evidence on record could still earn, hatch the part no evidence covers; then "Evidence covers 50 of 100" in 12 px), ZentraValue (the value the score used, with a 12 px confidence line), Next 12 months (signed), Strongest evidence (the factors that earned points, as `gz-reasons`; priority 3, hidden under 1024 px). The sortable columns are the API's four orders (Score and Next 12 months high to low only, ZentraValue both ways), mirrored by a Sort select in the filter bar. Sorting re-sorts what is applied, from the first page: it never reads the unapplied fields or the location picker (which is shared with Explore, Settings and the area form), and Clear filters clears the picker too. Backend notes that name the scoring version sit under Method with it. On phones the filters fold behind one Filters button and the table keeps Rank, Property (with ZentraValue and forecast as second lines) and Score. Opening a row puts its record in the Desk's pane (§5): the score and coverage, every factor (`gz-score-factors`, compact), the valuation the score used (an 80% range row that is Unavailable with its reason, since scores don't store one: §9 never shows an estimate without its range; every missing value writes its reason under the word), and the scoring version under Method. Leaving the tab closes the pane.
    - **Matched to you:** `gz-matches` (§8).
  - (Not Explore: it is map and photo cards since Nov 19, 2026, see §5.)
  - Portfolio holdings, and financial records (with a Type column of Income or Expense and signed amounts).
  - Admin import jobs, data quality and valuation operations.
  - Comparable sales, valuation history, and Compare (facts by property).
- **One shared table component** in `shared/` (sort header, sticky header, selection, priorities, keyboard). It loads lazily with the pages, not in the initial bundle.

---

## 8. Page headers and overviews

**Page header:**
- The h1 is the page's name as it appears in the nav (Overview, Applications, Portfolio, Explore). On a record, it is the record's name (the address, the applicant).
- An optional one-line description in ink-2 appears only when it adds information.
- Actions sit on the right.
- **No eyebrow, no slogan, no breadcrumb repeating the title.** The `eyebrow` input of `gz-heading` goes.

**Overviews lead with one actionable element**, full width, built only from data the backend returns:

| Overview | Lead element | Data | When there's nothing to do |
|---|---|---|---|
| Buyer | **Matches for your search**: a ranked table of the top 5 (address, beds, living area, ZentraValue, reasons) and "See all matches" | Recommendations, status `READY` or `PARTIAL` | `NO_PREFERENCES` or `LOCATION_REQUIRED`: **"Set your area and budget"** as an inline form; never "Matches for you 0". `NO_MATCHES`: "No matches for these preferences" and Edit preferences. |
| Investor | **The portfolio summary strip**, partial figures labelled, with the one action that raises coverage: "2 holdings have no loan balance" and **Add balances** (opens the holding pane) | Portfolio summary; holding financing (`FINANCED` without `outstandingBalance`, or `UNKNOWN`) | Coverage complete: the strip and **Add a holding** |
| Realtor | **Overdue and due this week**: a task table with **Mark done** per row | `GET /dashboards/realtor/tasks-pipeline` (`tasks.overdue`, `tasks.dueSoon`, `window.days`) | "No tasks due in the next N days." and **New task** |
| Lender | **Waiting for review**: Submitted and Under review applications, oldest update first, with **Review next** (opens the Desk pane) | Pipeline stage counts; applications filtered by stage | "No applications waiting." and **New application** |
| `admin` role | No separate overview. Import jobs is the admin landing page. | | |

**The buyer lead is built** (item 3, Nov 19, 2026) as `gz-matches` in `features/opportunities/matches.ts`, shown today on the Opportunities page's "Matched to you" tab (`[framed]="false"`, on the page like the other registers); the overview reuses it in item 4 (`[limit]="5"` adds "See all N matches", framed by default as a white section under a 2 px ink rule).
- **READY / PARTIAL:** "Matches for your search", the count and "Updated Nov 18", Edit preferences and Refresh, then what was applied: "Matched on your target county: Miami-Dade, FL." or "**Partial:** matched on your target county only (Miami-Dade, FL). Your budget and goals were not applied." (county names from the saved preferences). The table: Rank, Property (place; beds and living area as a second line on phones), Beds, Living area, ZentraValue (from the existing bulk prediction action, once per set of rows: the figure and its confidence line in the §9 format, Low in attention; a skeleton while loading; one merged Unavailable span with Retry when the values could not load), Reasons (the backend's reasons as sent; "UNKNOWN" / "NOT_REQUESTED" budget and goal checks are not repeated per row). A reason every loaded match has is said once above the table ("Every match: ✓ Matches your saved target county: Miami-Dade, FL"); the column, then headed "Other reasons", keeps only what differs between rows ("No other reason" in a row with none) and is left out when no row has one. Client-side sort within the loaded matches, with "Sorted within these N matches" under the table. Footnotes give the Unavailable reasons, "ZentraValue is GeoZentra's estimate of market value, not an asking price.", and the backend's limitations as sent; ranking, source and "records as of" sit under Method.
- **NO_PREFERENCES / LOCATION_REQUIRED:** `gz-area-budget-form`, "Set your area and budget" (framed or not like the rest of `gz-matches`): state and county (the shared county picker), budget from and up to, and "Show matches", which dispatches the existing `UserActions.savePreferences` with the goals and counties already saved. A disabled Show matches says why next to it (`aria-describedby`); it refuses to save over preferences it couldn't read, and says whether the account or the preferences failed, with Retry. A saved budget fills only the fields not typed in yet. Saving drops the recommendations answer (existing reducer), so the matches load again by themselves.
- **NO_MATCHES:** "No matches for these preferences", the counties searched, Edit preferences (primary) and Explore properties.
- **Guests:** "Sign in to see properties matched to your area and budget." with Sign in and Create account. Loading is solid skeleton rows; a failed load is one sentence and Retry.

**After the lead element** (Nov 26, 2026: the overviews follow the SOW's dashboard information, section IV, as far as the backend has data for it):
- Up to four sections, in two columns (one below 1024 px), each a table, a ruled strip or stage bars, never a card grid; a section the SOW asks for that a column can't hold runs full width (the investor's opportunities, the lender's pipeline):
  - Buyer: saved properties and saved searches, alerts and recent activity.
  - Investor: occupancy and income and returns (recorded cash, then contract rent and gross yield), then opportunities full width.
  - Realtor: clients and leads (counts and leads by stage) and deals by stage, the newest leads and recent activity.
  - Lender: pipeline by stage full width (count and requested amount), then approved and funded this month and loan mix.
- Only what the backend stores: no section runs a calculator on typed inputs. The affordability and mortgage-context cards (`/dashboards/user/affordability`, `/dashboards/lender/mortgage-context`) only run the Studio's calculators on the caller's inputs, with no live rate feed, so they aren't read; the Studio is the tool. SOW items with no backend data (market snapshot, comps, geographic risk, portfolio quality, AIZentra recommendations) are left out, not shown empty.
- No request whose answer isn't shown, and no request an account type can't make (portfolios, scenarios and investor dashboards are investor routes; the portfolio list loads when Portfolio opens, not at sign-in).
- No shortcut cards: the rail or top bar is the shortcut list. Pro overviews show no consumer cards.
- KPI icon tiles become the ruled summary strip, and its figures keep the class `.kpi-value` (spec-asserted).

**Built in item 4 (Nov 19, 2026; `features/dashboard/`).** Every overview is the h1 "Overview" (no
eyebrow, slogan or "Welcome, Dana."; the investor portfolio and lender organization switchers sit in
the header's actions until the top bar has an app-level scope), then the lead section full width,
then at most two columns (one below 1024 px). Sections are `section[gz-overview-section]`: the
`gz-matches` frame (white, 2 px ink rule, 16 px h2, a one-line caption, actions on the right).
Each section loads, fails (one sentence and Retry) and empties (one sentence and the action that
creates the first one) on its own; Retry moves focus to the section's heading (the button goes away
when pressed). On a refetch the previous figures stay at 60% with `aria-busy`, and headings and
captions describe the figures on screen, not the ones being fetched. Counts and amounts are the
backend's own: no sums across stages, portfolios or categories, and "N of M" notes set the rows on
screen against the backend's count. Dates follow §13 ("Nov 9", "Oct 16, 2025"). The home
overview (/dashboard) is every account's; each area's overview is its own route (/dashboard/investments,
/dashboard/crm, /dashboard/lending) behind its feature, titled with the area's name.
- **Buyer:** `gz-matches [limit]="5"` (READY/PARTIAL table and "See all N matches", the area form,
  NO_MATCHES, the guests' sign-in line), then Saved properties (Property with county and state, the
  folio when there is no address; Saved) and Saved searches (Search, Checked, Saved), Alerts (Alert
  with what it watches, Checked, Status; "Paused with its search" when its saved search is paused)
  and Recent activity (what was done in words, "Saved a property", with the property, search, alert
  or portfolio it concerns; a portfolio links only for an account with Portfolio; "Deletions,
  sign-ins and views aren't recorded"): the newest of each, as the user dashboard cards send them,
  with "5 newest of 7" when the card holds more. "Your home budget" stays in the Studio.
- **Investor:** the lead is the scope's strip (Value, Debt, Equity; partial figures carry "Partial: 3
  of 5 holdings valued", "… with a known balance", "… with value and debt" and the coverage bar; a
  complete one says "2 of 2 holdings valued"; a figure no holding covers is Unavailable with its
  reason), then the coverage action: "2 holdings have no loan balance, so debt and equity leave them
  out." and **Add balances in Portfolio** (the uncovered holdings of the debt metric; the button
  opens Portfolio, since no route opens a holding's pane, §16 #12), or "Every holding has a loan
  balance on record." and **Add a holding**. The sources and the backend's note follow. Occupancy:
  rental occupancy as a one-figure strip ("2 of 3 rental holdings rented"), a table of holdings by
  occupancy (a one-hue bar under each status, drawn against every holding in scope; "Not recorded"
  for UNKNOWN), how many holdings have occupancy recorded, and holdings by county with the backend's
  percent. The all-portfolios option shows the holding count of the all-portfolios card, never a sum
  of the listed portfolios. All four cards come from one request, `GET /dashboards/investor` (with
  `portfolioId` for one portfolio); a card the server couldn't build (status ERROR, the dashboard
  PARTIAL) fails alone, a failed request fails all four, each with Retry. Income and returns (one
  portfolio or all of them; the last 12 complete months, named in the caption "Nov 2025 to Oct 2026 ·
  38 records · updated Nov 3"): Income, Expenses and Net cash flow ("From records on 2 of 5
  holdings", no Partial label), categories with a Type column and signed full amounts in the polarity
  colours, and the expense categories with no record named as missing costs, never $0. Then Contract
  rent, kept apart and never added to the recorded cash: Rent a month ("2 of 3 rented holdings with a
  lease rent"), Rent for the period and Gross yield (annual rent ÷ purchase price; Unavailable without
  a purchase price), or the backend's reason when there is none. Net operating income isn't shown:
  holdings store no operating costs. Opportunities, full width: the card's best stored scores (Rank,
  Property with "In your portfolio", Score of 100 with "Evidence covers 80 of 100", ZentraValue, Next
  12 months; Unavailable cells say why), "Top 5 of 416,226 scored properties", Open Opportunities;
  empty, the shared service's reason. A card answering for a scope no longer in view (a portfolio
  deleted elsewhere) is never shown; the overview asks for the scope in view again (§16 #16).
- **Realtor:** the lead is the task table (Task, Due, Status), overdue first ("Overdue" in attention
  with its due day) then due in the card's window, with the rows on screen against the card's
  counts when it lists fewer ("Listed: 4 of 4 overdue and 5 of 7 due in the next 7 days.") and
  "Mark tasks done in Tasks.": the CRM slice
  that writes tasks is not registered on the overview's route, so rows link to Tasks instead of a
  Mark done button (§16 #13). Empty: "No tasks due in the next 7 days." and **New task**. Then
  Clients and leads (a strip of Clients, Open leads and New leads, the clients-leads card's own
  counts, New leads opening Leads on New; then leads by stage) beside Pipeline by stage (deals,
  `gz-stage-bars` in the ordinal ramp, each stage opening the filtered CRM list), then Newest leads
  (Lead with client and source, Stage, Created; each opens its record with `?open=`) beside Recent
  activity (the CRM feed). The license notice stays under the h1.
- **Lender:** the lead is "Waiting for review": each waiting stage as the pipeline sends it as its
  caption ("Submitted 4 ($2.21M requested) · Under review 4 ($3.10M requested)"), then those
  applications, oldest update first (Applicant with loan type, Stage, Requested, Last update, LTV
  from the collateral analysis with its reason when Unavailable; on phones the LTV is a second line),
  and **Open Applications** (`/loan-review?tab=applications`). The lender slice holds only the 6
  newest applications (the API lists them newest first), so the lead lists the waiting ones among
  them and says "Listed: 1 of 4 submitted and 2 of 4 under review." (§16 #14). Empty: "No applications waiting." and
  **New application**; no organization: "Create your lending organization…" and **Set up
  organization**, with no other sections. Then Pipeline by stage, full width: every stage with its
  count and requested amount, from the pipeline the lead already reads (a stage with no application
  requests $0; Rejected and Withdrawn muted), each stage opening Applications filtered on it
  (`/loan-review?tab=applications&stage=…`; Loan review applies the stage and takes it out of the
  address). Then Approved and funded this month (a two-figure strip,
  the backend's note, the period form behind "Change period"; while another period loads, the shown
  card keeps its heading; "This month" hands focus to the form's summary) and Loan mix (§11).
  Mortgage context is no longer on the overview.
- **Admin:** no overview of its own and no redirect: an admin opens the home overview like everyone, and the
  backend gives an admin every area, each with its overview.

---

## 9. ZentraValue: the signature element

One component, used everywhere a ZentraValue appears: `gz-zentra-value` in
`shared/components/zentra-value.ts` (item 1). `size="page"` gives the 40 px aside figure, the default
`pane` 32 px; `layout="line"` is the one-line form above the comparables table; `[details]` (on by
default) adds the forecast and last-sale rows. Specimens:
[property aside](design-audit/screenshots/layouts/public-property.png),
[lender pane](design-audit/screenshots/layouts/desk.png),
[limited estimate](design-audit/screenshots/directions/unavailable.png).

```
ZentraValue                              Nov 1, 2026     label row, 12 px ink-2
$985,000                                                 figure, 600, proportional
|------[=========|=========]------|                      .range-track: <i> band, <i class="pt"> tick
$877,000            80% range           $1,093,000       ends, tabular
Confidence 70 of 100 · Medium, from sales through Oct 31, 2026
```

- **Value:**
  - 40 px in the property aside, 32 px in panes, 24 px in the summary strip, normal size in table cells.
  - In table cells, the value carries a 12 px confidence line under it.
- **80% range:** `.range-track` (spec-asserted `.range-track i`).
  - The band is `--copper-band` with 2 px copper ends; the estimate is a 2 px ink tick.
  - The scale is the 90% range when the backend sends one. Otherwise it is the 80% range widened by 25% on each side.
- **Confidence, one format everywhere** (decided Nov 20, 2026): the score out of 100, then its band as the valuation states it.
  - A line: "Confidence 78 of 100 · Medium". A row labelled Confidence: "78 of 100 · Medium".
  - Without a band, the score alone ("Confidence 78 of 100"); without a score, "Medium confidence"; with neither, "Confidence not stated".
  - A band is never worked out from a score: the model sets the band per segment and gives each band a fixed score (90, 70, 40), while scored valuations can carry other scores (78). Opportunity rows have no confidence field; their score and band come from the score's own "Valuation confidence" factor (its value, and the band its explanation states, §16 #9).
  - In the ZentraValue block it is followed by "from sales through" and the `dataThrough` date.
  - Helpers: `formatConfidence` and `formatConfidenceValue` in `shared/data/format.ts`.
  - Used everywhere a ZentraValue's confidence shows (item 9 finished it): the Opportunities table and pane, the matches table, Explore cards ("Confidence 78 of 100 · Medium", the prediction sends both), `gz-zentra-value` on the property page and the live-map dialog ("Medium confidence": the valuation endpoint sends the band alone) and Compare's Confidence row ("78 of 100": the comparison sends the score alone).
- **Low confidence** (the Low band) is set in `--attention`, the whole line.
- **Limited estimate** (`status: limited`): the label row reads "Limited estimate", with the backend's reason in `--attention` under the confidence line.
- **No estimate** (`unsupported`, or no prediction): the figure and range area become the unavailable marker, showing the backend's reason ("Units in condo-hotel buildings are not modelled …"). Never `$0`, never blank.
- **Optional ruled rows below:** the 12-month forecast with its range, and the last sale.
  - The forecast's range is labelled **"Range (illustrative)"**, not "80% range" as the property specimen showed: the backend's forecast low and high are illustrative bounds, not coverage ranges. The same holds for the forecast table on the Valuation tab.
  - A missing 12-month forecast is a marked row ("No 12-month forecast was returned"); the last-sale row comes from the valuation's evidence and is left out when the backend sends none.
  - An estimate without an 80% range shows the marker in the range slot ("No 80% range was returned with this estimate"), so an estimate never appears without its range.
- **Where it appears:**
  - The property page aside (sticky).
  - The Collateral section of the lender pane, followed by LTV.
  - Explore cards (the lead figure, with confidence) and Explore map pills (compact), and Compare table cells.
  - Opportunities table cells (item 3), written in the cell rather than with `gz-zentra-value` (which needs the explained valuation): the full figure with a 12 px confidence line under it in the one format. The matches table takes the prediction's `confidenceScore` and `confidence`; the scored table takes the score's own "Valuation confidence" factor (§16 #9).
  - The map label of the selected marker.
  - The live-map dialog.
- **Never:**
  - A gradient card.
  - An estimate without its range and confidence in a record.
  - A model version string in the interface. Those go in a "Method" disclosure on the Valuation tab.

---

## 10. Maps

Specimen: [Explore with docked map](design-audit/screenshots/layouts/explore-docked-map.png)
([page](design-audit/layouts/explore.html)).

**Tiles**
- Today's OpenStreetMap street tiles, drawn in greyscale so the data carries the colour: `.leaflet-tile-pane { filter: grayscale(1) contrast(.9) brightness(1.05); }`. This needs no new provider and no new dependency.
- Satellite (Esri World Imagery) and terrain (OpenTopoMap) stay as toggles on the live map, unfiltered.
- Attribution stays visible, at 12 px.
- The OSM public tile servers aren't meant for heavy production traffic. Choosing a tile provider is a product decision, not a design one.

**Chrome**
- No card around the map.
- Zoom controls: 32 px white squares with a 1 px `--control` border and 4 px corners, top right.
- The layer switch is a segmented control at top left ("Properties", "Growth since last sale"). On Parcel search it reads "Parcels / Growth since last sale", next to the base-map switch. Explore has no growth layer; "Show all on this page" sits at its top left instead.
- Leaflet makes the map container a tab stop (arrow keys pan, plus and minus zoom) and its zoom and attribution links focusable, so a map is never `aria-hidden`: it is a region named "Map" (on the Comparables tab, "Map of comparable sales"), and its markers are not tab stops. The list or cards beside it are the way through the results.
- Leaflet draws outside Angular's views, so the map look (zoom, attribution, labels, markers, parcels, growth squares) lives in `src/map.css`, which is built into the lazy `leaflet.css` bundle with Leaflet's own stylesheet (§17). SVG attributes can't read the colour tokens, so layers carry classes (`gz-parcel`, `gz-parcel-pick`, `gz-cell`, `gz-greyscale`, Explore's `xm-pin`) and the colours come from CSS.
- The legend sits at bottom left in a white panel with a `--rule-strong` border, at 12 px. It is always visible while a data layer is on, and it names what isn't on the map ("Not on the map: 1700 Collins Ave, Unit 1504. No parcel boundary is on record.").

**Markers (properties)**

| Marker | Look |
|---|---|
| Has a ZentraValue | Circle, radius 6, ink fill, 2 px white ring |
| **No ZentraValue** | Circle, radius 6.5, **hatched** fill (a pattern in the overlay SVG: ink lines, 1.2 px, every 4 px, on white), 1.5 px ink outline |
| Selected | Circle, radius 8, `--copper` fill, white ring, and a permanent label: the address in bold, then "ZentraValue $985,000". The label has a 1 px ink border and square corners. |
| Hover | Radius 7 and a temporary label |

- The hit target is at least 24 px, using a transparent larger circle underneath.
- **Explore** uses price-style pills instead of the circles: a white pill with an ink border and the compact ZentraValue (12 px/600, tabular); a hatched 13 px dot when there is no ZentraValue (24 px hit target); ink fill when its card is under the pointer; copper fill when picked, with a permanent label (address, then "ZentraValue $985,000").
- No clustering library. Overlapping markers keep their rings, and the list is the way to pick one.
- A map's container isolates its stacking context (`isolation: isolate`): Leaflet's panes and controls use z-index 400 to 1000 and would otherwise cover the shell's bars, menus, sheet and toasts (§4 layers).
- **Comparables:**
  - The subject property is a copper marker labelled "Subject".
  - Comparables are white pills with a 1 px ink border, showing the sale price at 12 px, tabular ("$942K").
  - The selected pill is filled ink with white text.

**Parcels** (zoom 16 and closer)
- Ink outline at 1 px with no fill; 2 px on hover.
- Selected: a 2 px copper outline and a 12% copper fill.
- With a value layer on, parcels with no ZentraValue are hatched.
- This replaces Leaflet's default blue (`#3388ff`) and the green selection.

**Heat (the growth grid)**
- Squares on a fixed grid, as built today. **No blurred heat blobs.** `leaflet.heat` is installed but not imported (§17).
- 7 classes, diverging: ColorBrewer **BrBG-7**, `#8C510A #D8B365 #F6E8C3 #F5F5F5 #C7EAE5 #5AB4AC #01665E`.
  - The **middle class is neutral** (`#F5F5F5`) and covers the middle range of each metric's fixed breaks: **+3.5% to +5% a year** for annual growth since last sale, **+50% to +100%** for total growth since last sale, and **+1% to +2.5%** for the 12-month forecast. It is not centred on 0%: on the forecast, −1% to +1% is the light-brown class below it. (Worded by its real ranges in item 3; the legend has always labelled each class by its range.) Changing the breaks is a product call.
  - Browns are the slower classes and teals the faster ones, as the code documents.
  - The breaks stay as defined in `growth-grid.ts`. Today's palette has no neutral middle; this replaces it.
- Cells have fill opacity 0.85, separated by 1 px white gaps.
- Cells under the reliability count (`MIN_RELIABLE_HOMES`) are drawn at 0.45, and the legend says "Faint squares: fewer than N homes".
- The legend shows all 7 swatches with their class labels, the metric's name and its help text. Hovering a cell shows its median and count.
  - On Parcel search the help text is in the docked panel's growth section, beside the figures, rather than in the legend over the map.
- Parcels stay muted while the grid is on (as today).

**Constraint:** the Leaflet lifecycle and parcel placement in `comparables-map.ts` are on the HANDOFF
fragile list. Style it only through layer options and CSS.

---

## 11. Charts

All charts are hand-written SVG (no chart library) in `shared/`, loaded lazily with their pages.

**Drawing**
- **Draw at the container's real width**, re-rendering on resize. Never scale a fixed `viewBox` to fit: labels must stay 12 px. That scaling is what shrank chart labels to about 8 px on phones.
- Set the height per chart, including the axis band.

**Axes**
- Gridlines are horizontal only: 1 px solid `--rule`. The baseline is 1 px `--rule-strong`. Ticks are 4 px. Nothing is dashed.
- Axis text is 12 px ink-2, tabular. The y-axis has 3–5 clean ticks with compact money ($400K, $1.2M), and **starts at 0** for prices and counts.
- **The time axis is linear in time.** Any x-axis over dates puts events at their true dates, so 2008, 2019 and 2026 are spaced by years. This fixes the sales chart.
  - Ticks fall on calendar boundaries: every 2 years on desktop and every 5 on phones, or months when the span is under 2 years.
  - A gap in periodic data (a month with no records) is a hatched column the full plot height, labelled "No records".

**Marks**
- Lines are 2 px, round.
- Dots are at least 8 px across, with a 2 px surface ring.
- Bars are 24 px wide at most, with a 4 px rounded data end, square at the baseline, and 2 px gaps between them.
- Bands are the series hue at 16%.
- **Forecasts:** the range fan at 16% plus a 2 px median line, after a 1 px ink-2 "Today" rule.

**Colour roles**

| Role | Colour |
|---|---|
| Recorded data (sales, recorded income) | `--ink` `#172735` |
| Model output (ZentraValue, forecasts) | Chart copper `#B4672F`. This is separate from the action copper `#8A5636`. |
| Categorical, at most 4 series in a fixed order | `#B4672F`, `#00879F`, `#8A8F1F`, `#AE4C6B`. The validator passes all checks in light mode: worst adjacent colour-blind ΔE 12.4, normal-vision ΔE 18.9, all at least 3:1 on white. A fifth series goes into "Other" or a separate small chart. |
| Ordinal (pipeline stages, deal stages) | Copper ramp `#C49C7E #AA7A55 #8A5636 #6A3F25 #4A2A17`. Passes the validator's `--ordinal` checks. |
| Polarity (income and expense, gain and loss) | `--positive` and `--negative`, always with a sign and a word |
| No data | The hatch |

**Labels and interaction**
- **Text never takes the series colour.** Labels use ink or ink-2.
- A legend is required for 2 or more series, placed above the plot on the left.
- Direct labels are selective: the endpoint, each event when there are 5 or fewer, and the extremes.
- Hovering or focusing shows a tooltip: a crosshair on lines, per mark on dots and bars. Marks can be reached by keyboard.
- **A tooltip is never the only way to read a value.** Every chart has a table twin, shown underneath or behind a Table toggle.

**The charts**
- **Sales and ZentraValue over time** (property Overview and Sales tab; [specimen](design-audit/screenshots/layouts/public-property.png)):
  - x runs from 2 years before the first sale to 6 months after today.
  - Each sale is an ink dot labelled with its price and month. The sales are joined by a 2 px ink line, and the last sale is joined to the first ZentraValue after it by a dashed copper line (6 5), as the chart did before the redesign (restored Nov 22, 2026). The dashes say that nothing was recorded in between.
  - The ZentraValue monthly line and its 80% band are chart copper.
  - The current estimate dot is labelled.
  - Its table twin is the sales table: date, price, type, instrument.
- **Valuation fan** (Valuation tab): the history line plus the 1-, 3- and 5-year forecast fan (7 years only on a valuation scored before the change, never relabelled as 5).
- **Cash flow by month** (Portfolio): net bars in the polarity colours. Months with no records are hatched.
- **Loan mix** (lender): a tall segmented bar of up to 5 parts. Unknown loan type is the hatched part. Built in item 4 as `gz-mix-bar` (`features/dashboard/overview-ui.ts`): 28 px tall, one block per loan type with funded loans (a type with none draws nothing), widths by loan count, 4 px corners, 2 px gaps, the categorical colours by loan type in a fixed order (Conventional, FHA, VA, USDA), the unknown type on the hatch with a `--rule-strong` edge. No numbers inside the blocks (white on the chart copper is under 4.5:1 at 12 px); the table twin under it is also the legend: Loan type with its swatch in the same cell (Unknown is the Unavailable marker with "Loan type not recorded", hatched like its block), Loans, Share (against the card's funded count), Funded (full money). The bar's accessible name lists every part with its count and share.
- **Pipeline by stage:** bars in the ordinal ramp, with counts.
- **Opportunity factors:** horizontal bars in one hue. A missing factor is hatched, never 0. One shared component since item 3, `gz-score-factors` (`shared/components/score-factors.ts`): a table of Factor (name, then category and the backend's explanation), Evidence and Points (a 56 × 6 px bar of points out of the factor's weight, then "14.2 of 20"); a missing factor's cells are the Unavailable marker. `[compact]="true"` leaves out the Evidence column for the 420 px pane. Used on the property page's Valuation tab and in the Opportunities record pane.

---

## 12. Components

| Component | Spec |
|---|---|
| Buttons | Primary: `--copper` fill, white text, hover `--copper-hover`. Secondary: white, `--control` border, ink text. Quiet: text only. All 4 px corners, `--control-h`, 14 px/500. One primary per view. Disabled buttons give the reason in text next to them. |
| Inputs, selects | White, 1 px `--control` border, 4 px corners, `--control-h`, 14 px text, `--placeholder` placeholders. The invalid state comes from the existing `.ng-touched` rules. |
| Checkbox | 16 px square, `accent-color: var(--copper)` |
| Compare toggle | A button on cards and pages ("+ Compare"); `[check]="true"` gives a 16 px checkbox with a "Compare" label (Explore cards, table columns). A full comparison leaves the box unchecked and says why in a toast. |
| Explore card | `gz-explore-card` (§5 Explore): photo, ZentraValue first, facts line, address link, Compare and "Show on map". Explore only; Saved is a table since item 6 (Opportunities since item 3). |
| Reasons | `gz-reasons`: the reasons a property matched as plain lines with a check, never chips (§14 bug 1). At most two lines in all, then "+N more": two or more reasons take a line each, cut with an ellipsis; a single reason may wrap onto a second line before it is cut. Every reason stays in the accessible text. |
| Matches | `gz-matches` (§8 buyer lead): the recommendations by status, with the matches table and the inline "Set your area and budget" form (`gz-area-budget-form`). In `features/opportunities/`; the overview imports it. |
| Tabs | Text links in 14 px ink-2; the active tab is ink/500 with a 2 px copper underline; a rule under the row; sticky on records |
| Stage filter | `.stages a` links with counts (§7) |
| Summary strip | A `<dl>` of figures separated by 1 px rules, with a 2 px ink rule on top. The label is 13 px ink-2; the figure is 24 px/600 and proportional (`.kpi-value`); the caption is 12 px. Partial and Unavailable follow §6. Built in item 4: `<dl class="kpi-row">` of `<div gz-kpi>` (label `dt`, figure and caption `dd`), as many columns as fit at 150 px or more; each figure draws its own left and top rule and the strip clips the outer ones, so any count wraps cleanly, and when it wraps to two columns an odd last figure takes the whole row. With `link`, the label is a link that covers the whole figure. Its styles load with the component, not the global sheet. |
| Overview section | `section[gz-overview-section]` (item 4, `features/dashboard/overview-ui.ts`): the frame of every overview section, the same as framed `gz-matches`: white, 2 px ink rule on top, 16 px h2 with a 13 px ink-2 caption, actions on the right (they wrap under the heading on phones). `[busy]` keeps a refetching section's previous render at 60% with `aria-busy`; `retried()` moves focus to its heading (`tabindex="-1"`), for a Retry that disappears when pressed. |
| Record section | A white surface with a 2 px ink top rule. Heading 16 px. Groups: a 13 px/600 title with a 1 px ink rule under it, then rows (label 44%, value) separated by `--rule`. A missing value's reason goes in the group's note when the rows share one; otherwise `[showReason]` on the row writes it under the word (item 3). |
| Record pane and sheet | 420 px, white, with a `--rule-strong` left edge (and a right edge when docked in the public shell, whose 1200 px page can end before the window does; item 3). The header holds previous, next and close, the title (20 px) and the actions. The body is ruled sections. First used by Opportunities (item 3) through `gz-desk` and `gz-record-pane`. Escape closes it, except in a field (a select's list, an input), where Escape is the field's; when previous or next reaches the first or last record, focus moves to the other arrow or the title instead of dropping to the page. A sheet that isn't a register record (the property page's "Ask about this property") uses `gz-sheet` (`shared/layout/sheet.ts`): title and close only, full screen on phones, registered with the shell's scrim and Escape; the page makes its own content `inert` while it is open. |
| Dialog | Material dialog, restyled: tokens, 0 px corners, the shell scrim, `.dialog-actions` kept |
| Coverage bar | 88 × 6 px. Ink fills the covered share, hatch fills the rest. Never a row of squares. |
| Notification menu | A floating menu with the menu shadow and a 1 px border. Each item: title, 12 px time, unread mark in copper. |
| Toast | Ink background, white 14 px text, 4 px corners, bottom left, above the bottom bar on phones. An error stays on its page until it is dismissed or replaced by the next toast, and goes when the user leaves for another page (decided Nov 20, 2026). A page is a path, or a navigation item told apart by a query (the lender's Pipeline, Applications, Import and Team on `/loan-review?tab=`). The error goes when a navigation ends on another page; a change of the query on the same page (a filter, a selected record, an in-page tab), a cancelled navigation and a redirect back to the page keep it, and an error the navigation itself raised (a page that fails to open or to start) replaces it and stays. Held in the shell component (item 9): the store still clears every toast after 5 s, the screen-reader live regions announce each once, and dropping a held error also clears the store's copy. Other toasts go after 5 s. A form's own error is also written under its button, so the toast is never the only place it is said. Which failures toast (decided Nov 26, 2026): every failed write, whatever its page shows (`store/ui/failure-toasts.effects.ts` lists them; favorites, the profile, the lender's writes, admin decisions and alert evaluations say their own), as a short lead and the reason: "Not saved. Transaction date can't be in the future."; and the two reads with no page of their own, the profile and the account's areas (only when none are known). A failed read of a page's data is said where the data would be, with Retry, never in a toast. A wrong field is said under the field, never in a toast. The backend's 400 text (`field: rule`) is put into words by `apiError`. |
| Empty state | One sentence and one action, aligned left in the space the list would fill. No illustration. |
| Icons | The existing 20-path set: 20 px, 1.6 px stroke, `currentColor`. New: pipeline, applications, import, team, tasks, deals, clients, leads, studio. Two pages never share an icon (Overview and Import jobs share one today). Navigation icons always carry a label. |

---

## 13. Copy

- **Tone:** plain, specific, short. Active verbs; sentence case. A button says what happens, and the confirmation uses the same verb.
- **No slogans or filler:** "A place for your next chapter", "Every relationship, in one place", "Intelligence for every square foot" all go.
- **Lender actions are tracking, not credit decisions:** "Record approval", "Record rejection", "Mark withdrawn". The backend's disclaimer is shown as sent ("Informational only; not a credit decision or approval.").
- **Developer words get mapped to plain ones:**

| Raw | Shown as |
|---|---|
| `generatedAt` | "Updated Nov 18" |
| `coveragePercent` | "3 of 5" |
| `CASH_BASIS` | "Cash basis" |
| `ORGANIZATION` (scope) | Omitted |
| `UNSUPPORTED_SOURCE` | "Source not supported"; on an alert rule, "Listing prices aren't available yet, so this rule can't run." (item 6) |
| `WEBSITE` | "Website" |
| `yearBuilt` | "Year built" |
| `UNKNOWN` loan type | Unavailable marker |
| `errorCode` / `lastErrorCode` | A sentence, with the code in a details row |
| `comparable-selection-v3`, model versions | Only in the Method disclosure |
| `opportunity-v1` (scoring version) | Only in the Method disclosure |
| `coveragePercent` (opportunity score) | "Evidence covers 50 of 100" |
| A field name inside backend copy (notes, limitations, disclaimers) | The words the page uses for it: `coveragePercent` → "evidence coverage", `generatedAt` → "the “Updated” date"; a note naming any other field is left out (`plainNote`, `shared/data/format.ts`) |
| `COUNTY_MATCH_THEN_PROPERTY_ID_ASC` | "Target-county match first, then record order" (under Method) |
| `PROPERTY_RECORDS` (recommendation source) | "Property records" (a Source row under Method) |
| `budgetMatch` / `goalMatch` `UNKNOWN`, `NOT_REQUESTED` | Not repeated per row; the Partial caption says what was not applied |
| Recommendation `status` | "Partial:" caption, the area-and-budget form, or "No matches for these preferences" (§8) |

  Import sources (`BROKER_SOUTHDADE`, `SD-2238`) appear in a Source field, never in prose.
- **Numbers and dates:**
  - Dates: "Nov 18" within the current year, otherwise "Oct 16, 2025". Calendar dates (`dataThrough`, "2026-10-31") are read as written (`formatRecordDate`); instants (`generatedAt`, `scoredAt`, `sourceAsOf`) are written on the viewer's own day (`formatLocalDate`, item 3), so a late-evening timestamp doesn't show as tomorrow.
  - Folios: `01-4137-012-0450`.
  - Money: full in tables, compact in summary strips and map labels.
  - Distances: one unit per screen (comparables use miles in both the input and the output).
- **Names:** a team member is shown by name, never as "User 112". Until names are available (§16), show "Unavailable".

---

## 14. Known bugs to fix in the foundation

1. **The recommendation chips overflow their cards** on the buyer overview. The chips become a "Reasons" column in the matches table, wrapping to at most 2 lines, then "+N more". Any chip that remains gets `flex-wrap: wrap`, `max-width: 100%`, and an ellipsis. (Done: `gz-reasons` since the foundation; the Reasons column of `gz-matches` since item 3.)
2. **The sidebar isn't dimmed behind dialogs.**
   - One shell-level scrim at z-index 45 covers the rail and the top bar (both 30). The Material overlay container sits above it.
   - The shell content gets `inert` while a modal is open.
3. **Sale tiles are clipped on phones.** The tiles go. Sales are a table plus the time-axis chart (§11), and both reflow at 390 px.
4. **The sales chart spaces sales by event, not by time.** It moves to the linear time axis (§11).

Also from the audit:
- Labels at 9–11 px go up to 12 px.
- Tabs that scroll on phones get the edge fade.
- Disabled buttons say why ("Evaluate now" included).
- Placeholder contrast is fixed (`--placeholder`).
- There is no account-type select anywhere: an administrator approves the account type (§5).
- The property address is no longer shown twice.
- The contact form no longer appears on every tab.
- The financial records table separates income from expenses with a Type column and signs.

---

## 15. Constraints carried from HANDOFF (do not touch)

- **Store contracts:**
  - Don't change action names and payloads, the reducer guards that drop late answers, or the effects' `switchMap`/`exhaustMap` choices.
  - New UI reads selectors and dispatches existing actions. Components don't call services directly.
- **Registration:** `appReducers` vs `featureStores` in `store/index.ts`, and the route providers in `app.routes.ts`. New detail routes are additions only (§5).
- **Spec-asserted text and selectors to keep:**
  - `.kpi-value`, `.stages a`, `.dialog-actions`, `.range-track i`.
  - "Partial: 3 of 5 holdings valued", "Verify your license", "Unavailable".
  - Restyle freely; where markup or copy changes on purpose, update the spec in the same change.
- **Missing values stay unavailable, never 0:** `usdCompact`, `amount()`, and the KPI unavailable text.
- **Shared rules:** the field and button rules in `styles.css` (`:where()` base fields, `.ng-touched`, `--control-h`). Only token values change.
- **Maps:** the Leaflet lifecycle and parcel placement in `comparables-map.ts`.

---

## 16. Backend and store needs

None of this is added or faked in the design. Until each item lands, the screen shows the honest state given here.

| # | Need | For | Kind | Until then |
|---|---|---|---|---|
| 1 | **A not-applicable signal.** Lot size on condominium units comes back `null`, the same as a missing value. | Telling N/A (blank) from Unavailable (hatch) | Backend | Shown as Unavailable |
| 2 | **LTV in the loan application list** (status and percent), or a batch collateral endpoint | An LTV column in the applications register | Backend | LTV only in the record pane (per-application collateral call) |
| 3 | **Batch address lookup** for property ids. Today it is one `CatalogActions.resolveProperty` per id. | Property columns in applications, holdings and CRM tables | Backend and store | Per-id lookups (fine at 20 rows) |
| 4 | **Detail routes** for registers (`loan-review/applications/:id`, `crm/leads/:id`, `portfolio/holdings/:id`, `admin/import-jobs/:id`, …) | A linkable record pane; Back closes it | Router. **Allowed:** add new routes to `app.routes.ts` in the foundation and page sessions. Don't change or reorder existing routes, and don't touch the rest of the HANDOFF list. `@ngrx/router-store` isn't needed: the selection comes from the route parameter through existing load actions (lender collateral analysis, the import job's `selectedId`). | The pane opens from in-page selection |
| 5 | **Coordinates on search rows** (parcel centroid), or a batch parcel lookup by folio. Found while building the Explore specimen: search rows carry no coordinates. | Placing every Explore row on the docked map | Backend | Done client-side for now (approved Nov 19, 2026): a new `exploreMap` feature slice looks each result's parcel up by folio, four at a time, registered on the `explore` route. 20 lookups per page; coordinates on search rows would replace them. |
| 6 | **ZentraValue for the Explore page:** load `POST /predictions/bulk` once per results page | ZentraValue on Explore's cards and pills | Store (the endpoint exists) | Done (approved Nov 19, 2026): Explore dispatches the existing `ValuationActions.loadBulk` once per results page and shows its own error copy ("ZentraValues could not load."), since the action's message names the growth heatmap. |
| 7 | From the audit (§8 of AUDIT.md): per-holding value, debt and LTV; deal value and lead budget; lender member names; client names in CRM activity; listing prices; `sourceAsOf` on recommendations; sort and search parameters for CRM, lender applications and alerts; a notification inbox past 5 items | Holdings, CRM and lender tables; freshness; server-side sorting | Backend and store | As described in the audit |
| 8 | Moving eagerly registered store slices to route-level feature stores | Getting the initial bundle under 500 kB | Store. **On the HANDOFF fragile list: needs your go-ahead.** | Over budget |
| 9 | **Confidence on opportunity rows** (`GET /opportunities` items carry the estimate and forecast but not the valuation's confidence score or band) | The 12 px confidence line under the scored table's ZentraValue (§9) | Backend | The score's own "Valuation confidence" factor: its value is the score and its explanation states the band ("… 78 of 100 (medium confidence)"), read for "Confidence 78 of 100 · Medium"; the score alone when the explanation names no band |
| 10 | **ZentraValue on recommendation items** | The matches table's ZentraValue column | Backend | One `POST /predictions/bulk` per set of rows through the existing `ValuationActions.loadBulk` (item 3). It shares the slice's single predictions map with Explore and the parcel map, which ask again when they open. |
| 11 | **Plain-word backend copy:** recommendation limitations name `generatedAt`; opportunity notes name `coveragePercent`, and one names the scoring version ("Version opportunity-v1 scores …") | Copy without developer words (§13) | Backend | The two field names are written in the page's words ("Evidence coverage is the highest score …", "the “Updated” date is the response time …"), and a note naming any other field is left out; the note naming the version is shown under Method only (Opportunities and the property page) |
| 12 | **Which holdings lack a loan balance, and a way to open one**: the value-equity-debt card gives counts only, and Portfolio has no holding route or query parameter (§16 #4) | The investor overview's **Add balances** opening the holding pane | Backend or store, and a route | "N holdings have no loan balance" from the debt metric's counts, and "Add balances in Portfolio" opening Portfolio (item 4) |
| 13 | **Marking a task done from the overview**: `CrmActions.updateTask` exists, but the `crm` slice is registered only on the `crm` route; the realtor dashboard slice has no task write | **Mark done** per row in the realtor lead | Store (or the `crm` slice on the dashboard route, a route-provider change) | Each task links to Tasks, with "Mark tasks done in Tasks." under the table (item 4) |
| 14 | **Waiting applications for the lender overview**: the lender dashboard slice loads the 6 newest applications of every stage (the API sorts by id, newest first); no stage filter, no oldest-update-first sort; and Loan review has no application parameter or detail route (§16 #4) | "Waiting for review" listing every Submitted and Under review application oldest first, and **Review next** opening the oldest in the Desk pane | Backend (sort), store (a stage-filtered load) and a route | The waiting ones among the 6, "Listed: 1 of 4 submitted and 2 of 4 under review.", and **Open Applications** (`/loan-review?tab=applications`) (item 4) |
| 15 | **One user card per request**: `DashboardActions.load` loads favorites, saved searches, alerts and activity together | The buyer overview, which shows two of the four | Store | Four requests on every buyer overview, two of them unused (item 4) |
| 16 | **A deleted portfolio in scope**: `InvestorDashboardActions.load` asks for the cards of the stored scope; when the list then drops that portfolio, the reducer moves the scope to all portfolios but nothing asks again (the cards stay failed, or show the old portfolio's figures) | The investor overview after a portfolio is deleted elsewhere | Store | The overview shows no card of another scope and asks for the scope in view with the existing `selectScope` (item 4 review) |

---

## 17. Bundle

| Item | Effect |
|---|---|
| Fonts | DM Sans only: 36.1 kB, down 24.0 kB (outside the Angular budget) |
| Global CSS | Strict tokens and no motion section: an estimated 5–10 kB less in `styles.css` |
| Chart library | None; hand-written SVG. uPlot (about 21 kB gzipped) only with your approval, if interactivity outgrows SVG. |
| Shared table, pane and charts | Lazy, with the pages that use them. No CDK in the initial bundle: the sheet is CSS plus `inert`. |
| Leaflet on phones | Loads only when Map is chosen, saving 150 kB of lazy JavaScript per phone Explore visit |
| `leaflet.css` | Done in item 2 (approved): built as a lazy bundle (`bundleName: "leaflet"`, `inject: false`) with `src/map.css`, and added first in `<head>` by the map that needs it (`shared/data/leaflet-css.ts`). Initial bundle 545.85 → 534.78 kB from this alone. |
| Needs approval (changes `angular.json` or dependencies) | Slim the Material theme to dialog tokens (up to 8 kB less); remove the unused `leaflet.heat` dependency |

A design pass alone doesn't bring the initial bundle (556 kB) under 500 kB. That needs item 8 in §16.
After item 9 the initial bundle is 528.45 kB (145.6 kB transfer), from 545.52 kB at the start of the redesign; after item 10 and the store fixes, 529.46 kB (145.87 kB transfer): the shell's toast rule and the catalog effect are in the initial bundle. The budget is left as it is for now (decided Nov 20, 2026); the rest of the way needs §16 #8 and the approval row above.
`leaflet.css` keeps a fixed name (`inject: false` bundles aren't content-hashed), so after a deploy a browser can keep the old map styles until it revalidates. The fix is a server header (`Cache-Control: no-cache` on `leaflet.css`, which still allows a 304) or, with approval, an `angular.json` change; a version taken from the main script's hash wouldn't follow changes to the stylesheet itself.

---

## 18. Specimens and evidence

| File | Shows |
|---|---|
| [design-audit/AUDIT.md](design-audit/AUDIT.md) | The audit, the directions, fonts, the marker and the layout decision |
| [directions/unavailable.html](design-audit/directions/unavailable.html) | The final unavailable marker in a record, partial totals, a table, next to real controls, and the five states |
| [layouts/specimen.html?l=desk](design-audit/layouts/specimen.html) | The pro Desk: lender applications with a record pane (desktop, phone list, phone record) |
| [layouts/property.html](design-audit/layouts/property.html) | The public shell on the property page (`?u=guest` for signed out), with the time-axis sales chart |
| [layouts/explore.html](design-audit/layouts/explore.html) | Explore with the docked map slot |
| `design-audit/layouts/make-data.cjs` | Rebuilds `layouts/data.js` from the mock fixtures |
| `design-audit/specimen-shots.cjs` | Re-takes every specimen screenshot |

Where a specimen and this file disagree, this file wins. For example, the layout specimen sets the
pane's ZentraValue figure with tabular numerals; §3 says proportional.
