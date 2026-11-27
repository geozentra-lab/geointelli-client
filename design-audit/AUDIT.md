# Design audit: GeoZentra property client

Branch `design-refresh`, based on 155e9c0 plus the uncommitted working tree (endpoint adaptation and
NgRx migration), audited as-is on 2026-11-18. Nothing in `src/` was changed. This document covers
**step 1 (audit)** and **step 2 (directions)**. Implementation waits for your pick.

- [How it was produced](#how-it-was-produced)
- [What rendered and what did not](#what-rendered-and-what-did-not)
- [Top findings](#top-findings)
- [1. System](#1-system) · [2. CLAUDE.md rules](#2-claudemd-rules-check) · [3. Unavailable values](#3-missing-values-unavailable) · [4. Data density](#4-data-dense-screens) · [5. Pages](#5-page-notes) · [6. Quality floor](#6-quality-floor) · [7. Bundle](#7-bundle-baseline) · [8. Needs backend/store work](#8-needs-backend-or-store-work)
- [Step 2: directions](#step-2-directions)

---

## How it was produced

```
npx ng build --output-path design-audit/.build          # production build, same as `ng build`
node --experimental-websocket design-audit/capture.cjs  # all shots; add --only <name> for some
node design-audit/mock/server.cjs                        # mock alone: app on :4310, API on :8081
```

| Part | What it does |
|---|---|
| [mock/server.cjs](mock/server.cjs) | Serves the build, `/api/*` (also on `localhost:8081`, which `environment.ts` hard-codes), `/notification-api/*`, a fake Keycloak under `/kc/*`, and `/__mock/state` to set persona, admin role, scenario and signed-in state. No dependencies. |
| [mock/fixtures/](mock/fixtures/) | Five modules (catalog, account, investor, realtor, lender-admin), 130+ routes covering every call in `src/app/data-access`. Shapes follow `src/app/core/models`. Each has a `full` scenario (populated, with partial and unavailable values on purpose) and an `empty` one (new account). Shared property ids 42–49 in [_shared.cjs](mock/fixtures/_shared.cjs) keep pages consistent with each other. |
| [capture.cjs](capture.cjs) + [shots.cjs](shots.cjs) | Drives installed Chrome over the DevTools protocol (no Puppeteer). Intercepts every request to the Keycloak host and answers it from the mock, so keycloak-js runs its real check-sso → code → token flow with a token carrying the chosen realm roles. Writes `screenshots/*.png` and [capture-log.json](screenshots/capture-log.json). |
| [directions/specimen.html](directions/specimen.html) | Step 2 specimens: one portfolio screen in three directions (`?d=a`, `b`, `c`). |

**Auth mock:** the real identity server and backend are never contacted. A shot is "signed in" when
the top bar reads *Sign out* after the redirect round trip; the log records this per shot. Admin
pages get the `admin` realm role from the fake token; personas come from `/users/me`.

**Read the screenshots with these caveats:**
- All data is synthetic. Addresses use the Miami-Dade grid format so string lengths are realistic; owners, prices and scores are invented.
- The repo has one property photo (`src/assets/images/property.webp`), so every property with photos shows the same modern pool house. Properties 46 and 48 deliberately have none.
- Fonts (Google Fonts) and map tiles (Esri, OpenStreetMap) load from their public CDNs. Parcel polygons are synthetic squares drawn at fixture coordinates, so they do not line up with real lots on the imagery.
- Reduced motion is on in all shots, so entrance animations are not visible.

## What rendered and what did not

68 shots, every one signed in or guest as intended. No fixture is missing and no runtime exception is logged.
Widths: desktop 1440, laptop 1280, phone 390. Full-page height is capped at 7,000 px.

| Area | Personas and states captured | Shots |
|---|---|---|
| Overview `/dashboard` | guest; buyer, investor, realtor, lender, each full and empty; phone | [guest](screenshots/guest-dashboard.png) · [buyer](screenshots/buyer-dashboard.png) · [buyer empty](screenshots/buyer-dashboard-empty.png) · [investor](screenshots/investor-dashboard.png) · [investor empty](screenshots/investor-dashboard-empty.png) · [realtor](screenshots/realtor-dashboard.png) · [realtor empty](screenshots/realtor-dashboard-empty.png) · [lender](screenshots/lender-dashboard.png) · [lender empty](screenshots/lender-dashboard-empty.png) · [phone](screenshots/mobile-buyer-dashboard.png) |
| Explore `/explore`, `/explore/live` | guest, buyer, phone; live map; property dialog | [grid](screenshots/buyer-explore.png) · [guest](screenshots/guest-explore.png) · [live map](screenshots/guest-explore-live-map.png) · [dialog](screenshots/buyer-property-dialog.png) · [notifications open](screenshots/buyer-notifications-open.png) · [phone](screenshots/mobile-buyer-explore.png) |
| Property `/property/:id` | all six tabs for 42; 46 (no valuation); 49 (gaps); guest; phone | [overview](screenshots/buyer-property-42-overview.png) · [value](screenshots/buyer-property-42-valuation.png) · [location](screenshots/buyer-property-42-location.png) · [sales](screenshots/buyer-property-42-sales.png) · [features](screenshots/buyer-property-42-features.png) · [comparables](screenshots/buyer-property-42-comparables.png) · [46](screenshots/buyer-property-46-no-valuation.png) · [49](screenshots/buyer-property-49-gaps.png) · [guest](screenshots/guest-property-42-overview.png) · [phone](screenshots/mobile-buyer-property-42.png) |
| Compare, Opportunities | empty compare, comparable sales; scored and matched tabs | [compare empty](screenshots/buyer-compare-empty.png) · [comparables](screenshots/buyer-compare-42.png) · [scored](screenshots/buyer-opportunities-scored.png) · [matched](screenshots/buyer-opportunities-matches.png) |
| Investment studio | mortgage, affordability, rental | [mortgage](screenshots/buyer-investment-mortgage.png) · [affordability](screenshots/buyer-investment-affordability.png) · [rental](screenshots/investor-investment-rental.png) |
| Portfolio | full, empty, laptop, phone | [full](screenshots/investor-portfolio.png) · [empty](screenshots/investor-portfolio-empty.png) · [laptop](screenshots/laptop-investor-portfolio.png) · [phone](screenshots/mobile-investor-portfolio.png) |
| Saved, Alerts, Settings | full and empty; buyer and realtor (licence) settings; guest saved | [saved](screenshots/buyer-saved.png) · [saved empty](screenshots/buyer-saved-empty.png) · [guest saved](screenshots/guest-saved.png) · [alerts](screenshots/buyer-alerts.png) · [alerts empty](screenshots/buyer-alerts-empty.png) · [settings](screenshots/buyer-settings.png) · [licence](screenshots/realtor-settings-license.png) |
| CRM `/crm/*` | all five tabs, empty, phone | [overview](screenshots/realtor-crm-overview.png) · [clients](screenshots/realtor-crm-clients.png) · [leads](screenshots/realtor-crm-leads.png) · [tasks](screenshots/realtor-crm-tasks.png) · [deals](screenshots/realtor-crm-deals.png) · [empty](screenshots/realtor-crm-empty.png) · [phone](screenshots/mobile-realtor-crm-leads.png) |
| Loan review | four tabs, empty org, laptop, phone | [pipeline](screenshots/lender-loan-review-pipeline.png) · [applications](screenshots/lender-loan-review-applications.png) · [import](screenshots/lender-loan-review-import.png) · [team](screenshots/lender-loan-review-team.png) · [no org](screenshots/lender-loan-review-empty.png) · [laptop](screenshots/laptop-lender-applications.png) · [phone](screenshots/mobile-lender-applications.png) |
| Admin | three pages full and empty; non-admin; phone | [import jobs](screenshots/admin-import-jobs.png) · [data quality](screenshots/admin-data-quality.png) · [valuations](screenshots/admin-valuations.png) · [jobs empty](screenshots/admin-import-jobs-empty.png) · [quality empty](screenshots/admin-data-quality-empty.png) · [valuations empty](screenshots/admin-valuations-empty.png) · [non-admin](screenshots/nonadmin-admin-page.png) · [phone](screenshots/mobile-admin-data-quality.png) |
| Other | AIZentra placeholder, 404 | [assistant](screenshots/buyer-assistant.png) · [404](screenshots/guest-not-found.png) |

**Could not render, or not covered:**
- **Keycloak's own sign-in and sign-up pages** (`keycloak/themes`). They are served by Keycloak, which the audit replaces with a mock, so they were not seen.
- **Loading skeletons and per-card error states.** The mock answers immediately, so skeletons never show. `account.cjs` has a switch to fail a dashboard card (`{"cardErrors":["activity"]}`), but no shot uses it. The offline banner and request timeouts were not triggered.
- **Interaction states.** Edit forms, confirm-delete dialogs, the holding property picker's result list, the compare tray with selections, file uploads on import pages and the CRM history drawer were not opened. The notification menu and the property dialog were.
- **Mobile navigation drawer** open, and tablet widths between 650 and 1280.
- **Map accuracy.** Tiles are real and parcels synthetic, so the map shots show the chrome and the overlay styling, not real parcel fit.

---

## Top findings

1. **Pro screens are not tables.** Loan applications, CRM leads, tasks, deals, alert rules and opportunities render as stacked text rows or card grids, with figures inside sentences ("Conventional · requested $1,180,000 · approved …"). 22 loan applications take 3,878 px on desktop and 6,526 px on a phone. None of the app's 18 `<table>`s has a sticky header or sortable column headers. Sorting exists only as dropdowns on Explore and Opportunities.
2. **The same unknown is shown three ways.** Partial portfolio value is the headline "$4.14M, Partial: 5 of 7" on the investor overview, "Unavailable" with the known part in fine print on Portfolio, and Equity is a partial sum with no label at all. The policy (null is unavailable, never 0) holds in code. What's missing is one shared visual for unknown, partial and zero.
3. **Zeros and placeholders still leak** where nothing is known: "Matches for you 0" with no preferences, "$0" cash flow with no records, "0 pending · 0 published · 0 failed" on new rules, "0 / 0" queued jobs, "0 mi", "Folio null", "data through ·". (Details in §3.)
4. **Every page uses the same template chrome:** an uppercase tracked eyebrow, a slogan for a heading ("Every relationship, in one place.", "Good decisions start with your numbers."), a subtitle, then a grid of white cards. Every persona's Overview ends with the same three consumer cards and six identical shortcut cards, including the lender's and realtor's.
5. **Forms come before the data.** Portfolio, Alerts, CRM and Loan review put a "Create …" form above the list it adds to, so returning users scroll past an empty form on every visit.
6. **Developer words reach users:** `generatedAt`, `coveragePercent`, `CASH_BASIS`, `ORGANIZATION`, `UNSUPPORTED_SOURCE`, `WEBSITE`, `yearBuilt`, `BROKER_SOUTHDADE`, `comparable-selection-v3`, 13-digit folios with no separators.
7. **The token system exists but isn't used:** 136 distinct hex colours against about 20 tokens, 23 font sizes from 9 px to 30 px (including 12.5 and 13.5), 20 border-radius values.
8. **Contrast fails AA** for the muted caption colour (3.66:1 on the page background), white on the copper button (3.97:1), copper links (3.67–3.97:1) and placeholders (2.49:1).
9. **Visible bugs:**
   - The recommendation chips on the buyer overview overflow their cards into the next column ([buyer-dashboard](screenshots/buyer-dashboard.png)).
   - The property dialog's backdrop does not cover the sidebar ([dialog](screenshots/buyer-property-dialog.png)).
   - On phones the sale-history tiles are clipped and chart labels are about 8 px ([phone](screenshots/mobile-buyer-property-42.png)).
   - The sale-history chart spaces sales by event, not by time, so 2008, 2019 and 2026 sit at equal steps.
10. **A design pass can't fix the bundle on its own.** CSS is 58 kB of the 556 kB initial bundle, so a restyle can recover about 11–20 kB of the 56 kB overage. The rest is Angular, keycloak-js and NgRx slices registered eagerly (§7).

---

## 1. System

### Colour
`styles.css` defines tokens (`--ink #172735`, `--ink-2 #526773`, `--muted #77818b`, `--paper #f5f6f7`,
`--copper #ad724c`, status trios), but 136 distinct hex values are spread across styles and component
templates. Examples: `#f0f3f4`, `#f0f2f3`, `#eaf0f1`, `#edf1f2`, `#edf1f4` are all "light grey surface",
and `#d73550` is the favourite heart. The Material theme compiles **azure/blue M3 palettes**
(`material-theme.scss`) that are used only by dialogs. There is no dark mode.

The identity is a navy sidebar, a copper accent, a near-white page and white cards. The copper sits
close to the warm-clay accent that reads as a generic default.

### Type
- Two families: DM Sans (body) and Manrope (headings). At UI sizes they are hard to tell apart, so the pair costs a second font file (24 kB) without giving contrast.
- 23 font sizes, the most common being 12 (47 uses), 13 (35), 11 (24), 14 (21) and 10 (10). Labels down to 9–10 px.
- Tabular numerals appear in 12 rules, so most money columns don't align.
- The only `position: sticky` in the app is the Explore map container.
- Headings are slogans, not page names. The page name sits in the breadcrumb and an uppercase eyebrow, so every page states its title three times.

### Shape, elevation and motion
- 20 radius values (50%, 8, 10, 99, 6, 5, 3, 4, 14, 7, 2, 20, 12 …).
- Seven different box-shadows.
- Motion (`styles.css` 1859–2094, 5.5 kB): pages fade in, cards rise in a staggered order, a copper conic-gradient ring "draws itself" around hovered cards, buttons lift, sidebar icons slide. That is the scattered-effects pattern.

### Components
- **KPI tile** (`gz-kpi`, `.metric`, `.stat`): an icon in a tinted square, a label, a large number and a caption. It is used in rows of four on every overview, CRM, loan review and portfolio page.
- **Panel:** a white card with a 1 px border. Panels hold inner tiles: Value/Debt/Equity on the investor overview and Approved/Funded/Period on the lender overview. Those are cards inside cards.
- **Row list:** title, tag, two or three lines of meta joined with " · ", and a cluster of 2–4 buttons on the right. It is used for loans, leads, tasks, deals, alert rules and saved searches.
- **Icons:** 20 hand-drawn single-path SVGs, 1.3 kB in total. Overview and Import jobs share the grid icon; Opportunities and Valuation operations share the chart icon.

### Shell
- The sidebar lists every module to every persona: a buyer sees Loan review and Clients & deals.
- An admin sees a "Buyer" persona select.
- The nav group label "YOUR WORKSPACE" is 10 px, uppercase, with 2 px tracking.
- The footer slogan repeats on every page.

## 2. CLAUDE.md rules check

| Rule | Status | Evidence |
|---|---|---|
| No purple/blue gradients, glassmorphism, glow, emoji | Mostly kept | No emoji. In the property dialog, the value card uses a navy `linear-gradient(145deg, #203d4a, #172c3b)` and the price range track a three-stop gradient (`property-detail-component.css:233, 295`). The Material theme is azure/blue. |
| No grid of identical cards | **Broken** | Shortcut grid (6) on every overview, opportunities (6 cards), explore (25 photo cards), recommendations (6), saved/searches/alerts trio. |
| No cards nested in cards | **Broken** | Investor "Value, equity and debt", lender "Approved, funded", income/expenses empty box inside a panel. |
| No everything-centred layouts | Kept | Empty states are centred inside their boxes, which is acceptable. |
| No rounded-everything with big soft shadows | Partly | Shadows are light, but every container is a rounded card. |
| No filler copy | **Broken** | "A place for your next chapter.", "Every parcel. A clearer perspective.", "The bigger picture, property by property.", "Intelligence for every square foot." |
| No number in a decorative tile | **Broken** | `gz-kpi` icon tiles everywhere; the sale-history price tiles. |
| Pro screens: tables, tabular numerals, aligned columns, sticky headers, sortable | **Broken** | See §4. |
| Show only backend data; honest empty states | Mostly kept | Data is honest. Empty states often show zeros instead of a next step (§3). |
| NgRx: components read selectors and dispatch | Kept | No service calls from components found; not changed by a design pass. |

## 3. Missing values ("unavailable")

**What already works.** `usdCompact` and `amount()` return null. `gz-kpi` shows "—" with "Not available
yet". Portfolio prints "Unavailable" with coverage ("3 / 5 holdings covered"). Property 46 explains
*why* there is no estimate ([shot](screenshots/buyer-property-46-no-valuation.png)). The opportunity
score never counts a missing factor as 0.

**Where it breaks.** Shot links are verified in a screenshot. Bare `file:line` references come from
reading the code while writing fixtures; I spot-checked five and they matched.

| Kind | Where |
|---|---|
| Same unknown, different treatment | Investor overview headline "$4.14M, Partial: 5 of 7" vs Portfolio "Unavailable", with the known portion in 11 px fine print ([overview](screenshots/investor-dashboard.png), [portfolio](screenshots/investor-portfolio.png)). Equity tile is a partial sum with no label (`investor-dashboard.ts:94-95`). Occupancy is "Unknown" on Portfolio (`portfolio.html:227`) and "Not set" on the overview. |
| Zero standing for "none" | "Matches for you 0" when status is NO_PREFERENCES (`buyer-dashboard.ts:75`). "$0" income/expenses/cash flow with no records (`portfolio.html:148-162`, `investor-dashboard.ts:368`). "0 pending · 0 published · 0 failed" on new rules ([alerts](screenshots/buyer-alerts.png)). Queued job "0 / 0" (`import-jobs.ts:219`). "0% · $0" factor (`property-valuation.ts:325`). "0 mi" fallback (`comparables-map.ts:54`). "0 records" owners (dialog). A $0 deed transfer listed as a sale (`property-detail.html:258`). |
| Correct zero, poor design | New realtor: four "0" tiles and six empty bars with no "Add your first client" action ([crm empty](screenshots/realtor-crm-empty.png)). Lender org with no approvals: "$0" tiles. |
| Unavailable as noise | Property 46: seven factor rows each saying "Unavailable: No supported valuation…" when one line would cover all seven. |
| Leaked placeholders | "Folio null" (`dashboard-overview.ts:42`, `dash-ui.ts:273,377`, `opportunities.ts:167`). "data through ·" (`property-opportunity.ts:99`). " · /100" (`property-detail.html:161,215`). "1 searches" (`saved.ts:91`). |
| Contradictions | "Matched to your budget" when the response says budget was not applied (`dash-ui.ts:246`). "View valuation" on loans whose property has no valuation ([lender overview](screenshots/lender-dashboard.png)). Pipeline cards say "requested" for approved and funded sums (`loan-review.html:143,150`). |

**Proposed rule for any direction.** It keeps the word "Unavailable", which specs and the browser check assert.

| State | Meaning | Shown as |
|---|---|---|
| Unavailable | The backend has no value | The word *Unavailable* in the direction's unavailable style, never 0, with the reason on hover or in a caption. In tables the cell keeps its column alignment. |
| Partial | An aggregate over some of the records | The known amount, labelled *known portion*, plus coverage ("3 of 5 valued") as a small meter. Same treatment on every page. |
| Zero | A recorded zero | `$0` with context where it could be mistaken ("owned outright"). |
| Not applicable | The field doesn't apply | Omitted. A whole section that doesn't apply collapses to one sentence. |
| Empty collection | No records yet | One sentence on what will appear and the button that creates the first one. No zero tiles. |

## 4. Data-dense screens

| Screen | Now | Records shown, page height (desktop) | Sort | Sticky header | Issue |
|---|---|---|---|---|---|
| Loan review, applications | row list | 20 of 22, 3,878 px | no | n/a | Amounts in prose; four buttons per row; create form above the list |
| CRM leads, tasks, deals, clients | row list | 18 leads, 3,235 px | no | n/a | Raw source codes; the service has no sort or search parameters |
| Alert rules | row list | 7, 2,193 px | no | n/a | Seven meta lines per rule |
| Opportunities | 3-column cards | 6 | dropdown | n/a | A ranked list drawn as cards |
| Explore | 3-column photo cards | 25 over two pages, 3,560 px | dropdown | n/a | No value per card (backend has no listing price); same placeholder photo |
| Portfolio holdings | table | 5 | no | no | No value, debt or LTV per holding: the API doesn't return them (§8) |
| Financial records | table | 17 | no | no | Income and expense amounts look the same |
| Admin tables | tables | ok | no | no | Rule ids and error codes shown raw |
| Comparable sales | table | 3 | no | no | Radius entered in metres, distance shown in miles; similarity is "0.8" here and "83% match" on the map |
| Valuation history | table | 10 | no | no | Fine |

## 5. Page notes

- **Overview, all personas.**
  - Four icon-tile KPIs, two columns of panels, then the same saved/searches/alerts trio and six shortcut cards for every persona.
  - The lender page is 2,855 px and the realtor page 2,727 px.
  - Pro overviews spend half their height on consumer cards.
- **Explore.**
  - The filter row wraps to three lines at 1440.
  - Folios show as 13 raw digits.
  - Cards with no data read "— beds — baths — sqft · Year unknown".
  - Sorting by year puts unknown years first.
- **Property.**
  - The address appears twice.
  - The sale-history block sits above the tabs, so every tab starts 1,000 px down.
  - The Value tab is 6,315 px: estimate, fan chart, drivers, comparables, method, opportunity table and history, then the contact form again.
  - The contact form appears on every tab.
  - The two charts on the page don't share a style.
- **Property dialog.** A third presentation of the same record (page, card, dialog), with its own CSS (7.3 kB, over its 4 kB budget) and gradients.
- **Compare.** The cleanest table in the app. Unit mismatch, `Missing: yearBuilt`, and model version strings in the footer.
- **Portfolio.** Order: create-portfolio form, selector, summary, holdings, add-holding form, records, add-record form (4,512 px). The partial-value presentation conflicts with the overview.
- **Alerts.** Create form first; each rule has seven lines of status and four buttons. "Evaluate now" is disabled with no reason given. BLOCKED is called "The last check failed".
- **CRM.** The heading is a slogan. In the overview, "Open tasks" counts open only, while the dashboard counts open plus in progress. The activity "View" link switches tab but doesn't select the record.
- **Loan review.** A disclaimer callout at the top, a create form, then a list instead of a table. "Imported from BROKER_SOUTHDADE (SD-2238)". The Team tab shows bare "User 112" ids.
- **Admin.**
  - The 403 state is clear ([non-admin](screenshots/nonadmin-admin-page.png)).
  - Data quality is a reasonable table, but with no empty message when a rule has 0 issues, and "row N" actually shows a source id.
  - Raw `errorCode`/`lastErrorCode`.
- **Phone.**
  - Charts shrink rather than reflow.
  - Sale tiles are clipped.
  - The five header buttons wrap to two rows.
  - Loan applications run to 6,526 px.

## 6. Quality floor

| Pair | Ratio | AA (4.5:1 text) |
|---|---|---|
| `--muted` #77818b on white / paper | 3.96 / 3.66 | fail |
| white on copper #ad724c (primary button) | 3.97 | fail |
| copper text on white / paper | 3.97 / 3.67 | fail |
| placeholder #9aa6ad on white | 2.49 | fail |
| warning #a67131 on warning-bg | 3.79 | fail |
| `--ink-2`, danger, green on their backgrounds | 4.69–5.47 | pass |

What's in place: focus rings, the skip link, live regions and the reduced-motion handling.

What's wrong:
- 10–11 px labels.
- The dialog backdrop stacks under the sidebar.
- Tabs scroll horizontally on phones with no visible cue.
- Disabled buttons give no reason.

## 7. Bundle baseline

Production build of this working tree. The figures come from the build output and the `--stats-json` metafile.

| | Raw | Transfer |
|---|---|---|
| **Initial total** (budget 500 kB) | **555.98 kB** | 150.5 kB |
| Angular core, router, common, platform | ~266 kB | |
| keycloak-js | 25.6 kB | |
| rxjs | 24.9 kB | |
| NgRx store, entity, effects | 22.9 kB | |
| App code, including store slices registered eagerly (lender 8.4, crm 7.0, portfolio 6.1, catalog 5.2 …) | ~150 kB | |
| **Global CSS** `styles-*.css` | **58.0 kB** | 11.5 kB |
| of which `styles.css` | 38.6 kB | |
| of which `leaflet.css` (global, though maps are lazy) | 11.1 kB | |
| of which the Material theme (dialogs only) | 8.4 kB | |
| Lazy: Material dialog + CDK | 98 kB | |
| Lazy: Leaflet JS | 150 kB | |
| **Web fonts** (Google Fonts; not part of the budget) | DM Sans 36.1 kB + Manrope 24.0 kB = **60.1 kB** | 2 requests |

**What a design pass can recover:**
- Move `leaflet.css` from `angular.json` styles into the two map components: −11.1 kB. This changes `angular.json`, so I'd ask first.
- Scope or slim the Material theme to dialog tokens: up to −8 kB.
- Shrink `styles.css` with a strict token set and no motion section: an estimated −5 to −10 kB.

That is roughly 11–20 kB at most, so the bundle stays over 500 kB without non-design work (§8).

## 8. Needs backend or store work

Nothing here was added or faked. Each item is something a design would want and the app can't currently supply.

| Need | For | Kind |
|---|---|---|
| Per-holding value, debt, LTV and coverage in the holdings response | A holdings table that shows which rows are unvalued | backend |
| Deal value and lead budget in CRM | Money columns in the deals and leads tables | backend |
| Member names for lender organizations | Team tab without "User 112" | backend |
| Client names in CRM activity entries | Readable activity feed | backend |
| Listing prices | Card prices, LISTING_PRICE_CHANGED alerts (blocked today), the "discount to estimate" factor | backend |
| `sourceAsOf` on recommendations (always null) | "Records as of …" freshness | backend |
| Sort and search parameters on CRM, lender applications and alert lists | Sortable tables beyond the current page | backend |
| A notification inbox (more than the 5 loaded; mark all read) | Unread count that isn't capped at 5 | store and UI (the API pages already) |
| Holding and application coordinates or parcel geometry, batch-loaded | Direction C's map panels | store (catalog lookups per holding) |
| Moving eagerly registered slices (lender, crm, portfolio, catalog …) to route-level feature stores | Getting initial JS under budget | store. On the HANDOFF fragile list (`appReducers` vs `featureStores`); needs your go-ahead. |
| Persona-aware navigation (hide Loan review from buyers, etc.) | A shorter sidebar per persona | UI only: the persona is already in the store, but it is a product decision |

---

## Step 2: directions

Three directions, from least to most change. Each is rendered on the **same portfolio screen** in
[directions/specimen.html](directions/specimen.html) (`?d=a|b|c`). That screen was chosen because it
has partial totals, unavailable cells, a real `$0`, a chart and an empty state. The specimen numbers
are illustrative.

All three share these changes, whichever you pick:
- **Headings.** Page name as the h1. No eyebrow, no slogan.
- **Tables first.** Pro lists become tables with sticky headers, sortable columns (client-side within the page until §8 lands), right-aligned tabular numerals and one row action plus an overflow menu.
- **Forms on demand.** Create forms move behind a "New …" button into a side sheet.
- **Summary strip.** KPI tiles become an inline strip with rules between figures.
- **One unavailable language** from §3.
- **Motion.** Only motion that answers an action; the staggered entrances, trace ring and button lift go.
- **Contrast.** Every pair passes AA.

None needs a chart library. The existing charts are hand-written SVG and stay that way, restyled.

### A. Navy and copper, disciplined

![Direction A](screenshots/directions/direction-a.png)

- **Palette:**
  - Ink `#172735` for the sidebar and text.
  - Paper `#F5F6F7`, surface `#FFFFFF`.
  - Copper `#8A5636` for actions and links (6.06:1).
  - Ink-2 `#4E6170` (5.94:1).
  - Positive `#23695B`, negative `#A63E32`.
- **Type:** DM Sans only. Scale 12 / 13 / 14 / 16 / 20 / 28, weights 400/500/600, tabular figures on every number.
- **Layout:** today's shell, tightened. Figures sit in a ruled strip, not tiles; lists become tables.
- **Unavailable:** the word *Unavailable* in ink-2, with the reason as a caption. Partial figures get a five-step coverage meter.
- **What it keeps:** the recognisable identity. Spec selectors (`.kpi-value`, `.stages a`) can keep their class names.
- **Risk:** the least distinctive. It stays close to a generic navy SaaS console, and copper is near the warm-clay default.

### B. Public record (recommended)

![Direction B](screenshots/directions/direction-b.png)

The data is county public record: folios, assessments, deed transfers. The tagline is "with
evidence". B takes its look from property-record cards and appraisal forms rather than from
dashboards.

- **Palette:**
  - Ink `#0F1E26`.
  - Canvas `#F1F3F2`, surface `#FFFFFF`.
  - Registry green `#0D5F50` for actions, links and positive figures (7.58:1).
  - Pencil red `#A8361D`, kept for attention: overdue, negative, errors (6.54:1).
  - Rules `#DBE1DF` / `#A9B6B2`.
- **Type:** Public Sans (USWDS, made for public data) 400–700, one variable file. Scale 12 / 13 / 14 / 15 / 18 / 24 / 30. Folios formatted the way the county prints them (`01-4137-012-0450`).
- **Layout:**
  - Light sidebar with an ink active bar.
  - A record header: address as the h1, then folio, county and use.
  - The summary strip sits under a 2 px ink rule, like the top of a form.
  - Sections are separated by headings and rules, not boxed in cards.
  - 3 px radius on controls.
- **Unavailable, the one memorable thing:** a missing value is drawn as a hatched blank field labelled *Unavailable*, like an unfilled box on a paper form. It can't be mistaken for zero, and a column of them shows at a glance where the record is thin. Partial totals show filled and empty squares, like checkboxes on a form.
- **Risk:**
  - Of the three, B is the closest to the hairline-rules "broadsheet" default. The hatched fields, the form-like summary and the non-zero radius are what keep it from becoming that.
  - Buyer pages could feel austere. Keep the property photos where they exist; don't depend on them.

### C. Map-led, semi-condensed

![Direction C](screenshots/directions/direction-c.png)

- **Palette:**
  - Ink `#1D2A2F`.
  - Land `#EEF0EB`, surface `#FFFFFF`.
  - Water blue `#1F5F8B` for actions and valued parcels (6.84:1).
  - Highlighter `#F2C230`, for selection only.
  - Positive `#2C6B3F`, negative `#A33B2B`.
- **Type:** Archivo with its width axis. Normal width for interface text, 82% width in tables so more columns fit.
- **Layout:**
  - A 64 px icon rail.
  - Explore, portfolio, loan review and comparables become split views: a table beside a sticky map that shows the same rows.
  - The selected row and its parcel share a highlighter edge.
- **Unavailable:** an outlined, unfilled mark. The same encoding on the map (an unvalued parcel is outlined) and in the table.
- **Needs:** coordinates or geometry per holding and per application (§8, store work). Leaflet and external tiles load on more pages.
- **Risk:**
  - The biggest change.
  - The outline marker read as a checkbox in the specimen and would need a parcel-shaped glyph.
  - The tile providers' usage policies apply on more pages.

### Cost of each direction

Fonts are latin woff2 files measured from Google Fonts today. CSS figures are estimates until built.
Chart library figures are approximate published sizes, not measured here. Any new dependency needs
your approval first.

| | A | B | C |
|---|---|---|---|
| Web fonts (not part of the Angular budget) | DM Sans 36.1 kB, 1 file: **−24.0 kB** vs now | Public Sans 26.2 kB, 1 file: **−33.9 kB** | Archivo with width axis 88.0 kB, 1 file: **+27.9 kB** |
| Initial CSS (inside the budget) | est. −5 to −10 kB | est. −5 to −10 kB | est. −2 to +2 kB (new split-view rules offset the removals) |
| Optional CSS moves (need an `angular.json` change) | leaflet.css lazy −11.1 kB; Material theme slimmed up to −8 kB | same | Material up to −8 kB; leaflet.css stays global (maps everywhere) |
| Chart library | none (hand SVG) | none | none |
| If you want interactive charts later | uPlot, about 47 kB min / 21 kB gz, lazy on the property page only. Chart.js is about 4× that and not worth it here. | same | same |
| Icons | current 20-path set; about 10 new icons at ~80 bytes each | same | same, plus a parcel glyph |
| Lazy JS by page | no change | no change | Leaflet (150 kB) also loads on portfolio, loan review and compare |
| Spec impact | low: class names kept, copy kept | medium: markup moves to tables; specs asserting `.stages a`, `.kpi-value` and copy need updating | high: same as B, plus new map panels |

**Recommendation: B.**
- It suits the product's subject and its "evidence" promise.
- It makes the unavailable state the visual signature, and that state is the one you asked to be designed well.
- It has the cheapest fonts.
- It reads densest without condensed type.

If you'd rather keep the current identity, A with B's hatched unavailable fields and coverage
squares is a sound middle path. C is worth it only if maps are central to how lenders and investors
work, and it needs the store work in §8 first.

**Pick A, B or C (or a mix), and I'll write DESIGN.md from it before touching `src/`.**

---

## Step 3: fonts, the unavailable marker, and the app layout

Your pick: Direction A as the base (navy and copper, tables first, DM Sans), with B's missing-value
treatment and ruled sections on data-heavy screens. The map beside the table is used on Explore and
comparables only. Specimens added:
- [directions/unavailable.html](directions/unavailable.html): the final unavailable marker.
- [layouts/specimen.html](layouts/specimen.html): the two layouts (`?l=desk`, `?l=register`). Add `&h=manrope` for Manrope headings.

Screenshots are made with `node design-audit/specimen-shots.cjs`. Phone widths render inside
[frame.html](frame.html), because headless Chrome on Windows won't lay out a window narrower than
about 500 px. All figures in the specimens come from the mock fixtures.

### 1. Fonts: Manrope for headings only

Measured today from Google Fonts (latin woff2, the subset an English page downloads):

| Setup | Font files | Size | vs now | vs DM Sans only |
|---|---|---|---|---|
| Now: DM Sans 400–700 and Manrope 400–800 | 2 | 60.1 kB | | +24.0 kB |
| **DM Sans only** | 1 | **36.1 kB** | −24.0 kB | |
| **DM Sans and Manrope 700 for headings** | 2 | **50.2 kB** | −9.9 kB | **+14.1 kB** |
| (Manrope 600 alone: 14.0 kB; Manrope 800 alone: 13.6 kB) | | | | |
| DM Sans with its optical-size axis, as an alternative to a second family | 1 | 61.3 kB | +1.2 kB | +25.2 kB |

- **Cost of Manrope at one weight: +14.1 kB and one more font file.** Google serves a single weight as a smaller static file, not the 24 kB variable one. The file comes from the CSS request that already exists and from the host that is already preconnected.
- **Budget:** web fonts are outside the Angular 500 kB budget, so this choice doesn't help or hurt the overage.
- **Load behaviour:** headings swap on their own, which adds one more reflow on a first visit. A fallback face with `size-adjust` (about 0.3 kB of CSS) keeps the shift small.
- **What you get for it:** compare [desk.png](screenshots/layouts/desk.png) with [desk-manrope.png](screenshots/layouts/desk-manrope.png). At 20–24 px the two faces are hard to tell apart, which is the step 1 finding again.
- **Recommendation:** DM Sans only. Let the ZentraValue block and the rail carry the identity. Manrope earns its 14 kB only if some heading is set at 32 px or larger, and none is planned.

### 2. Unavailable marker: final treatment

![Unavailable marker](screenshots/directions/unavailable.png)

What changed from B, and why it can't be read as a control:

- **The bordered white label inside the hatch is gone.** It was a white box with a border, which is exactly what an input looks like.
  - The hatch now belongs to the cell: it runs from rule to rule, with no border, fill or corner of its own.
  - The word *Unavailable* sits where the number would, in the column's own alignment. In money columns that is the right edge, where no input puts its placeholder.
- **B's coverage squares are gone.** Filled and empty squares were checkboxes. Coverage is now one proportional bar, and its missing share uses the same hatch.
- **Real controls are pulled further away:**
  - Inputs and checkboxes get a 3.46:1 border (`#7D8C97`), a white fill, 4 px corners and a fixed 34 px height.
  - The marker has none of those, never changes on hover or focus, and keeps the arrow cursor.
  - The specimen sets them side by side, with a loading skeleton.
- **The hatch means one thing only: missing data.** It is never used for disabled controls, skeletons (solid and wordless), selection or not-applicable cells (blank).
- **Contrast:** the word is ink-2 `#4E6170`, 6.43:1 on white. Where a hatch line crosses a letter it is still 4.82:1.
- **Accessibility:** in forced-colours mode the hatch drops out and the word stays. Screen readers hear the reason after the word.
- **Reasons are written out, never hover-only:**
  - Under the group when adjacent fields share a reason (bedrooms, bathrooms and year built on 11960 SW 186th St).
  - Under the table.
  - Inside a merged span when a block of cells is missing for one reason (the condo-hotel unit's four valuation rows).
- **Partial figures:**
  - The figure is always followed by "Partial: 3 of 5 holdings valued" (the asserted text kept), with *Partial:* in the attention colour.
  - Debt and equity use the same pattern.
  - Cash flow shows coverage but no Partial label, because the backend reports it as complete by definition.
- **Charts and maps:**
  - A month with no records is a hatched column spanning the full plot height.
  - A parcel with no ZentraValue is hatched and outlined in ink.

**Needs backend work (new):** a "not applicable" signal. Lot size on condominium units comes back
as null, the same as a missing value, so the UI can't tell N/A from Unavailable and has to show
Unavailable.

### 3. Layout: two concepts

Personas split two ways:
- **Public:** guests and buyers (`USER`).
- **Pro:** investors, realtors, lenders and admins.

Both concepts are drawn on the same pro screen: loan applications for Biscayne Community Lending,
page 1 of 22, with application 1041 selected. That screen was chosen because the two concepts differ
most where a list meets a record.

Both concepts share these rules:
- The h1 is the page name, followed by the count.
- The stage filter stays as links with counts (`.stages a`), with counts from the pipeline endpoint.
- Header cells are sticky and sortable.
- "New …" is a button; forms never sit above the list.
- The ZentraValue block uses `.range-track i`.
- Explore and comparables get the map beside the table: register in 7 columns, map in 5, the map sticky at full height.

#### Concept 1: Desk (recommended)

![Desk, 1440](screenshots/layouts/desk.png)

| Phone, list | Phone, record |
|---|---|
| ![Desk, 390](screenshots/layouts/desk-390.png) | ![Desk, 390, record](screenshots/layouts/desk-390-record.png) |

```
Pro, 1360 px and wider                               Public (guest, buyer)
+----+-------------------------------------------+  +------------------------------------------+
| ~  | Org v   [Search address or folio]   (!) AU|  | GeoZentra  [Search address or folio]     |
|Over|---------------------------+---------------|  |  Explore  For you  Compare  Saved  Alerts|
|Pipe| Applications 22   [New]   | Marisol E.  ^v|  +------------------------------------------+
|Apps| All 22  Draft 3 ...       | [Record appr.]|  | 11960 SW 186th St          +-----------+ |
|Imp | +-----------------------+ | Collateral    |  | Building ----  Land ----   |ZentraValue| |
|Team| | sticky, sortable rows | | ZentraValue   |  | facts, ruled               | sticky    | |
|----| | > selected row        | | LTV           |  |                            +-----------+ |
|Expl| |                       | | Loan, Notes   |  | 12 columns, max 1200, left-aligned       |
|Alrt| +-----------------------+ |   (420 px)    |  +------------------------------------------+
+----+---------------------------+---------------+
```

**Navigation**
- **Pro:** a navy rail, 84 px wide, with an icon and a 12 px label for every item, so nothing depends on a tooltip. The persona's own work comes first, then a rule, then the shared research tools, with Settings at the bottom.
  - Lender: Overview, Pipeline, Applications, Import, Team | Explore, Compare, Alerts.
  - Realtor: Overview, Clients, Leads, Tasks, Deals | Explore, Compare, Alerts.
  - Investor: Overview, Portfolio, Studio, Opportunities | Explore, Compare, Saved, Alerts.
  - Admins (realm role) get Import jobs, Data quality and Valuations after one more rule.
- **Pro top bar:** the scope switcher where the persona has one (lender organization, investor portfolio), search by address or folio, notifications and the account. The persona select moves to Settings, so admins no longer see a "Buyer" select.
- **Public:** no rail. A white top bar with the search field first, then Explore, Opportunities, Compare, Saved and Alerts, then sign in or the account.

**Page grid and widths**
- **Registers** (applications, leads, tasks, deals, holdings, admin tables) are fluid, with no max width and 24 px gutters.
- **The docked slot** is 420 px on the right.
  - On registers it holds the record pane.
  - On Explore and comparables it holds the map. Selecting a property swaps the map for the record, and "Back to map" returns it.
  - At 1024–1359 px the slot becomes a sheet over the page, with one shell-level scrim that also covers the rail. That is the same fix the dialog backdrop needs.
  - Below 1024 px the record is its own page.
- **Columns carry priorities 1 to 3.** Opening the pane hides priority 3: Loan type in the specimen, which the pane shows anyway.
- **Arrow keys** move the selection, and the pane follows. Previous and next work within the loaded page.
- **Reading pages** (property record, settings, studio, assistant) use 12 columns, max 1200 px, left-aligned on the same gutter as registers. Record pages split 8 + 4 with a sticky ZentraValue aside.

**At 390 px**
- The rail becomes a bottom bar: four work items and More. Public visitors get Explore, For you, Saved, Alerts and More, the current `mobileNav` set.
- The top bar keeps the mark, the scope switcher, search as an icon, notifications and the avatar.
- The stage links become one picker.
- Registers drop to two columns, each with a second line: who and where, then amount and stage.
- The record replaces the list, with Back, previous and next at the top.
- On Explore, a List / Map toggle loads Leaflet only when Map is picked.

**Needs backend or store work.** Nothing here is added or faked.
- **Detail routes per register** (`loan-review/applications/:id`, `crm/leads/:id`, `portfolio/holdings/:id`, `admin/import-jobs/:id`). These make the pane linkable and let Back close it.
  - This changes `app.routes.ts`, and the route providers are on the HANDOFF fragile list. Needs your go-ahead.
  - The selection can come from the route parameter through existing load actions: lender collateral analysis by application, and import-job detail, which already keeps a `selectedId`.
  - `@ngrx/router-store` is installed but not registered. Registering it would change `appReducers` (fragile list) and isn't needed.
- **No LTV in the application list.** It exists only in the per-application collateral call, so it can't be a register column. Backend: LTV status and percent in the list response, or a batch endpoint.
- **One catalog lookup per property id** for the address in each row (`resolveProperty`). Fine at 20 rows; a batch lookup would help larger pages.
- **Persona-aware navigation:** UI only, but a product decision (already in §8).
- **Server-side sort** and **lender member names** are already in §8.

**Bundle cost.** No new dependency.
- **Shell CSS:** the rail, docked slot and bottom bar replace today's sidebar, drawer and mobile bar. Estimated −1 to +3 kB initial.
- **JS:** row keyboard navigation and persona nav lists, about +1–2 kB, mostly in the shared table component, which loads lazily with the pages.
- **No CDK in the initial bundle.** The sheet is plain CSS plus `inert`, not a CDK overlay.
- **Phones:** Explore on a phone stops downloading Leaflet (150 kB lazy) unless the map is opened.

#### Concept 2: Register

![Register, 1440](screenshots/layouts/register.png)

![Register, 390](screenshots/layouts/register-390.png)

```
Everyone                                                Record page (from "Open application")
+----------------------------------------------------+  +---------------------------------------+
| ~ GeoZentra  Overview  Loan review  Explore ... [Q]|  | < Applications   4 of 22   Prev  Next |
+----------------------------------------------------+  | Marisol Etienne        +------------+ |
| Org v | Pipeline  Applications  Import  Team       |  | Loan ---  Notes ---    | ZentraValue| |
+----------------------------------------------------+  | ruled sections         | LTV        | |
| Applications 22                          [New]     |  | 8 + 4 columns          +------------+ |
| > Marisol Etienne  3120 Day Ave ...  $1,180,000    |  +---------------------------------------+
| +- Loan ------- Collateral ------- Notes --------+ |
| +- [Record approval] [Record rejection] ... Open + |
|   next rows ...          (container max 1440)      |
+----------------------------------------------------+
```

**Navigation**
- **Everyone:** one navy top bar with the brand, the persona's sections (six links at most), search, notifications and the account.
- **Pro:** a white second tier with the section's sub-views and the scope switcher.
- **Public:** the same bar with Explore, Opportunities, Compare, Saved and Alerts, and no tier.

**Page grid and widths**
- **Container:** max 1440 px with 32 px gutters, centred beyond that.
- **Registers** use the full container, so every column stays visible.
- **Rows open in place:**
  - One row at a time spans all columns with three ruled blocks (Loan, Collateral, Notes) and the actions.
  - "Open application 1041" goes to a record page laid out 8 + 4, with previous and next through the register.
- **Explore and comparables:** register beside the map, the same as Desk. Selecting a property expands its row and highlights the parcel.

**At 390 px**
- The links fold into a menu, and the tier becomes a picker ("Loan review: Applications").
- Rows expand into stacked ruled sections.
- The record page puts previous and next at the bottom.

**Needs backend or store work**
- **Previous and next across pages:** the store must keep the register's order, filter and page, and fetch the neighbouring page at the edges. That is store and effects work; the lender slice keeps page and stage, CRM has no sort.
- **Record pages need detail routes.** Same fragile-list note as Desk.
- **The same gaps in list fields** as Desk.

**Bundle cost.** No new dependency.
- CSS: an estimated −2 to +2 kB.
- JS: about +0.5 kB per table for row expansion.

#### Recommendation: Desk

- **It fits queue work.** Lenders and realtors go through queues. The pane keeps the list and the position while each record loads its own data (collateral analysis, CRM history). The list endpoints don't carry that data anyway.
- **One frame for maps and registers.** The docked slot holds both the record and the map, so Explore and comparables share a frame with the pro registers.
- **Pro and public shells differ in a real way.** The navy rail carries today's identity into a work tool, and public visitors get a lighter, search-first bar.
- **Costs:**
  - Two shells to maintain.
  - The table loses its priority-3 columns while a record is open.
  - The detail routes need your go-ahead (fragile list).
- **When Register is the better choice:** it is simpler (one shell, full-width tables). Pick it if most pro work is scanning lists rather than reviewing records one after another.

**Pick Desk or Register (or adjust one), and I'll write DESIGN.md in the project root from A, the
marker above, and that layout. `src/` stays untouched until then.**

---

## Decision

Desk layout, DM Sans only, and the final unavailable marker. Two more specimens were rendered before
the spec was written: the public shell on the property page
([1440](screenshots/layouts/public-property.png), [390, guest](screenshots/layouts/public-property-guest-390.png))
and Explore with the docked map ([1440](screenshots/layouts/explore-docked-map.png)). The design system is
in [../DESIGN.md](../DESIGN.md).
