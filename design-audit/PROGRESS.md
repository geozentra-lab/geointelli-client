# Redesign progress

Applying DESIGN.md to every page, in order. One line per item: status (todo / done / blocked), what
changed, and what needs backend or store work. A new session reads this file and continues with the first
item that is not done.

**Start of this task (after the foundation session):** initial bundle 545.52 kB (147.89 kB transfer);
main.js 101.42 kB; global CSS 54.38 kB. `ng test`: 46 files, 187 tests pass. That build is kept in
`design-audit/.build-start/` and is the "before" for every item's screenshots.

**How each item is checked:** `ng build`; `ng test` from `C:` (uppercase); a review of the item's diff
confirming no store, effects or route logic changed; before/after screenshots at 1440 and 390 in
`design-audit/screenshots/<item>/` with an `index.html` (made by `node --experimental-websocket
design-audit/redesign-shots.cjs --item <item> --app <build> --out <dir>`); then notes here.

**Checkpoints:** stop for review after items 0, 1, 2 and 4.

| # | Item | Status | What changed | Needs backend/store work |
|---|---|---|---|---|
| 0 | Shell fixes: start-up state, larger navigation | done (review changes applied, awaiting review) | Navigation enlarged (rail 96 px, 24 px icons, 60/64 px top bars, 16 px links and menus, 64 px bottom bar); two search keyboard bugs fixed; start-up screen back to the centred logo after review (item 0's shell frame reverted), with the DESIGN.md logo, no motion under reduced motion and a reload line after 8 s; DESIGN.md updated | None new |
| 1 | Property page and live-map dialog | done (awaiting review) | Record frame: address h1 and one facts line, sticky tabs, 8/4 grid with a sticky ZentraValue aside holding the actions; shared `gz-zentra-value` (page, dialog, one-line form); contact form moved into an "Ask about this property" sheet (`gz-sheet`); facts as ruled groups with Unavailable markers; sales chart gains the monthly ZentraValue line and band; Valuation tab rebuilt (forecast fan on the time chart plus table twin, drivers and supporting sales as tables, model details in Method disclosures); Location, Features, Assessments, opportunity score, valuation history and nearby sales as record sections and tables; Comparables tab as a 7/5 table and sticky map with §10 markers and a phone List/Map toggle; dialog rebuilt around the ZentraValue | Opportunity notes wording (backend copy); nothing else new |
| 2 | Explore | done, rebuilt Zillow-like after the first review (awaiting review) | Explore as map and photo cards: opens on the country with a state to choose; results as cards led by the ZentraValue beside a map of ZentraValue pills; picking a card or pill zooms to its parcel outlined in copper; List / Map below 1024 px with the map deferred. New `exploreMap` store slice (parcel lookups by folio, approved) and the page's ZentraValues via the existing `loadBulk`. Parcel search (`/explore/live`) docked at 420 px beside a full-page map, §10 parcels, BrBG-7 growth squares, model versions under Method. `leaflet.css` moved to a lazy bundle with `src/map.css`. Shared table rows get the `gz-row` class (their CSS never matched) | Coordinates on search rows (§16 #5) would replace 20 lookups per page; forecast growth breaks (product); unhashed `leaflet.css` (item 9) |
| 3 | Opportunities and recommendations | done, review findings fixed, checked again after item 4 (awaiting review) | Opportunities as a ranked register: Top scored is a table (rank, property, score with an evidence-coverage bar, ZentraValue with a confidence line, next 12 months, strongest evidence) sorted on the server by the API's four orders from its headers; a row opens its score, factors and valuation in the Desk's record pane (docked, sheet or page by width). Matched to you is `gz-matches`, the §8 buyer lead built for item 4 to reuse: the matches table (rank, address, beds, living area, ZentraValue, reasons) for READY/PARTIAL with a "Partial:" caption, the inline "Set your area and budget" form for NO_PREFERENCES/LOCATION_REQUIRED, "No matches for these preferences" for NO_MATCHES. New shared `gz-score-factors` (the property page's factor table, now one component); `gz-reasons` lets a single reason wrap to two lines; docked panes get a right edge in the public shell. DESIGN.md §10 heat wording fixed | Confidence word on opportunity rows; ZentraValue on recommendation items (bulk predictions shared slice); developer words in backend copy (`generatedAt`, `coveragePercent`) |
| 4 | Persona dashboards (buyer, investor, realtor, lender, admin) | done, review findings fixed, checked again (awaiting review) | Every overview is h1 "Overview", one lead section, then at most two columns; the welcome eyebrow and slogan, the KPI tiles above the lead, the saved/searches/alerts trio and the six shortcut cards are gone. Buyer: `gz-matches` top 5 (area form, no-matches, guests) then saved searches and alerts tables. Investor: the value/debt/equity strip with Partial captions and "N holdings have no loan balance" + Add balances in Portfolio (or Add a holding), then occupancy and cash flow. Realtor: overdue and due tasks table (rows link to Tasks), then deals and leads by stage and the CRM feed. Lender: waiting for review (oldest update first, LTV, per-stage counts) + Open Applications, then approved and funded this month and the loan mix (segmented bar, unknown hatched, table twin). Admin-only accounts land on Import jobs. The summary strip is a real `<dl>` with its styles out of the global sheet; new `gz-overview-section` and `gz-mix-bar` (dashboard feature, not shared) | Mark done on the overview (CRM slice not on the route); every waiting application and Review next opening one (slice holds the 6 newest; no stage filter or detail route); opening a holding from Add balances; one request per user card; the investor slice doesn't reload the cards when the list drops the portfolio in scope |
| 5 | Investment studio | done (awaiting review) | A reading page: h1 "Investment studio" and one line; tabs Mortgage, Affordability, Rental kept in the address (`?mode=`) and following it. Each calculator puts its assumptions (ruled field groups) beside a result section that leads with one figure, then record groups or a table; the primary button is `aria-disabled` with the reason beside it; a blank field is never sent as 0. Mortgage moved out of the page into `gz-mortgage-calculator`. Rental: income and costs by month and year (year-only costs leave the month blank), financing and returns or one sentence, "After N years", the backend's notes once each, a note when the form no longer matches the result; saved scenarios as a full-width table. Focus moves to the result when an answer arrives. Opened from a property, a line names it with a link back | Scenarios list only the first 50 (the API pages them; the table says "Listed: 50 of N") |
| 6 | Saved and alerts | done (awaiting review) | Both pages are registers with the Desk's record pane. Saved: h1 "Saved", tabs Properties and Searches (counts; `?view=searches`, following the address). Properties is a table (facts, ZentraValue with the §9 confidence line through the existing bulk action, Saved date, Remove; a row opens the property); Searches is a table with each search's filters in words; a row opens the pane (Open in Explore, Delete, what it matches, one Checking form, matches today). Alerts: h1 "Alerts" with New alert; a table of rules (what each follows, what it watches for, how often, status in words, last check); a row opens the pane (Check now with its reason, Pause/Resume, Delete; the rule with one form; its checks in words, the failure as a sentence with the code under Details); New alert opens its form in the pane. The forms above the lists, the 4-6 button clusters per row and the card grid are gone | None new |
| 7 | CRM and loan review | done (awaiting review) | Both are registers with the Desk's record pane. CRM: the h1 is the list's name, the tabs are links to `/crm/:tab` and the page follows the address (`?stage=`, `?status=`, `?open=`, `?new=1`); Overview as a task strip, deals by stage and an activity table; clients, leads, tasks and deals as tables with stage or status links (counts from the CRM's own summaries); a row opens the record with its next stages, details (a client's in one form), notes and history; New … in the pane. Loan review: the h1 is the tab's name (`?tab=`), the organization in the header; Pipeline as a strip and stage bars; Applications with stage links counted by the pipeline and a table; the application's pane with its stage actions (Approve and Fund ask for the amount), Source field and Check LTV; Import's result as a strip and table; Team by user ID with the names Unavailable. No banner on top, no forms above lists, no button clusters on rows, no "User 112" | Member names on the team list; LTV in the applications list (§16 #2); detail routes (§16 #4) |
| 8 | Settings and admin | done (awaiting review) | Settings is a reading page: h1 "Settings" with Sign out, then Profile (name, the email as a row, the experience as four radios: the persona choice lives here), Property preferences (budget, counties as rows with Remove, goals), Notifications (what and where, how often) and Realtor license (status, the latest submission as rows, the rejection as a sentence, the form prefilled from it, earlier submissions as a table); each section its heading on the left and its form on the right, each with its own Save that says why it can't run (no toasts for a wrong field) and keeps typed fields when the store answers again. Admin: Import jobs (the admin landing page) as a register with the job in the pane (progress, the failure in words with the code under Details, failed and skipped records, Retry with its reason) and the upload form in the pane; Data quality as a rules table with the chosen rule's issues under it (`?rule=`, Hide issues, an empty rule says so, "Source property ID"); Valuation operations with the scoring runs and their result as a strip, then the revaluation requests with status links (`?status=`) and the request in the pane (Retry, Cancel, the code under Details). A guest or a non-admin gets one section that says why. No eyebrows, slogans, panels, tags as buttons or raw codes in tables | A silent poll that fails leaves Import jobs loading (store); `resolveProperty` queues duplicate lookups (store) |
| 9 | Final pass (toasts, contrast, keyboard, 390, reduced motion, bundle) | done (awaiting review) | Error toasts stay until dismissed or replaced (focus returns to the page); the docked record pane meets the window edge in the public shell (the register keeps its 1200 px measure on very wide screens); `gz-property-ref` shows a skeleton while it loads and "Address unavailable" when it can't, never "Property #42", and asks once per property; the §9 confidence format on Explore cards, the ZentraValue block and Compare; reduced motion covers scripted smooth scrolls and the parcel-search map; buttons waiting on a save say so; `finance-cards.ts` removed. Checked: text contrast (all pairs AA), keyboard (skip link, focus rings), every main page of every persona at 390 px (no sideways scroll) | Bundle under 500 kB (§16 #8, needs your go-ahead); `leaflet.css` caching (a server header); the dashboard store's affordability and mortgage-context actions now have no caller (store clean-up) |
| 10 | Compare | done (awaiting review) | A reading page: h1 "Compare" and one line (the slogan heading and the panel are gone); tabs Side by side and Comparable sales in the address (`?view=`), both kept mounted. Side by side: the chosen properties as ruled rows with Remove (no chips), the address picker, Compare `aria-disabled` with its reason; the comparison as one table of fields by property with group titles over an ink rule, units in the row names, every missing value the Unavailable marker with its reason (a group the backend left out is one merged span), "Highest" in words instead of a green tint, the §9 confidence; below 1024 px it scrolls inside its frame with the field names held (the page no longer scrolls sideways at 390: it did by 11 and 353 px). `?ids=` follows the selection. Comparable sales: distance in miles, the reasons beside the button, the ranked table (rank, property with its facts and what it lacks in words, sold, price, distance, match as a percent, evidence, why it was chosen), the backend's notes, model versions and weights under Method. The property picker no longer says "Property #42". Error toasts now clear when the user goes to another page (your decision) | The comparison's `low`/`high` are read as the 80% range (the response doesn't label them) |
| 10+ | Store fixes after item 10 (approved: these two only) | done (awaiting review) | Import jobs: a failed background refresh that had replaced a visible load ends that load with its error instead of leaving "Loading…" (two new actions, reducer rule, effect emits them; switchMap kept). Property lookups: an id is pending from the moment it is accepted, so one waiting behind the four in flight is not queued again; one cached meanwhile is skipped; a new session starts with nothing pending | None |

## Needs backend or store work (running list)

From item 10:
- The comparison (`POST /properties/compare`) sends each property's valuation `low` and `high` without
  saying which range they are. Compare labels them "80% range", as the prediction they come from
  defines its low and high (and as the mock builds them); a field naming the range would settle it.
  Backend.

From item 9:
- The dashboard store's `loadAffordability` / `loadMortgageContext` actions, effects and reducer
  slices have no caller since `finance-cards.ts` went (item 5 moved the calculations to the Studio).
  Store clean-up.

From item 8:
- ~~Import jobs: a silent poll that fails after cancelling a visible load leaves `loading` /
  `jobLoading` true.~~ Fixed after item 10 (approved; see "Store fixes after item 10").
- ~~`resolveProperty` (catalog effect): an id waiting in the queue of four is queued again.~~ Fixed
  after item 10 (approved; same notes).

Carried from the foundation session:
- Folio search in the top bar: the property search API has no folio filter (the top bar searches addresses).
- One app-level scope per persona for the top-bar switcher: the lender organization lives in the
  route-level lender slice; the investor overview keeps its own portfolio scope.
- ~~Error toasts stay until dismissed.~~ Done in item 9 (held by the shell); since item 10 they clear
  when the user goes to another page (your decision of Nov 20).
- Initial bundle under 500 kB: DESIGN.md §16 item 8 (moving eagerly registered slices).
- DESIGN.md §16 items 1-7 (not-applicable signal, LTV in the application list, batch address lookup,
  detail routes, coordinates on search rows, ZentraValue on Explore, per-holding value/debt/LTV etc.).

From item 1:
- Opportunity score notes (backend copy) use the developer word `coveragePercent`; the page shows
  them as sent. Plain wording would come from the backend.

From item 2:
- Explore places each page's 20 results with 20 parcel lookups by folio (new `exploreMap` slice,
  four at a time). Coordinates on search rows, or a batch parcel lookup, would replace them
  (§16 #5).
- Explore sorts only by what the search API offers; there is no ZentraValue sort (no API for it).
- With the growth breaks unchanged, the forecast metric's neutral middle class is +1% to +2.5%, not
  "around 0%" as DESIGN.md §10 put it. New breaks are a product call.
- `leaflet.css` is not content-hashed (`inject: false` bundles aren't), so after a deploy a browser
  may keep an older copy of the map styles until it revalidates (item 9).

From item 3:
- Opportunity rows (`GET /opportunities` items) carry no confidence word for their ZentraValue. The
  scored table's 12 px line is the valuation's confidence score from the score's own
  `VALUATION_CONFIDENCE` factor ("Confidence 78 of 100"), or "Confidence not stated" (DESIGN.md §16 #9).
- Recommendation items carry no ZentraValue. The Matches tab dispatches the existing
  `ValuationActions.loadBulk` once per set of rows; that slice keeps one `predictions` map shared
  with Explore and the parcel map (each asks again when it opens) and its failure message names the
  growth heatmap, so the tab writes its own ("ZentraValues could not load."). Its loading and failure
  are whichever page asked last, so the tab asks again whenever that request is still running or
  failed (check of items 3 and 4). A value on the item, or predictions keyed by caller, would remove
  the shared state (§16 #10).
- Backend copy with developer words, shown as sent: the recommendation limitation "…generatedAt is
  the response time…" and, as on the property page, the opportunity note "…coveragePercent is the
  highest score…" (§16 #11). The opportunity note "Version opportunity-v1 scores the stored
  ZentraValue…" names the scoring version, so it is shown under Method only, on Opportunities and on
  the property page (§9).
- The Matches tab can't tell a row with no estimate from one never asked for (the bulk answer simply
  leaves it out), so coming back to the tab asks for the values again whenever a row has none (46 and
  49 in the full mock account). A "no estimate" entry in the answer, or predictions kept per request,
  would let it skip the request.
- Opportunity rows and the "Valuation confidence" factor have no band field: the band is read
  from the factor's explanation ("(medium confidence)"); a `confidence` field on the factor or the
  row would replace that reading (DESIGN.md §16 #9).
- Recommendations: `sourceAsOf` is null, so "Records as of" is Unavailable under Method (§16 #7);
  budget and goals are never applied (no listing prices, no goal criteria), so any saved budget or
  goal makes the answer PARTIAL, including a budget saved from the inline form; no sort parameters,
  so the matches table sorts within the 20 loaded.

From item 4:
- Realtor **Mark done**: `CrmActions.updateTask` exists, but the `crm` slice is registered only on the
  `crm` route and the realtor dashboard slice has no task write, so the overview can't mark a task
  done. Each task links to Tasks and the table says "Mark tasks done in Tasks." (DESIGN.md §16 #13).
- Lender **Waiting for review**: the lender dashboard slice loads the 6 newest applications of
  every stage (the API sorts by id, newest first; no stage filter), so the lead lists only the
  waiting ones among those 6 ("Listed: 1 of 4 submitted and 2 of 4 under review.", against the
  pipeline's counts per stage). A
  stage-filtered, oldest-update-first load (backend sort, §16 #7), and an application parameter or
  detail route on Loan review (§16 #4), would list them all and let **Review next** open the oldest
  in the Desk pane. Until then **Open Applications** goes to `/loan-review?tab=applications`
  (DESIGN.md §16 #14).
- Investor **Add balances**: the value-equity-debt card counts the holdings without a loan balance
  but doesn't say which, and Portfolio has no holding route or parameter to open one, so the button
  opens Portfolio ("Add balances in Portfolio") (DESIGN.md §16 #12).
- Buyer overview: `DashboardActions.load` asks for four user cards (favorites, saved searches,
  alerts, activity); the overview shows two, so two requests are unused (DESIGN.md §16 #15).
- `admin` landing: done without a route change (the overview sends an admin-only account to Import
  jobs with `router.navigate`, replacing the history entry), so the overview's chunk loads first. A
  redirect on the route would avoid that but changes `app.routes.ts`.
- Unchanged and still open: the realtor activity feed has no client names, and the scope switchers
  stay on the page until there is an app-level scope (both carried from the foundation, §16 #7).
- Investor scope after a deletion (from the review): `InvestorDashboardActions.load` asks for the
  cards of the stored scope; when the list then drops that portfolio, the reducer moves the scope to
  all portfolios but nothing asks again, so the cards stay failed (or keep the old portfolio's
  figures). The overview now shows no card of another scope and asks for the scope in view with the
  existing `selectScope`; the slice could do it itself (DESIGN.md §16 #16).
- Mock, not the app: the user dashboard cards in `design-audit/mock/fixtures/account.cjs` sort by
  `updatedAt` and the lender applications by `updatedAt`, while the backend sorts by creation (by
  `createdAt`, and by id). The overview's copy follows the backend ("5 newest of 7", "the 6 newest
  applications"), so in the screenshots the Saved dates are not in order. Left unchanged here
  because other items' before/after shots use the same fixtures.
- ~~Found for item 8 (not store work): Import jobs scrolls sideways at 390 px.~~ Fixed in item 8
  (the 390 sweep in item 9 confirms it).

## Notes per item

### Decisions of Nov 20, 2026 (your review of items 8 and 9)
- **Bundle budget:** left for now. The initial bundle stays over 500 kB (§16 #8 not started).
- **Compare:** item 10, same rules as the other items (below).
- **Error toasts:** stay until dismissed on the page, clear when the user goes to another page. Done
  with item 10 in the shell (`app.ts`), DESIGN.md §12 updated, specs in `app.spec.ts`.
- **Store fixes:** approved for two problems only, as a separate step after item 10: Import jobs
  stuck on "Loading…" and duplicate property lookups (below, each change listed).
- **Item 7:** confirmed: its row reads "done (awaiting review)".

### Store fixes after item 10 (approved Nov 20, 2026; done, waiting for review)
The only store and effects changes in this round; nothing else in `src/app/store` changed (checked
against `.src-before-10`). Action names and payloads, the late-answer guards and the
switchMap/exhaustMap choices are as they were (DESIGN.md §15).
- **Import jobs, stuck "Loading…":** polling sends a silent `load` (and a silent `openJob` for the job
  in the pane) every 5 s while a job runs. The effects use switchMap, so a silent request cancels a
  visible one still out; when the silent one failed, the effect returned nothing and `loading` /
  `jobLoading` stayed true (Refresh refused, the pane said "Loading…" until a reload).
  1. `import-jobs.actions.ts`: two new actions, `Refresh failed` and `Job refresh failed`
     (`{ error }`). Existing actions unchanged.
  2. `import-jobs.reducer.ts`: `refreshFailed` ends a waiting visible load with the error
     (`loading` is only ever set by a visible load); with nothing waiting the state is returned as it
     was, so the table stays and no error shows. `jobRefreshFailed` does the same for the job
     (`jobLoading`, `jobError`).
  3. `import-jobs.effects.ts`: a silent failure emits the new action instead of `EMPTY`; visible
     failures emit `failed` / `jobFailed` as before; switchMap kept.
- **Duplicate property lookups:** `resolveProperty` (catalog effect, four at a time) marked an id as
  in flight only when its request started, so an id waiting in the queue passed the check again and
  was fetched two or more times; an id cached meanwhile (a page of search results) was still fetched.
  4. `catalog.effects.ts`, `resolve`: the id is marked pending as soon as it is accepted (`tap`); when
     its turn comes it is skipped if the catalog has it by then (`defer`); `finalize` clears the mark.
     The effect starts each session with nothing pending (`defer` around it clears the set), since
     ids still queued when a session ends never reach their `finalize` (found by the review).
     mergeMap with 4 at a time kept; the set is renamed `pending`.
- **Spec:** `src/app/store/store-fixes.spec.ts`, 7 tests: a visible load replaced by a failing poll
  ends with the error; a failing poll on its own changes nothing; the same two for the open job; a
  property asked for again while waiting is fetched once; one cached while waiting is skipped; a new
  session fetches ids that were waiting when the old one ended; a failed lookup is asked again on
  retry. The first, third, fourth, fifth and sixth fail on the code before the fix.
- **Review** (independent, of this diff): the session-end leak above, fixed. Also noted, not new and
  left as is: after a retry or upload, the silent refresh of page 1 can replace a visible load of
  another page when it succeeds.

### 10. Compare (done, waiting for review)
- **Page:** h1 "Compare" and "Up to five properties field by field, or the recorded sales most like
  one property." (before: the eyebrow-era slogan "Weigh properties against the evidence." and a
  panel). Tabs Side by side and Comparable sales in the address (`?view=`, replacing the entry,
  arrow keys, Home and End); both stay mounted. `/compare/:id` opens the comparable sales of that
  property; `?property=` holds one picked on the page; `/compare?ids=` from the tray restores and
  runs the comparison, and `?ids=` then follows the selection (a reload or a copied link shows what is
  chosen). Routes unchanged.
- **Side by side:** a section like Settings': "Properties", one line and "4 of 5 chosen" on the left;
  the chosen properties as ruled rows (address link and place, Remove; focus moves to the next Remove
  or the heading), the shared picker ("Five are chosen…" when full), Compare `aria-disabled` with
  "Choose at least 2 properties." / "Choose one more property.", Clear all. The comparison: "4
  properties side by side" (h2), the backend's notes, one table: property address and place heading
  each column (sticky under the top bar); Facts, Assessment, Last recorded sale, ZentraValue
  (figure, "80% range" as "$877,000 to $1,093,000", Confidence "78 of 100", Change since last sale
  signed, Estimated) and Location ("74 of 100") as 13 px/600 titles over an ink rule (before:
  11 px uppercase tracked labels); units in the row names. Missing values: the Unavailable marker
  with the reason (facts share a footnote; others under the word); a group the backend left out is
  one merged span ("No ZentraValue was returned for this property"). Before: "—" everywhere. The
  largest figure in a row is set at 600 with "Highest" under it (before: a green-tinted cell, the
  word only for screen readers). Added after the comparison: said in attention; removed: the column
  goes, and the notes give way to a line saying so. Nothing chosen: one sentence and Explore
  properties.
- **Narrow screens:** below 1024 px the table scrolls in its own frame with the field names held; the
  table's width is the field names plus one column per property (132 + 160 px each; 112 + 120 on
  phones, so two fit at 390); "Scroll the table sideways to see all 4." only while it overflows.
  Before: the page itself scrolled sideways at 390 (11 px with two properties, 353 px with four).
- **Comparable sales:** the picker, "Within, miles" (0.1 to 6.2; 1.25 by default, covering the
  property page's 2 km) and "Sold in the last, months", Find comparable sales with its reason (before:
  "Radius (meters)" and a plain disabled button). The answer: "3 comparable sales", "Within 1.25 mi,
  sold since …, most similar first · records as of …", the property's own facts, a status the notes
  don't already say, the backend's notes; the table Rank, Property (facts; "Not on record: year
  built", before "Missing: yearBuilt"), Sold, Price, Distance in miles, Match (before "0.8"),
  Evidence, Why it was chosen (`gz-reasons`); below 1024 px the last two move under the property; a
  row opens the sold property. None found: "No comparable sales" and the notes, or "Nothing matched
  this search. A longer distance or sale history may find some." Versions, weights and filters under
  Method (before: `comparable-selection-v3 · comparable-ranking-v2` in the prose).
- **Shared:** the property picker's chosen property no longer reads "Property #42" while it loads
  ("Loading the address…", then the address, the folio formatted, or "Address unavailable"), doesn't
  repeat the folio under itself, and names results by their own address or folio.
- **Toasts (your decision):** a held error goes when a navigation ends on another page. A page is a
  path, or a rail item told apart by a query (the lender's Pipeline, Applications, Import, Team). A
  query change on the page, a cancelled navigation and a redirect back keep it; an error the
  navigation itself raised replaces it and stays. The store's copy goes with it. DESIGN.md §12.
- **Review of the item's diff** (independent reviewer, two rounds, against `.src-before-10`). Fixed:
  the sales table could push a tablet page sideways (columns moved under the property); the toast
  dropped on a redirect back to the same page, and kept across the lender's rail items (now dropped
  at the end of the navigation, by page); notes about a removed property stayed; `?ids=` and the
  picked property didn't follow the page; a missing distance had no visible reason; rows keyed by
  property (two sales of one would clash); long field names on phones; the picker's result labels;
  a self-written `?ids=` taken for a link after a cancelled navigation; spec gaps (exactly one request,
  the tray case, the route change, keyboard tabs, focus to the next Remove, the redirect, the lender
  tabs, an error raised while a page opens). Left as is: the global error handler shows one toast per
  10 s, so if a held "Something went wrong" goes with the page and the next page throws within 10 s
  nothing shows; a navigation raising exactly the held error's text drops it; a Remove button's
  spoken name says "the property with ID 42" while the address loads (DESIGN.md's own pattern for an
  unnamed record, "the member with user ID 112").
- **Checks:** `ng build` passes with the two known warnings (initial 529.46 kB, 145.87 kB
  transfer; 528.45 kB before this round, the difference is the shell's toast rule and the
  catalog effect, both in the initial bundle). `ng test` 68 files, 403 tests pass (new:
  `compare.spec.ts`, `store-fixes.spec.ts`, two toast tests in `app.spec.ts`). `diff -rq
  design-audit/.src-before-10 src`: Compare, the picker, the shell and its spec, and the four store
  files above; no routes. Screenshots: `screenshots/10-compare/index.html` (12 before and after, at
  1440 and 390; no sideways scroll and no console errors after).

### 9. Final pass (done, waiting for review)
- **Carried items:**
  - The docked pane's empty strip at 1440 in the public shell: while a pane is docked the public page
    drops its 1200 px measure (`styles.css`, `:has()`), so the pane meets the window edge as in the
    pro shell; the register itself keeps the measure, so on a 2560 px screen it stays 1200 px with the
    pane at the edge (`alerts-pane-2560`). The right-edge rule item 3 added to `gz-desk` is gone.
  - `gz-property-ref`: a skeleton while the address loads, "Address unavailable" (still a link, with
    the reason for screen readers) when the lookup failed, the folio formatted when the record has no
    address; never "Property #42" (before: Alerts showed "Property: Property #46"). Compare's chips no
    longer say "Property 42" either ("Property ID 42" until the address arrives).
  - The §9 confidence format everywhere: Explore cards "Confidence 78 of 100 · Medium" (Low in
    attention), the ZentraValue block "Medium confidence" (its endpoint sends the band alone), Compare
    "78 of 100" (the comparison sends the score alone; best in row unchanged).
  - `finance-cards.ts` (the unused home-budget and mortgage-context cards) is deleted, with its
    contract test; the endpoint's query is still tested at the service level.
  - CRM's own date-and-time function now uses the shared `formatLocalDateTime` (same output).
- **Toasts:** an error toast stays on screen until it is dismissed or the next toast replaces it; the
  store still clears every toast after 5 s (no store change: the shell component holds what it
  shows), and the screen-reader live regions still announce each toast once. Dismissing returns
  focus to the page. Info toasts go after 5 s as before. A held error stays across pages until it is
  dismissed (left as is: clearing it on navigation would also drop errors raised by a navigation).
- **Contrast:** every text pair of tokens passes AA, from 4.8:1 (secondary text on the hatch) to
  15.2:1; control borders (`--control`) 3.5:1 on white and 3.2:1 on paper. `--rule-strong` (1.6:1)
  is only used for decorative edges (menus, table heads, dialogs, disabled fields), never as an
  active control's only boundary. Disabled (`aria-disabled`) buttons are exempt and say why.
- **Keyboard:** the skip link, the global focus ring and the registers' keyboard paths were checked;
  no change needed beyond the toast's focus return. Buttons that wait on a save now say so: Saved's
  Remove reads "Removing…" (and its spoken name follows), Alerts' Pause and Delete and Saved's
  Delete search say "Saving a change to your …" beside them, announced through a status region that
  is always present.
- **Reduced motion:** the CSS rule already stopped transitions and animations; script-driven motion
  now asks the setting too: pagination's smooth scroll and the parcel-search map (zoom, fade, marker
  and drag-momentum animation, and its two animated moves). Explore and the Comparables map already
  did.
- **390 px:** every main page of every persona (guest, buyer, investor, realtor, lender, admin; 24
  pages, including the live map) at 390 px: none wider than the viewport, no console errors
  (`sweep-*`, after only).
- **Bundle:** initial 528.45 kB (145.6 kB transfer), from 545.52 kB at the start of the redesign. The
  rest of the way needs §16 #8 (eagerly registered store slices; your go-ahead) and the approval row
  in DESIGN.md §17. `leaflet.css` keeps a fixed name, so its caching needs a server header
  (`Cache-Control: no-cache`) or an approved `angular.json` change (§17).
- **Review of the item's diff** (independent reviewer, against `.src-before-9`): no store, effects,
  reducer, action or route change. Fixed from its findings: "Removing…" wasn't in the buttons'
  spoken names (and one phone Remove had no reason); the docked state dropped the measure for the
  whole register on very wide screens; a record with neither address nor folio read "Folio ";
  "Address unavailable" had no reason; the saving notes' live region appeared with its text (not
  always announced); dismissing a toast dropped focus to the body; drag momentum on the parcel map;
  "Property 42" and unformatted folios in Compare. Also fixed while checking the shots: pane errors
  sat on the section rule below them (Loan review, CRM, Alerts, Import jobs, Valuations).
- **Left as is:** Compare was never a redesign item: its slogan heading ("Weigh properties against
  the evidence.") and panel are the foundation's (a page item if you want one). The dashboard store's
  affordability and mortgage-context load actions, effects and slices have no caller since the cards
  went (store clean-up, needs list).
- **Checks:** `ng build` passes with the two known warnings (initial 528.45 kB). `ng test` 66 files,
  385 tests pass (a toast test in `app.spec.ts`; property-reference states in `shared-kit.spec.ts`;
  `explore.spec.ts` expects the §9 line; the affordability card test removed with the card).
  `diff -rq design-audit/.src-before-9 src`: the files above, nothing in `store/` or the routes.
  Screenshots: `screenshots/9-final/index.html` (33 after, 4 before; most are after-only checks).

### 8. Settings and admin (done, waiting for review)
- **Settings** (DESIGN.md §5 Record, Settings): the eyebrow and slogan ("PROFILE & PREFERENCES / Your
  goals shape the experience."), the panels, the county tags with "×", the toasts for a wrong
  budget or too many goals, and the select called "Primary experience" are gone.
  - Four sections, each a white section under a 2 px ink rule with its heading, one line and any
    status on the left (4 of 12 columns) and its form on the right (8); one column below 1024 px,
    one field a row on phones. Each form is its own component (`profile-form.ts`,
    `preferences-form.ts`, `notification-form.ts`, `realtor-license.ts`) with its own Save:
    `aria-disabled` with the reason beside it ("Nothing has changed.", "The minimum is more than the
    maximum.", "A name can be changed here, not removed.", "Enter the name on the license and its
    number."), a failed save said under its own button, and the fields being typed kept when the store
    answers again (a saved profile, a license submitted, a reload).
  - Profile sends only what changed (before: the persona every time and an emptied name silently
    dropped). The experience is four radios with what each opens on: DESIGN.md §5 moves the persona
    choice here. The license section shows for realtors or anyone with a submission, from the saved
    profile (before: as soon as the select changed, unsaved).
  - The license: "State: Florida" is written, not a one-option select; the expiry minimum is the
    viewer's own day (it was UTC's); earlier submissions are a table, not a disclosure list.
  - Guests: one sentence with Sign in and Create account.
- **Admin pages** (§5 Register, Admin pages): a guest or an account without the role gets one section
  that says why (`admin-gate.ts`), and nothing loads.
  - **Import jobs:** Refresh and Import county data in the header; the upload form left the top of the
    page for the pane. The table has Job (what it loads, then kind, county and attempt; "County ID 17",
    never "County 17"), Status in words with the step, Processed with a bar, Written, Skipped,
    Failed, Queued; on phones Job and Status with one line under the job (before: 205 px wider than a
    390 phone). No error code in the table (before: `DATABASE_UNAVAILABLE` under the status).
    A row opens the job: Retry with "Resumes from the last checkpoint." or the reason it can't run
    (before: a disabled button with a hover title), What went wrong with the code and input files
    under Details, Progress, Job (Resumes opens the earlier job), and the failed and skipped records
    ("sales.csv, row 1,200", the reason in words; the first 50, then Show all). A retried or uploaded
    job opens in the pane. Polling every 5 s while a job is queued or running, as before.
  - **Data quality:** the rule codes under each rule and the Show issues buttons are gone; a rule is
    chosen in the table (`?rule=`), its issues listed under it with the rule as an h2 and Hide issues;
    "No issues: every record passes the 7 rules" and "No record breaks this rule in the latest count."
    (before: nothing for a rule with 0); the source id is "Source property ID 1234" (before: "row 1234",
    which it isn't); on phones the folio stays a link.
  - **Valuation operations:** the scoring runs first, their result as a summary strip (before: one
    sentence with the mode code); the requests' status select became status links kept in the address;
    the error codes left the table for the pane's Details; Retry and Cancel left the rows for the pane,
    one change at a time ("Another request's retry or cancel is still being sent."), and a failed model
    publication says the valuation worker retries it.
- **Shared, and why:** `format.ts` gains `formatLocalTime` and `formatLocalDateTime` ("Nov 18, 3:57
  PM" on the viewer's clock; CRM's own `when()` does the same and can move to it in item 9).
  `gz-property-ref` asks for its property once: it re-asked for every property still on its way each
  time any property (or photo) arrived, which with 20 rows was well over a hundred lookups (the review
  found it; it affected Alerts, CRM and Loan review too). Long lists that don't need addresses (an
  image backfill's up to 1,000 properties) link "Property ID 42" instead.
- **Review of the item's diff** (independent reviewer, against `.src-before-8`): scope held, no store,
  effects or route change, no direct service call. Fixed from its findings: the property lookups
  above; Show all collapsed to 50 at every poll; following Resumes dropped focus; a revaluation
  error could show in another request's pane; the folio wasn't a link on phones; a chosen rule couldn't
  be cleared; a failed retry or license submission showed again on a later visit; "Job a1b2c3d4" in
  prose and an empty pane label while a job loads; two fields a row at 390 wrapped long labels.
  Found while checking the shots: the job's pane rendered empty (a pane nested two control-flow blocks
  deep isn't projected into the desk's slot) and a failed request repeated "Last attempt failed".
- **Left as is (store work, in the needs list):** a silent poll that fails while a page load or a job's
  detail is in flight leaves Import jobs "Loading…" until the page is reloaded (the effect swallows a
  silent failure after cancelling the visible request; the old page had the same poll); the
  `resolveProperty` effect queues a lookup for an id that is waiting in its queue of four.
- **Checks:** `ng build` passes with the two known warnings (initial 527.96 kB). `ng test` 66 files,
  385 tests pass (rewritten `settings.spec.ts`, new `admin.spec.ts`, and a format and a property
  reference test in `shared-kit.spec.ts`). `diff -rq design-audit/.src-before-8 src`:
  `features/settings/`, `features/admin/`, `shared/components/property-ref.ts`,
  `shared/data/format.ts` and `shared-kit.spec.ts`. Screenshots: `screenshots/8-settings/index.html`
  (22 after, 18 before; the panes and the upload form are after-only; several before shots were
  retaken one by one because the run showed the guest view, the sign-in timing seen in item 7).
  No console errors, and no page wider than its viewport.

### 7. CRM and loan review (done, waiting for review)
- **Frames (DESIGN.md §5 Register):** both lost their eyebrow and slogan ("CLIENT WORKSPACE / Every
  relationship, in one place.", "LENDING / Track every application, stage by stage."), their create
  forms above the lists and their rows of 3 to 6 buttons. Each list is a table in the Desk; a row
  opens the record pane (docked, sheet or its own page by width), the pane follows the table's arrow
  keys, Escape closes it and focus goes back to the row. "New …" opens its form in the pane.
- **CRM** (`/crm`, `/crm/:tab`): the h1 is the list's name (Overview, Clients, Leads, Tasks, Deals),
  the tabs are links (`aria-current`), and the page follows the address, so the realtor's rail links
  switch the list (before, a second rail link on an open CRM did nothing: the tab was read once).
  `?stage=` (leads, deals) and `?status=` (tasks) filter; `?open=<id>` opens a record from the
  overview's activity (and says so when it isn't on the first page or was deleted); `?new=1` opens
  the New form, which the realtor overview's New task, New lead, New deal and Add a client now use.
  - Overview: Tasks as a summary strip (Open, In progress, Overdue, Done; each opens Tasks on that
    status), Deals by stage (bars, each opens Deals on it), Recent activity as a table (a row opens
    its record). The four metric tiles and the "View" buttons are gone.
  - Lists: stage or status links with the CRM's own counts (deals from its pipeline, tasks from its
    task summary; leads have no counts, so none are shown); Client (email, phone, added), Lead
    (client, stage, source, property, changed), Task (due with Overdue in attention, status, client),
    Deal (client, stage, property, expected close or closed); server pages of 20.
  - The pane: next stages as buttons (the way forward primary, Mark lost / Cancel deal secondary,
    final stages confirmed), Delete for clients and tasks, the details as ruled rows (a client's in one
    form that sends only what changed and says why it can't), notes and history (the history now
    follows the record as the pane steps; Add note says why it can't run instead of being disabled).
  - Words: a client outside the CRM's 100 newest reads "Client: Unavailable" with the reason under the
    table (never "Client 12"); a system lead source ("WEBSITE") reads "Website".
- **Loan review** (`/loan-review?tab=`): the h1 is the tab's name (Pipeline, Applications, Import,
  Team: the lender's rail); the organization select with Owner or Member, and New application (on
  Applications) or New organization, in the header. The disclaimer banner is gone: "Recording a stage
  doesn't approve credit or move any funds." sits under the applications and in each record.
  - Pipeline: a summary strip (Applications; Approved and Funded with the approved and funded amounts
    the pipeline sums: the old tiles called them "requested", and "In review" added two stages on the
    client) and the stages as bars with counts and requested amounts; a stage opens Applications on it.
  - Applications: stage links counted by the pipeline; a table (Applicant with loan type, Stage,
    Requested, Approved or funded, Property, Changed). The pane: Submit, Start review, Approve…, Mark
    funded…, Reject, Withdraw (Approve and Fund ask for the amount in the record and say back an amount
    that is too high; final stages are confirmed); the application's rows with the import source as a
    Source field ("BROKER_SOUTHDADE · SD-2238", not "Imported from … (…)" in prose); Collateral with
    Check LTV and the LTV, its basis and the ZentraValue as the backend works them out.
  - Import: the snapshot form; the result as a strip and a table (Row, Result, Application ID, Reason
    in words; nothing where nothing applies, not "—").
  - Team: members as a table, the names one merged Unavailable span ("The team list sends user IDs
    only.") beside each user ID, the role and You, Remove for the owner; Give access by user ID says
    why it can't run. No "User 112" in prose ("the member with user ID 112").
  - No organization: one section to create it; New organization otherwise opens in the pane.
- **Shared, and why:** nothing in `shared/`. New feature files: `crm/crm-record.ts`,
  `crm/crm-form.ts`, `crm/crm-words.ts`, `loan-review/application-record.ts`,
  `loan-review/application-form.ts`; `crm.html` and `loan-review.html` are folded into their
  components. Outside the two folders: the realtor overview's create links gained `?new=1` (and its
  spec's expected address), to keep them opening a form now that the forms live in the pane.
- **Review of the item's diff** (independent reviewer, against `.src-before-7`): scope held. Fixed
  from its findings: the empty pipeline's New application never opened; the Approve/Fund amount form
  closed on any later lender change (an LTV check) and carried over to the next application with the
  arrow keys; the pipeline captions said "requested" for approved and funded amounts; write errors
  showed in other records' panes, tabs and organizations; the realtor overview's New task/lead/deal
  and Add a client stopped opening a form; focus dropped after stage moves, a stage bar, creating the
  first organization and a stage link with the pane open, and paging with the pane open sent it to
  New … instead of the count; "User 112" in prose; Not recorded loan types and unresolved client
  names without the Unavailable word or a reason; the team's Unavailable repeated per row; Add note
  disabled without a reason; an activity's record silently not opened.
- **Left as is:** `/crm` and `/crm/:tab` are separate routes (no route change in this item), so moving
  between Overview and a list rebuilds the page and asks for its pickers and summaries again (between
  lists it doesn't). Member names and the LTV in the list need backend work (§16).
- **Checks:** `ng build` passes with the two known warnings (initial 527.88 kB). `ng test`
  65 files, 367 tests (was 63 and 348) pass (new `crm.spec.ts` and `loan-review.spec.ts`). `diff -rq design-audit/.src-before-7
  src`: `features/crm/`, `features/loan-review/`, and the realtor overview's links and spec.
  Screenshots: `screenshots/7-crm/index.html` (27 after, 19 before; the panes and New forms are
  after-only). No console errors, and no page wider than its viewport.

### 6. Saved and alerts (done, waiting for review)
- **Frames (DESIGN.md §5 Register):** both pages lost their eyebrow and slogan ("YOUR SHORTLIST /
  Keep the possibilities in view.", "MONITOR / Stay close to what changes."), their forms above the
  lists and their rows of 4 to 6 buttons. Each is a table in the Desk (`gz-desk`); a row opens the
  record pane (docked at 1360 px and up, a sheet at 1024-1359, its own page below), the pane follows
  the table's arrow keys, Escape closes it and focus returns to the row.
- **Saved:** h1 "Saved" and one line; tabs Properties and Searches with their counts (no count while
  a list loads or after it failed), `?view=searches` in the address, following it.
  - Properties: a table (Property with address link and place, Beds, Living area, Built, ZentraValue
    with the §9 confidence line, Saved on the viewer's day, Remove). Not cards: the photo-card
    exception was Explore's only. The ZentraValues come from the existing bulk prediction action,
    once the saved properties' details have settled; when they fail, one merged Unavailable span with
    Retry. A row whose details couldn't load keeps every column (facts merged, Retry for its
    details). A row opens the property's page; Remove moves focus to the tab first. Columns sort
    within the list, with a note. On phones: Property and ZentraValue, with facts and Remove as
    second lines (the page scrolled 91 px sideways before that fix).
  - Searches: a table (Search with its filters in words, "ZIP 33133 · Single family · 3+ beds";
    Checked; Status; Saved), server pages of 20. The pane: Open in Explore (primary) and Delete; What
    it matches; Checking (name, how often, pause, one Save changes that sends only what changed and
    says "Nothing has changed." / "Enter a name." beside it); Matches today (the count and the first 8
    the API sends, as links). A county the location lists don't hold is never dropped silently: a
    county-only search reads "One county (its name isn't loaded)", never "every property".
  - Guests: one sentence with Sign in and Create account; nothing saved: one sentence and Explore
    properties.
- **Alerts:** h1 "Alerts", one line, New alert (primary). Table: Alert (name, then what it follows:
  "Saved search: <name>", "(loading its name…)" or "Unavailable (its name could not load)", or the
  property's address), Watches for ("ZentraValue change / Moves 3% or more, up or down"), Checked,
  Status ("Active", "Paused", "Paused with its search", "Can't run" and "Checks are off" in
  attention), Last check ("Not yet"); "7 alerts · 2 paused" above it; server pages of 20.
  - The pane: Check now (primary; `aria-disabled` with the reason beside it, e.g. "Listing prices
    aren't available yet.", "Resume the rule to check it." — the old "Evaluate now" was disabled
    with no reason), Pause or Resume, Delete. Rule: watches for, notifies when, follows, created,
    then one form for name, how often and the change that notifies (only what changed is sent; an
    answer for the same rule keeps what was typed). Checks: status in words ("Starting point
    recorded; it notifies from the next change", not BASELINED), last and next check, properties
    checked, notifications sent / waiting / failed (as the monitor reports them), a failure as a
    sentence ("Listing prices aren't available yet, so this rule can't run.") with its code under
    Details (the old page said "The last check failed (code UNSUPPORTED_SOURCE)" for a rule that had
    never run), Refresh.
  - New alert opens its form in the pane (DESIGN.md §5): name, watch for, follow (New matches only
    from a saved search, said under the field), the saved search or property, the change that
    notifies, how often; Create alert says what is missing. Once created, the rule opens in the pane
    with focus on its title.
  - A failed change is said in the pane (and on the page when no pane is open); no rules: one
    sentence and New alert; guests: one sentence with Sign in and Create account.
- **Shared, and why:** nothing in `shared/`. New feature files: `saved/search-words.ts` (filters in
  words), `saved/saved-search-record.ts`, `alerts/alert-words.ts` (events, criteria, statuses,
  reasons), `alerts/alert-record.ts`, `alerts/alert-form.ts`. `alerts.html` is folded into the
  component. No store, effects, routes or config change.
- **Review of the item's diff** (independent reviewer, against `.src-before-6`): scope held. Fixed
  from its findings: failed pauses, saves and deletes showed no message (now in the pane, and on the
  page), and a leftover error appeared in the New alert form as if Create had failed; Delete lost
  focus below 1360 px (the register was still inert or hidden when focus moved: now after render);
  Create lost focus when the form gave way to the new rule; the Alerts pane didn't follow the arrow
  keys (it kept its own id while the position and Next followed the selection); a row without
  details broke the table's columns (and the merged value span); the ZentraValues were asked for
  once per property detail that arrived (now once they've settled); Pause wiped a name being typed;
  the Searches tab read "0" after a failed load; "not on this page" for a followed search's name;
  a county-only search read "every property"; the matches said "first 20" where the API sends 8.
- **Left as is:** `gz-property-ref` (shared) writes "Property #42" while an address can't be
  resolved: carried to item 9. Pause, Delete and Remove are `aria-disabled` without a written
  reason for the moment a save is running.
- **Checks:** `ng build` passes with the two known warnings (initial 527.88 kB). `ng test`
  63 files, 348 tests (was 61 and 325) pass (new `saved.spec.ts` and `alerts.spec.ts`). `diff -rq design-audit/.src-before-6
  src`: only `features/saved/` and `features/alerts/`. Screenshots: `screenshots/6-saved/index.html`
  (20 after, 14 before; the panes and New alert are after-only). No console errors, and no page
  wider than its viewport.

### 5. Investment studio (done, waiting for review)
- **Frame (DESIGN.md §5 Record, Studio):** h1 "Investment studio" with one line under it ("Monthly
  payments, what you can afford and rental returns, worked out on your own figures."); the eyebrow
  "INVESTMENT STUDIO", the slogan "Good decisions start with your numbers." and the "Back to
  property" button are gone. Opened from a property (`/investment-studio/:id`, "Open in Studio"), a
  line names it with a link back to its record ("For 2847 SW 27th Ter, Miami, FL 33133. Enter your
  own price: assessments and past sales are not market values."); nothing is filled in from the
  record. If the property fails to load, a warning says so with the link.
- **Tabs:** Mortgage, Affordability, Rental (the long labels were cut off at 390 px), kept in the
  address as `?mode=` with `replaceUrl`, and following it (the nav's Studio link, which has no
  mode, brings back Mortgage). All three calculators stay mounted, so switching keeps what was typed.
- **Calculators:** the assumptions (5 of 12 columns) beside the result (7), both white sections
  under a 2 px ink rule; one column below 1024 px. Fields in ruled groups ("Purchase and loan",
  "Costs you know (optional)", "Financing (optional)", "Holding period (optional)"), units in the
  labels ("$ a year", "% of rent"), two a row down to 390 px. The field ids are kept. The primary
  button is never `disabled`: it is `aria-disabled` with the reason beside it ("Enter the price,
  down payment and rate.", "The down payment can't be more than the price.", "Enter the years to
  hold for the value change to count."); the old toasts for invalid input are gone. The forms are
  signals now, so the reasons follow the typing (the app is zoneless). A blank field is sent as
  missing, never as 0, as before.
- **Results:** each leads with one figure (32 px, 28 on phones) with its label and a caption, then
  record groups or a table; the dark "darkpanel" cards and the filler empty cards ("Build your
  financing scenario") are gone; before a calculation the result says in one sentence what to enter.
  When an answer this calculator asked for arrives (or fails), focus moves to the result's heading
  and the page scrolls to it when it's off screen (`studio-focus.ts`).
  - Mortgage (new `gz-mortgage-calculator`, moved out of the page): "Each month $4,395.08",
    "Principal and interest plus the costs you entered; leaves out HOA."; the monthly lines with a
    cost left blank as Unavailable ("left blank, so the total leaves it out"); the loan amount.
  - Affordability: "Highest home price $522,000 / With a loan of up to $432,000."; the monthly
    figures; the limits used (housing costs and all debts as shares of income, rate and term, the
    rate source: `USER_SUPPLIED` reads "User supplied"); the backend's notes and disclaimer in plain
    words; Save a budget in your preferences, Explore properties.
  - Rental: cash flow each month (signed, polarity colours, true minus) when the loan is known, else
    net operating income; income and costs as a table by month and year (costs the backend gives by
    the year leave the monthly cell blank, never divided by 12; a blank input is Unavailable);
    "Financing and returns", or one sentence on what to add when there is no financing; "After N
    years" (one sentence when there is nothing to project); the backend's notes once each, in
    plain words. When the form no longer matches the figures the result came from, it says so.
  - Mortgage and Affordability bring back the figures of the result their slice still holds when
    the Studio opens again, and say when the form has changed since; after a failed request the
    error stands alone instead of an older result.
- **Saved scenarios (Rental):** a full-width section under the calculator: the name field with
  Save / Save changes, Save as new and New scenario, then a table (Scenario, Rent a month, Property
  link, Changed on the viewer's day, Open/Reload and Delete); the scenario in the form is marked "In
  the form above" with a copper edge. Saving checks what Calculate checks. A backend write error
  naming fields is replaced by our sentence. "Listed: 50 of N" when the API holds more. Guests get
  one sentence and Sign in; none saved, one sentence. A failed list now waits for Retry (it used to
  ask again on every change). Save as new keeps the open scenario's property link.
- **Shared, and why:** nothing in `shared/`. New feature files: `mortgage-calculator.ts`,
  `studio-format.ts` (money, signed money, percent and polarity that return null for a missing
  value; `joinList`; `sameFigures`), `studio-focus.ts`, `studio.css` (the calculators' layout).
  `investment-studio.html` is folded into the component.
- **Not brought back:** the overview's "Your home budget" and "Mortgage context" cards (removed in
  item 4). They ran the same calculations on inputs typed elsewhere, so the Studio stays the one
  place for them; the unused `finance-cards.ts` and its contract spec go in item 9.
- **Review of the item's diff** (independent reviewer, against `.src-before-5`): scope held (only
  `features/investment-studio/`; no store, effects, routes or config). Fixed from its findings:
  saving skipped Calculate's checks (a value change without years to hold was dropped silently; a
  down payment above the price came back as "financing.downPayment cannot be …"); Mortgage and
  Affordability showed an old result beside a blank form after coming back; the rate source showed
  `USER_SUPPLIED`; focus moved to an off-screen result without scrolling; New scenario and Delete
  dropped focus to the page; a holding period without a price showed seven Unavailable rows with no
  reason; the tab didn't follow the address; Save as new dropped the property link; "over 1 years";
  the scenario count against a list capped at 50; a caption claiming an order the list doesn't keep.
- **Checks:** `ng build` passes with the two known warnings (initial 527.88 kB; the studio chunk is
  58.89 kB). `ng test` 61 files, 325 tests (was 60 and 307) pass (new `investment-studio.spec.ts`, 18 tests, and the format
  helpers). `diff -rq design-audit/.src-before-5 src`: only `features/investment-studio/`.
  Screenshots: `screenshots/5-studio/index.html` (21 pairs at 1440 and 390, plus 1280 and 768: each
  tab empty and calculated, a saved scenario opened, rent only, opened from a property, no
  scenarios, a guest, a failed calculation). No console errors; the before build scrolled sideways
  at 390 on three shots, the after build on none.

### Check of items 3 and 4 (Nov 20, after item 4)
Items 3 and 4 were made in another session. This check reran the build and tests, read every after
screenshot of both items, and gave each item's final code to a fresh independent reviewer (against
`.src-before-3` and `.src-before-4`). The scope held: no store, effects, route or config change, and
no component calls a service. Findings, each confirmed in the code, all fixed:
1. Matched to you showed another page's value request: it skipped its own request when the slice
   held every row's value, but the slice's loading and failure are whichever page asked last. After a
   failed Explore load it said "ZentraValues could not load" over values it had; with Explore's request
   still running, every row could turn Unavailable with "no estimate was returned". It now asks again
   whenever that request is running or failed (`matches.ts`).
2. After a failed refresh, saving new preferences left "Matches could not load." with nothing asked
   for: the recommendations reducer kept the error when it dropped the answer. **Store change,
   approved by the user:** `preferencesSaved` also clears `error` (one line in
   `recommendations.reducer.ts`).
3. Retry removed itself and focus fell to the page: on Opportunities (the alert's Retry, and both
   Clear filters, which go once the filters are cleared) focus moves to the results' count (or the tab
   panel before any results); in `gz-matches` (the Opportunities tab and the buyer overview's lead) and
   the area form it moves to the section heading, and to the new heading when the answer replaces the
   section. Refresh is `aria-disabled` while it runs, so it keeps its focus.
4. After a failed filter or sort, Opportunities described the request that failed over the rows
   loaded before ("6 scored properties match these filters", the sort arrow on the failed order). The
   count, the filter count and the sort now follow the last query that answered once a request
   fails (while one runs they show what was asked for, as before); paging and sorting start from it;
   Retry asks again for the failed one.
5. The investor overview said "Every holding has a loan balance on record." when a holding was bought
   with cash (debt 0 counts as covered): now "Every holding has a loan balance or is recorded as bought
   with cash."
6. The property page wrote `scoredAt` as a UTC day ("Scored Nov 19" where the pane says Nov 18 in
   Miami): it uses `formatLocalDate`, as §13 asks (`property-opportunity.ts`).
7. The lender's approved-and-funded section kept the old period's dates and "this month" over its
   error after a failed period request: the heading and caption name no period then.
8. The investor county table tracked rows by `countyId ?? $index`, so the row without a county could
   share a key with a county id: it is a string key now.
9. Older than item 3: Top scored went blank (no rows, no message) after the session ended, because
   only `ngOnInit` asked for results. An effect now asks whenever Top scored has none (arrival, the
   tab, a reset).
10. Line endings: nine files from items 3 and 4 had been written with CRLF (`styles.css`, `matches.ts`,
    the dashboard files, `property-opportunity.ts`); all are LF again.

Not changed: the buyer overview's two unused card requests (already in the needs list, store work).
Seen in the screenshots and left for review: the docked pane's empty strip at 1440 in the public shell
(item 3's notes), the same "Matches your saved target county" reason on every matches row under the
line that already says it, backend copy naming `coveragePercent` and `generatedAt` (needs list), and
"Confidence 78 of 100" on Top scored against "Medium confidence" on Matched to you (needs list).

Checks: `ng build` passes with the two known warnings (initial 528.13 kB); `ng test` 60 files, 302
tests pass (was 59 and 294). New specs: values asked again after another page's failed or running
request, matches loading after preferences are saved following a failed refresh, focus after Retry
and Refresh (`matches.spec.ts`); the rows' own count and sort after a failed filter and sort, Retry
and its focus, the empty table's Clear filters focus, results asked again after sign-out
(`opportunities.spec.ts`); the lender section after a failed period (`dashboards.spec.ts`); the
scored day on the property page (new `property-opportunity.spec.ts`). Screenshots not retaken: the
fixes are failure, focus and session paths the harness doesn't show, plus two sentences.

### Follow-up on items 3 and 4 (Nov 20, the user's review of the check)
The user kept the approved store change and asked for three more fixes in item 3 and 4 files only,
without store logic changes. Done:
1. **Matched to you, repeated reasons:** a reason every loaded match has (all 8 say "Matches your
   saved target county: Miami-Dade, FL") is said once above the table, "Every match: ✓ …" (taken
   over every loaded match, so it stays true on the overview's top 5). The column, then headed
   "Other reasons", keeps only what differs between rows ("No other reason" in a row without one)
   and is left out when no row has a reason of its own, as with the full mock account.
2. **One confidence format** (written into DESIGN.md §9): the score with its band, "Confidence 78 of
   100 · Medium" ("78 of 100 · Medium" in a row labelled Confidence), Low in attention; the score
   alone without a band, "Medium confidence" without a score, "Confidence not stated" with neither.
   A band is never worked out from a score: the model sets the band per segment and gives each band a
   fixed score (90, 70, 40, `geointelli-models/src/pipeline/README.md`), while scored valuations
   carry other scores (78). Matches take the prediction's `confidenceScore` and `confidence`; the
   Top scored table and the record pane take the score's own "Valuation confidence" factor: its value
   and the band its explanation states ("… 78 of 100 (medium confidence) …"), since opportunity rows
   have no confidence field. Shared helpers `formatConfidence` / `formatConfidenceValue` /
   `isLowConfidence` in `shared/data/format.ts`. The property page's `gz-zentra-value`, Explore cards
   and Compare still show the band alone: carried to item 9 (outside the item 3 and 4 files).
3. **No raw field names:** new `plainNote` / `plainNotes` (`shared/data/format.ts`) write a known
   field name in backend copy in the page's words ("Evidence coverage is the highest score the
   available evidence allows.", "Source freshness is unavailable; the “Updated” date is the response
   time, …") and leave out a note that still names a field (camelCase or snake_case). Used by the
   score notes (`splitVersionNotes`: Opportunities and the property page), the matches limitations,
   and the investor and lender overviews' backend notes and disclaimer (none names a field in the
   mock today). DESIGN.md §13 has the rule; §16 #9 and #11 are updated.

Left for item 9, as the user asked: the empty strip beside the docked record pane at 1440.

Checks: `ng build` passes with the two known warnings (initial 528.13 kB); `ng test` 60 files, 307
tests pass (was 302). New and changed specs: the shared reason line, "Other reasons" and "No other
reason", per-row reasons kept when none is shared, plain limitations (`matches.spec.ts`); the score
with its band, the band's absence and Low (`opportunities.spec.ts`); the format and note helpers
(`shared-kit.spec.ts`). The specs caught two mistakes on the way: the note pattern was written with
`\b` inside a template string (a backspace character, so every note was hidden) and the shared line
had no space after "Every match:".

### 4. Persona dashboards (done, waiting for review)
- **Frame (DESIGN.md §5 "Overview", §8):** every persona's page is the h1 "Overview" (the eyebrow
  "YOUR LENDER WORKSPACE", "Welcome, Dana." and the slogans are gone, and so is the header's "Explore
  properties" button: the nav is the shortcut list), one lead section full width, then at most two
  columns (one below 1024 px). The investor portfolio and lender organization selects moved into the
  header's actions (ids `dash-portfolio` and `dash-org` kept). Sections are a new dashboard component,
  `section[gz-overview-section]`, the same frame as framed `gz-matches`. Every section has its own
  skeleton, its own failure (one sentence and Retry) and its own empty state (one sentence and the
  action that creates the first one); no zero tiles anywhere. The page opens a persona's overview
  only once the account says which persona it is (before, a lender's page rendered the buyer
  component while `/users/me` loaded).
- **Removed for every persona:** the KPI tiles above the lead, the saved/searches/alerts trio, the six
  shortcut cards, and the cards §8 doesn't list: Recent activity (user) and Your home budget (buyer,
  investor), Top-scored opportunities (investor), Mortgage context (lender), Newest leads and Newest
  clients (realtor), the lender's application pipeline bars and recent-applications table (their LTV
  moved into the lead). `dashboard-overview.ts` is deleted; `Recommended`, `TopOpportunities` and
  `RecentActivity` are removed from `dash-ui.ts` (nothing else used them). `finance-cards.ts`
  (affordability and mortgage context) is kept unchanged and unused by the overview, because
  `unused-endpoints-contracts.spec.ts` covers the affordability card's contract; where it belongs is
  item 5's call.
- **Buyer:** lead `gz-matches [limit]="5"` reused from item 3 (no copy): PARTIAL/READY table with
  "See all 8 matches", the inline "Set your area and budget" form for NO_PREFERENCES /
  LOCATION_REQUIRED, "No matches for these preferences" for NO_MATCHES, the guests' sign-in line
  (guests see only that). Then Saved searches (Search, Checked, Saved) and Alerts (Alert with what it
  watches, Checked, Status, "Paused with its search" when only its saved search is paused) from the
  user dashboard cards, newest first by creation, captioned "5 searches" or "5 newest of 7 · 5
  active, 2 paused".
  Empty: "Searches you save in Explore will appear here…" + Explore properties; "Alerts tell you…"
  + Create an alert.
- **Investor:** lead = the scope's strip, Value / Debt / Equity: partial figures carry "Partial: 3 of
  5 holdings valued" (spec text), "… with a known balance", "… with value and debt" and the coverage
  bar; complete ones "2 of 2 holdings valued" without the label; a figure no holding covers is
  Unavailable with its reason (never $0 or "Partial: 0 of 5"). Under it the one action that raises
  coverage: "2 holdings have no loan balance, so debt and equity leave them out." + **Add balances in
  Portfolio** (the count is the debt metric's uncovered holdings: financed without a balance, or
  financing unknown), or "Every holding has a loan balance or is recorded as bought with cash." (wording
  from the check of items 3 and 4) + **Add a holding**; then the
  sources and the backend's note. No portfolio: "The value, debt and equity of what you own will
  appear here." + Create a portfolio, and no columns. Occupancy: rental occupancy as a one-figure
  strip ("2 of 3 rental holdings rented"), holdings by occupancy with a one-hue bar under each
  status drawn against all holdings (UNKNOWN is "Not recorded"), "Occupancy is recorded for 4 of
  them", holdings by county with the backend's percent. Cash flow: one portfolio only (several in
  scope: "Choose one portfolio above…"); Income / Expenses / Net cash flow ("From records on 2 of 5
  holdings", no Partial label, §6; the summary's record count in the caption), then categories with
  a Type column and signed
  full amounts in the polarity colours (§14); no records: "Income and expenses you record for Family
  homes will appear here…" + Record income or an expense. No monthly bars: the summary has no
  monthly series.
- **Realtor:** lead = "Overdue and due this week", the tasks-pipeline card's tasks as a table (Task,
  Due, Status; overdue first with "Overdue" in attention and the day it was due), caption "4 overdue ·
  7 due in the next 7 days", the rows on screen against the card's counts ("Listed: 4 of 4 overdue
  and 5 of 7 due in the next 7 days.") and "Mark tasks done in Tasks." Rows link to Tasks: no action can mark a task done from this route (needs
  list). Empty: "No tasks due in the next 7 days." + New task (primary). Then Pipeline by stage (deals,
  then leads; `gz-stage-bars` in the ordinal ramp, each stage opening the filtered CRM list, so
  `.stages a` stays) and Recent activity (the CRM feed). The license notice stays under the h1
  ("Verify your license" kept); its text and link are one flex item now (they split into spaced
  pieces before).
- **Lender:** lead = "Waiting for review": each stage as the pipeline sends it ("Submitted 4 ($2.21M
  requested) · Under review 4 ($3.10M requested)"), the Submitted and Under review applications held
  by the slice, oldest update first (Applicant with loan type, Stage, Requested, Last update, LTV
  with "of $1.18M requested", Limited estimate, or Unavailable with the analysis' reason; "No
  property linked"; on phones the LTV is a second line), "Listed: 1 of 4 submitted and 2 of 4 under
  review. The overview receives only the 6 newest applications…", the
  LTV source and the disclaimer as sent, and **Open Applications** (`/loan-review?tab=applications`).
  Nothing waiting: "No applications waiting." + New application; none of the 6 waiting: a sentence +
  Open Applications; no organization: "Create your lending organization…" + Set up organization and
  nothing else. Then "Approved and funded this month" (two-figure strip, captions "5 applications" /
  "3 loans", which fixes "1 loans"; the backend note; the period form behind "Change period", ids
  kept, starting from the period the slice holds) and "Loan mix" (`gz-mix-bar` plus a table twin that
  is also the legend; DESIGN.md §11). EMPTY months say "No application was approved or funded this
  month." / "No loans were funded this month."
- **`admin` role:** no route change: the overview sends an account whose rail leads with the admin
  pages (persona USER with the admin role) to `/admin/import-jobs`, replacing the history entry. An
  admin with a persona keeps that overview (`admin-lender-1440`).
- **Shared, and why:**
  - `gz-kpi` (in `dash-ui.ts`, used only by the overviews) is now `div[gz-kpi]` inside
    `<dl class="kpi-row">`, as DESIGN.md §12 asks: label `dt`, figure `dd.kpi-value`
    (spec-asserted), caption `dd`. A link is the label, stretched over the figure. The strip's CSS
    moved from `styles.css` into the component (it loads with the overview), and it wraps any count
    cleanly (an odd last figure takes the row when it wraps to two columns). The deprecated `icon`
    and `tone` inputs are gone. No other page uses it.
  - New `gz-overview-section` and `gz-mix-bar` in `features/dashboard/overview-ui.ts`: feature
    components like `StageBars`, not in `shared/` (nothing else needs them yet; Loan review could
    import the bar in item 7).
  - `gz-matches` (item 3): "See all N matches" is copper (it was ink, like every unstyled anchor).
    Only the overview passes `[limit]`, so Opportunities looks the same.
  - `styles.css`: removed the old overview rules (`.dash-*`, `.rec*`, `.shortcut`, `.trace`,
    `.chips`, `.flow`, `.mix*`) and the strip rules that moved into `gz-kpi` (about 5 kB of source).
    `StageBars` (CRM, Loan review) and its global `.stages` rules are unchanged.
- **Specs:** `dashboards.spec.ts` rewritten where the markup changed on purpose: the realtor KPI
  values, newest leads and newest clients are gone (now the task table, its counts and "Mark tasks
  done in Tasks."); the lender's four tiles are now the waiting table and a two-figure strip
  (`.kpi-value` ['$250K', '$240K']; "1 loans" became "1 loan"); the lender without an organization
  shows no figures at all (it had 4 Unavailable tiles); the investor strip is Value/Debt/Equity then
  rental occupancy (`.kpi-value` ['$1.20M', '$400K', '$500K', '67%']; "Partial: 3 of 5 holdings
  valued" kept); "Create a portfolio to start" (a tile's reason) is gone with the tile. Kept:
  `.stages a` (`/crm/deals?stage=OFFER`), "Verify your license", "not a credit decision". New: realtor
  nothing due; lender waiting order and filtering, the "2 of 3 listed" note, Open Applications' link,
  the hatched unknown loan type, nothing waiting; investor coverage action, complete coverage, cash
  flow rows, an uncovered figure as Unavailable; buyer area form + saved searches + alerts, a failed
  section's Retry; the admin-only redirect, an admin with a persona, no persona overview before the
  account loads. `dash-ui.spec.ts`: the strip as a `<dl>` with a covering link, the mix bar and
  `shareText`.
- **Checks:** `ng build` passes with the two known warnings; initial 528.12 kB (-3.79 kB against
  item 3's 531.91 kB: the strip and old overview CSS left the global sheet, now 35.28 kB raw); the
  dashboard chunk is 57.2 kB (it now carries `gz-matches` and the area form). `ng test` 59 files,
  294 tests pass after the review fixes (was 59 and 273; 285 before them). `diff -rq
  design-audit/.src-before-4 src`: only the dashboard
  files above, `opportunities/matches.ts` and `styles.css`; no store, effects, reducers, selectors,
  actions, routes, route providers, `store/index.ts`, config or dependency change. Screenshots:
  `screenshots/4-dashboards/index.html` (34 pairs, at 1440 and 390 plus a few at 1280 and 768:
  every persona with data, buyer no-preferences / no-matches / guest / failed section, investor
  partial / one portfolio / complete / no portfolio, realtor nothing due and loading, lender nothing
  waiting / no organization / failed pipeline, admin-only and admin lender). No console errors in any
  shot. `redesign-shots.cjs` now also reports a page wider than its viewport ("horizontal scroll: Npx")
  on every shot: no overview scrolls sideways at any width (the before build's buyer overview did, by
  2 px at 768). The one hit is `admin-390`, which after the redirect is the Import jobs page: it is
  205 px wider than a 390 phone. `import-jobs.ts` is unchanged by this item; it is item 8's page.
- **Left as is:** the buyer lead carries `gz-matches`' footnotes as item 3 built them (the backend's
  limitations as sent, six lines in the full account). The lender LTV column draws the hatch across
  its width when the property has no supported valuation (the reason is written under the word).
  The overview keeps the scope switchers in its header until the top bar has an app-level scope.
  "Your home budget" and "Mortgage context" no longer appear anywhere (item 5 decides).
- **Review of the item's diff** (independent reviewer, against `.src-before-4`): no high-severity bugs;
  scope, spec-asserted selectors and text, the admin redirect and the `styles.css` removals were
  fine. Fixed from its findings:
  1. Ordering copy: the user cards hold the newest items by creation and the lender API lists
     applications newest first by id, not "most recently changed / updated". Now "5 newest of 7",
     "the 6 newest applications", hidden captions "newest first", and the buyer's date column is
     Saved (`createdAt`, the order the card uses) instead of Changed. DESIGN.md §8 and §16 #14 too.
  2. Focus: every section's Retry disappeared when pressed and focus fell to the page. Retry now
     calls `retried()` on its `gz-overview-section`, which focuses the section's h2 (`tabindex=-1`).
     The lender's "This month" removed itself and collapsed the period form: the form now stays open
     (its `open` is set once, on arrival) and focus moves to its summary.
  3. The lender's LTV column is hidden on phones: the second line now carries it ("LTV 72% of $1.18M
     requested", "LTV unavailable: <reason>", "LTV: no property linked").
  4. The investor's county share was recomputed from counts: it is the backend's `holdingPercent`.
  5. Client-side totals: the lender caption summed the two stages (now each stage's count and
     requested amount as sent), and the listed note relied on that sum (now "Listed: 1 of 4 submitted
     and 2 of 4 under review."; the realtor's "N more" became "Listed: 4 of 4 overdue and 5 of 7 due
     …" the same way); "All portfolios · 7 holdings" summed page 0 of the list (now the
     all-portfolios card's own `totalHoldings`, shown only when that card is loaded); Income and
     Expenses captions summed category record counts (dropped; the summary's `recordCount` is in the
     section caption). Loan-mix shares are taken against the card's funded count (`gz-mix-bar`
     gained a `total` input).
  6. Realtor dates dropped the year: due days, due times and activity dates use `formatLocalDate`
     (§13).
  7. Empty columns: the loan mix's colour column (all cells hidden) is gone, the swatch sits in the
     Loan type cell; the occupancy table's bar-only column is gone, each bar sits under its status
     and is drawn against all holdings (it scaled to the largest status, so Rented 3 of 7 drew full
     width), with a note saying so.
  8. Cash flow without income and expenses (`financials` null) now has Retry.
  9. Refetch: `gz-overview-section` takes `[busy]`, so a section refetching keeps its previous render
     at 60% with `aria-busy` (every section passes it). The lender's funded heading, "this month /
     in this period" and the loan-mix caption follow the card on screen (a `linkedSignal` that keeps
     the previous answer while a new period loads), not the period just requested.
  10. A portfolio deleted elsewhere while in scope: the cards were asked for it, the list moved the
      scope to all portfolios, and nothing asked again ("could not load" until Retry, or the old
      portfolio's figures under "All portfolios"). The overview now shows no card whose
      `portfolioId` isn't the scope in view, and asks for the scope in view with the existing
      `selectScope` once the list has moved it (no store change; the store issue is in the needs
      list).
  11. Specs added (`dashboards.spec.ts`, 24 tests there now): switching portfolio shows a skeleton,
      not the old figures; the lender organization switch; the period form, the heading kept while
      the new period loads, and "This month" with focus on the summary; no admin redirect while the
      profile is null, then the redirect; guests see the sign-in line only and nothing is asked for;
      Retry with focus on the section heading for buyer, investor, realtor and lender; the overview's
      `gz-matches` with 5 rows and "See all 8 matches"; the ordering copy; the deleted-portfolio
      scope; the phone LTV line; occupancy bars against the total; the all-portfolios count. The
      spec helper skips requests a `switchMap` already cancelled.

  Left, with the reason: "N holdings have no loan balance" is still the debt metric's total minus
  its covered holdings (the §8 action needs that count and the card sends no other); the mock
  fixtures sort the user cards and lender applications by `updatedAt`, unlike the backend (needs
  list); Import jobs' overflow at 390 is item 8's. After the fixes: initial 528.12 kB (unchanged),
  294 tests pass, the 34 after shots have no console errors and no overview overflow (the only hit
  is still Import jobs at 390); the lender lead shows the per-stage caption and the phone LTV line,
  the occupancy bars sit under their statuses, and the realtor and lender notes read "Listed: …".

### 3. Opportunities and recommendations (done, waiting for review)
- **Frame (DESIGN.md §5 register, §7, §8):** h1 "Opportunities" with one line under it ("Properties
  ranked by the evidence behind their ZentraValue, or matched to your area and budget."); the eyebrow
  and slogan are gone. The two tabs stay (Top scored, Matched to you; `?view=matches` keeps the tab in
  the address, arrow keys move between them). The page is wrapped in `gz-desk`, so it is a register
  in both shells: fluid in the pro shell (investors' "For you"), the 1200 px frame in the public one.
- **Top scored:** the card grid became a ranked table (`gz-table`): Rank, Property (address link to
  the record, place and county), Score of 100 (a 64 × 6 px bar: ink the score, rule-strong what the
  evidence on record could still earn, hatch what no evidence covers; "Evidence covers 50 of 100"
  under it, the plain words for `coveragePercent`), ZentraValue (the value the score used, full
  money, with a 12 px confidence line), Next 12 months (signed, true minus), Strongest evidence (the
  factors that earned points, as `gz-reasons`: two lines then "+N more"; priority 3, so it hides while
  the pane is docked and under 1024 px). Score, ZentraValue and Next 12 months are sortable headers
  mapped to the API's four orders (the one-way ones stay "high to low" when clicked again); the Sort
  select stays in the filter bar for phones. Filters keep their ids and validation; on phones they
  fold behind one Filters button with the active count. The scoring version moved under Method; the
  backend notes stay as sent under the table (the one naming the scoring version goes under
  Method), with one line explaining the score bars. Sorting re-sorts what is applied (it never reads
  the form or the shared location picker); Clear filters also clears the picker.
- **Record pane:** a click or Enter on a row opens `gz-record-pane` in the Desk: docked at ≥ 1360 px,
  a sheet with the shell scrim at 1024-1359, its own page with Back below. Header: position ("1 of 6
  on this page"), previous/next/close, address, place and folio, then Open property record and
  Compare. Body (`gz-opportunity-record`): Score (24 px figure, coverage bar and sentence, "A research
  aid… not advice to buy"), Factors (`gz-score-factors`, compact), Valuation the score used (ZentraValue,
  an 80% range row that is Unavailable because scores don't store one, confidence, next 12 months,
  sales through, scored; each missing value writes its reason under the word), Method (scoring
  version, valuation run, the backend note naming the version). Up/Down move the selection and the
  pane follows; Escape closes and focus returns to the row (Escape inside a field is the field's);
  previous/next keep focus in the pane at the first and last record; the pane closes when its row
  leaves the results, the page changes or the tab is left.
- **Matched to you (`gz-matches`, `features/opportunities/matches.ts`):** the §8 buyer lead, built to be
  reused by item 4's overview (`[limit]`, "See all N matches", framed by default; the page passes
  `[framed]="false"`). It loads the suggestions itself when signed in and none are held (also after
  preferences are saved, since the reducer drops the answer then) and the rows' ZentraValues once per
  set of rows with the existing bulk prediction action. States, all from the fixtures:
  - READY / PARTIAL: "Matches for your search", count and "Updated Nov 18", Edit preferences and Refresh,
    the applied line ("Matched on your target county: Miami-Dade, FL." or "Partial: matched on your
    target county only (Miami-Dade, FL). Your budget and goals were not applied."), then the table:
    Rank, Property, Beds, Living area, ZentraValue (confidence word, low in attention; skeleton while
    loading; one merged rowspan Unavailable span with Retry when the values fail, §6 merging), Reasons
    (the backend's reasons as sent; UNKNOWN/NOT_REQUESTED budget and goal checks are no longer printed
    as "Budget: UNKNOWN" on every card). Client-side sort with "Sorted within these N matches".
    Footnotes give the Unavailable reasons and the backend limitations; ranking method, source and
    records-as-of moved from prose (`COUNTY_MATCH_THEN_PROPERTY_ID_ASC. … Source: PROPERTY_RECORDS`)
    to Method in plain words.
  - NO_PREFERENCES / LOCATION_REQUIRED: `gz-area-budget-form`, "Set your area and budget" (state and
    county through the shared county picker, budget from and up to, Show matches), never "0
    suggestions"; unframed on the page like the other states. It saves through the existing
    `UserActions.savePreferences`, keeping the goals and counties already saved, fills untouched
    fields with a saved budget, says why Show matches is disabled (tied by `aria-describedby`), and
    won't save over preferences it couldn't read: it says whether the account or the preferences
    failed, with Retry (`UserActions.load` / `loadPreferences`). `opp-matches-saved-1440` shows the whole flow: save, toast,
    matches.
  - NO_MATCHES: "No matches for these preferences", the counties searched, Edit preferences and
    Explore properties. Guests: a sign-in line with Sign in and Create account. Errors: one sentence
    and Retry.
- **Shared, and why:**
  - New `gz-score-factors` (`shared/components/score-factors.ts`): the factor table the property page
    drew inline in item 1, moved into one component so the pane and the property page draw a score the
    same way (`[compact]` drops the Evidence column for 420 px). `property-opportunity.ts` now uses it;
    its Valuation tab renders as before (checked against item 1's screenshot height and by eye).
  - `gz-reasons`: one reason may wrap onto a second line before it is cut (§14 bug 1 "wrapping to at
    most 2 lines"); two or more still take a line each. Affects the dashboard's Recommended card too.
  - `gz-desk`: a docked pane in the public shell gets a right edge, since the 1200 px page ends before
    the window at 1440. No other page docks a pane yet.
  - From the review fixes: `gz-desk` leaves Escape inside a field to the field; `gz-record-pane` keeps
    focus when previous/next reaches the end; the record row gains an optional `showReason`;
    `format.ts` gains `formatLocalDate` for instants; `score-factors.ts` exports `splitVersionNotes`
    (also used by the property page's opportunity score). None changes another page's look.
  - No new component for the matches or the record: they are feature components in
    `features/opportunities/` (the overview may import them, as CRM imports `dash-ui`).
- **Wording fix (DESIGN.md §10 heat):** the neutral middle class is now described by its real ranges
  from `growth-grid.ts` (breaks unchanged): +3.5% to +5% a year (annual), +50% to +100% (total), +1%
  to +2.5% (12-month forecast), "not centred on 0%". The app's growth legend and panel label every
  class by its range and never said "around 0%"; only the code comment in `growth-grid.ts` called the
  middle class "about typical", and it now names the same ranges.
- **Checks (after the review fixes):** `ng build` passes with the two known warnings (initial
  531.91 kB, +0.09 kB against item 2's 531.82 kB; the opportunities chunk is 57.5 kB). `ng test` 59
  files, 273 tests pass (was 56 and 230; 257 before the review fixes): new `opportunities.spec.ts`,
  `matches.spec.ts` (with the area form) and `score-factors.spec.ts` (with the one-or-two-line
  reasons), plus one test each in `desk.spec.ts` (Escape in a field) and `shared-kit.spec.ts` (local
  dates). No existing spec asserted the old page, so none changed.
  `diff -rq design-audit/.src-before-3 src`: only the files listed above; no store, effects, reducers,
  selectors, actions, routes, route providers or `store/index.ts`; no dependency or `angular.json`
  change. Screenshots: `screenshots/3-opportunities/index.html` (28 after, 22 before; the four pane
  shots and the filled and saved form are after-only). `redesign-shots.cjs` gained `prep`
  (server state through the mock API before the page opens), `fail` (a 500) and `hold` (never
  answered, the loading state). No console errors in any shot.
- **Left as is:** the docked pane in the public shell sits inside the 1200 px frame, so at 1440 a strip
  of page shows to its right (it has a right edge now). The Strongest evidence column lists factor
  names only; their points are in the pane. Reasons are not shown on phones (priority 2), where the
  applied line above the table says what matched. Buyers' "Matched to you" lives on Opportunities until
  item 4 puts the same component on the overview.
- **Review of the item's diff** (independent reviewer, against `.src-before-3`). Fixed:
  1. Sorting (headers and the Sort select) rebuilt the query from the form and the shared location
     picker, so a county picked elsewhere or an unapplied field slipped in (or an invalid one blocked
     it while the select showed the new order). It now re-sorts the applied query only; the select
     shows the applied order; Clear filters clears the picker too (`LocationsActions.selectState`).
  2. The merged "ZentraValues could not load" span sat in the first row's markup, so a click beside
     row 5 opened row 1. It takes no pointer now (the row under it gets the click and hover) and stops
     clicks; only its Retry is interactive.
  3. Leaving Top scored hid the pane but coming back reopened it: leaving the tab closes it.
  4. The phone line under the address dropped a missing forecast: it says "Next 12 months unavailable".
  5. The pane showed a ZentraValue without a range: an 80% range row is Unavailable with its reason
     (scores don't store one; the property record shows it). No new data is fetched: no selector holds
     these properties' explained valuations.
  6. Missing "Sales through" and "Valuation run" had screen-reader-only reasons; "Confidence" and
     "Scored" printed "Not stated". All four are the marker with the reason written under the word
     (new optional `showReason` on the shared record row).
  7. The backend note "Version opportunity-v1 scores…" put the version in prose under the table: notes
     naming the version now sit under Method (shared `splitVersionNotes`), on the property page too.
     The spec's fixture now carries that note and checks that nothing outside Method names the version.
  8. "1 scored property match these filters": the verb agrees.
  9. After paging, the count scrolled under the sticky top bar: `scroll-margin-top`.
  10. The area form waited forever when the account failed to load: it says whether the account or
      the preferences failed, with Retry; a saved budget no longer overwrites a field already typed in.
  11. Coming back to the tab asked for the values again: it skips the request when the valuation
      slice already holds every row. Left: a row with no estimate can't be told from one never asked
      for, so such a set is asked for again (listed under Needs backend).
  12. Escape inside a filter field closed the docked pane: Escape in a field is the field's.
  13. Previous/next at the first or last record disabled the focused button and focus fell to the
      page: it moves to the other arrow, or the title.
  14. The disabled Show matches' reason is tied to it with `aria-describedby`.
  15. The area form is unframed like the other states on the page; "Saved to your preferences."
      now says what Show matches will do; `signedPercent` never writes "−0.0%"; `generatedAt`,
      `scoredAt` and `sourceAsOf` are written on the viewer's own day (new shared `formatLocalDate`;
      calendar dates keep `formatRecordDate`); heading and field ids are unique per instance.
  16. Specs added for all of the above: sorting with a county in the shared picker and an invalid
      unapplied field, Clear filters clearing the picker, the merged span click, the tab switch, arrow
      keys / Enter / Escape with focus back on the row, Next at the last record, ranks on page 2 and the
      pane closing on a page change, the verb, the pane's written reasons, already-saved counties,
      min > max and negative budgets, a typed budget kept, account and preferences load failures,
      skipped value requests, Escape in a field (Desk), local dates.

  Left, with the reason: the location picker on this page still shows the shared slice's choice when
  you arrive (it may differ from the applied filter until Apply or Clear filters); making it
  page-owned would need the picker or the slice to change. Re-asking for values when a row has no
  estimate (item 11). After the fixes the 28 after screenshots show no console errors; the pane at
  390 shows the range row and the written reasons, the area form sits unframed on the page, and the
  version note no longer appears under the table.

### 2. Explore and parcel search (done, rebuilt Zillow-like after review; waiting for review)
- **Why it was rebuilt:** the first version (a sortable table beside a docked map, following
  DESIGN.md §7) went to review and the user asked for Zillow instead: a map first, choose a state,
  properties as cards with photos, and a click shows the parcel boundary in brown on the map. That
  overrides, for Explore only, the table plan and CLAUDE.md's "no grid of identical cards" (recorded
  in DESIGN.md §5). The user also approved two store pieces: placing every result on the map, and
  ZentraValues on the cards.
- **Frame (DESIGN.md §5 Explore):** filters across the top (state, county, address, city, minimum
  beds, one sort select), then the map on the left and the results on the right
  (`clamp(480px, 46vw, 860px)`). On desktop the page fills the screen and the cards scroll in their
  own column beside a still map. Map pages are full bleed (`.page.wide` lost its padding).
- **Start:** no state chosen: the map shows the whole country and the results column asks
  "Choose a state to see its properties on the map." with a button per state from the backend
  (Florida in the mock). The page no longer lists every property before a state is chosen.
- **Cards (`gz-explore-card`, new):** photo with the type and the save heart over it; the ZentraValue
  first (20 px, the word ZentraValue, the confidence; Unavailable on the hatch with "No estimate was
  returned for this property."; a skeleton while loading); one facts line, with "Unavailable: beds,
  baths" for what the record lacks; the address (link to the record) and the place; Compare
  (checkbox) and "Show on map". The picked card has a copper border. Notes under the cards say the
  ZentraValue is an estimate, not an asking price, give the Unavailable reason, and the sort rule
  (unknown values last, as backend master sorts).
- **Map (`gz-explore-map`, rewritten):** each result is a white pill with its compact ZentraValue
  ("$985K"), or a hatched dot without one; a page is fitted into view once placed; the card under
  the pointer turns its pill ink; picking a card or a pill zooms to the parcel and outlines it in
  copper (3 px, 20% fill), with a copper pill and a permanent label; a pill click scrolls its card
  into view; "Show all on this page" fits the page again. The legend counts what is placed, names
  results with no boundary on record, and offers Retry when lookups failed.
- **Store (approved):** a new feature slice `exploreMap` (`store/explore-map/`): `Place properties`,
  `Placement found` (null when the folio has no boundary, a 404), `Placement failed` (any other
  error; placing again retries). Its effect looks parcels up four at a time, one page at a time: a
  new page replaces the lookups still pending for the page before (`switchMap`), asking again for
  lookups that are running restarts nothing, and its bookkeeping starts over when the session ends
  (inside `defer`). It is
  registered in `featureStores` and on the `explore` route's providers (the route had none; no
  existing route, provider, action or reducer changed). Values: the page dispatches the existing
  `ValuationActions.loadBulk` once per page and shows its own error copy. Both requests are made
  once per page; places only while the map is shown.
- **Phones and tablets (< 1024 px):** List / Map switch; the map is deferred, so Leaflet loads and
  results are placed only when Map is chosen. "Show on map" switches to the map and names the
  picked property above it with its ZentraValue.
- **Parcel search (`/explore/live`, §5 live map):** unchanged since the first review. h1 "Parcel
  search"; the search, notices, address matches and the growth section (`gz-growth-panel`) in a
  420 px panel beside a full-height map; "Parcels / Growth since last sale" and "Street / Satellite
  / Terrain" at top left (street, greyscale, is the default); ink parcels with the found one copper
  (CSS classes; Leaflet's blue and green are gone); BrBG-7 growth squares; model versions under
  Method; a disabled Search says why. Its view state became signals (the app is zoneless).
- **Leaflet stylesheet (approved):** `leaflet.css` is a lazy bundle with `src/map.css` (the §10 look
  for Leaflet's own markup), added first in `<head>` by the map that needs it. Initial -11.07 kB
  from this alone.
- **Shared fixes found on the way:** shared table rows now carry the `gz-row` class
  (`[gz-row]="id"` leaves no attribute, so the table's `tr[gz-row]` rules for the pointer and the
  row focus ring never matched, on any table since the foundation). The mock search now sorts
  unknown values last in both directions, as backend master does. The comparables map is a named
  map region instead of `aria-hidden` (Leaflet makes it a tab stop).
- **Review of the first version** (independent reviewer, against before copies of every touched
  file). Fixed then, and still true of the rebuild: `@defer` really defers the map (`rowTitle` moved
  to `explore-row.ts`; it had pulled Leaflet into Explore's chunk); maps are named regions, not
  `aria-hidden`; each map page shows only errors from its own requests; a fractional width can't
  fall between the CSS and script breakpoints (1023.98 px). Its findings about the docked map's
  folio-lookup races, the table at 1024 px and the "choose the row again" retry concerned code the
  rebuild replaced: placements now come from the store slice, not the shared parcel-search slice.
- **Review of the rebuild** (a second independent reviewer, on the slice, cards, page and map).
  Fixed from its findings:
  - The map drew over the shell's toasts, menus, sheet and bottom bar (Leaflet's layers use
    z-index 400 to 1000 and nothing isolated them): the map slot and the map now isolate them.
    `explore-toast-1440` shows a guest's sign-in toast over the map.
  - Lookups queued when the session ended stayed marked as running for the app's life, so
    "Placing…" could stay up forever with no Retry: the effect was redesigned (above).
  - Lookups for pages already left were never cancelled and held up the page on screen.
  - "Loading states…" could show forever after a reset or an empty answer: the states are asked
    for again once, and an empty answer says "No states are available yet." with Check again. The
    once-per-page keys now reset with the results, so a page that comes back is asked for again.
  - The map said "No properties match these filters." when the search had failed; it now says
    the properties could not load, and the search error stays visible in the phone map view.
  - While values loaded, or after they failed, every pin was the hatched "No ZentraValue" dot: pins
    are plain until the values are in, the legend says when they failed, and tooltips and the
    phone's picked line say "unavailable", "could not load" or "loading".
  - The header put the old total next to a new place: it says "Loading properties in Georgia…"
    and shows no count after a failed search.
  - On phones the map ran below the fold: in Map view it now fills the screen under the switch,
    the header and the picked property, and the filters move to the List view.
  - Switching from List back to Map moved the map even when nothing had changed; every catalog
    change (photos arriving) redrew every pin; "Placing…" overlapped "Show all"; "All 1
    properties"; "Show on map" had the same name 20 times and lost focus on phones (it is now "Show
    on map: <address>", and focus moves to the picked property above the map); paging focus below
    1024 px.
  - Its spec findings: Retry is now tested through real lookups, the session restart and the
    phone path ("nothing placed until Map is chosen") have specs.
- **Left as is:** pins still redraw as each placement arrives (about 20 times while a page is
  placed), which can close an open hover label during that second. The map specs still can't start
  Leaflet (jsdom has no layout), so pins, outlines, fitting and zooming are checked in the
  screenshots, not in specs. The top-bar search list can't be shown over the map in this screenshot
  harness: it has never stayed open here (item 0's `nav-search` shots show the same).
- **Checks:** `ng build` passes with the two known warnings (initial 531.82 kB: -14.03 kB against
  item 1; the new slice adds about 1.9 kB because `store/index.ts` imports every feature slice
  statically). Explore's chunk loads the map chunk with a dynamic import and has no static Leaflet
  import (checked in the build output). `ng test` 56 files, 230 tests pass (was 50 and 204).
  Screenshots: `screenshots/2-explore/index.html` (25 after, 20 before; explore-pick, explore-pin,
  explore-pick-390, explore-toast and comparables are after-only). No console errors in any shot.

### 1. Property page and live-map dialog (done, waiting for review)
- **Record frame (DESIGN.md §5):** the address as h1 (32 px, 20 px on phones) and one facts line
  (city and ZIP, folio as 01-4137-012-0450, use, neighbourhood); sticky tabs Overview, Valuation,
  Location, Sales, Features, Comparables; 8 columns of content beside a sticky 4-column aside. The
  eyebrow, the slogan, the address shown twice and "Back to results" are gone (the top bar's Explore
  link returns to the same results). Under 900 px: one column, ZentraValue under the header.
- **ZentraValue (§9):** new shared `gz-zentra-value` (`shared/components/zentra-value.ts`): label row,
  figure (40 px page, 32 px dialog), the 80% band and tick on a 90%-range scale (or the 80% range
  widened by a quarter), confidence with "from sales through", limited reasons in attention, and the
  Unavailable marker with the backend's reason when there is no estimate. Rows: next 12 months
  (labelled "Range (illustrative)", since the backend's forecast bounds are not 80% ranges) and
  last sale. A one-line form sits above the comparables table. Used in the page aside and the dialog.
- **Actions:** Save, Compare, Open in Studio and "Ask about this property" sit in the aside (and on
  the Comparables tab's one-line ZentraValue). Ask opens the contact form in a new shared sheet
  (`shared/layout/sheet.ts`): 420 px, full screen on phones, shell scrim and Escape, page inert behind
  it, focus to the title and back to the button. The form is no longer under every tab. Its disabled
  Send button now says why.
- **Overview and Sales:** photos only when there are some (or loading/failed); Property facts
  (`gz-property-facts`: Building, Land, County record, Owners) as ruled groups with the Unavailable
  marker and one reason per group; the sales chart gains the monthly ZentraValue line and 80% band
  from the newest page of published valuations; Sales adds a sortable Assessments table
  (`gz-property-assessments`). Living area reads `buildingActualArea`, the same field as cards and
  Compare.
- **Valuation tab:** Forecast on the shared time chart (monthly line, estimate, 1-, 3- and 7-year fan
  at their true dates; the fan has its own "illustrative" legend entry) with a table twin;
  "What drives this estimate" and supporting comparable sales as tables; opportunity score with a
  coverage bar and per-factor point bars (missing factors hatched); valuation history as a table.
  Model versions, run IDs and scoring versions moved into "Method" disclosures. The fixed-viewBox
  chart (labels shrank on phones) and the forecast tiles are gone; the dashed 3- and 7-year segments
  are replaced by the fan and the "Trend scenario" label in the table.
- **Location and Features:** record sections; distances, counts and score parts show the marker when
  missing (score parts were drawn as 0-width bars before). Extra features and units are tables.
- **Comparables tab (§5, §10):** ranked table (7) beside a sticky map (5); rows select by click or
  arrow keys and highlight their pill; greyscale tiles, white price pills with an ink border, the
  selected pill filled ink, a copper "Subject" marker over a copper parcel, 32 px zoom at top right,
  legend panel; all through CSS and the layer `className` option (Leaflet lifecycle untouched).
  Phones get a List / Map toggle (CSS only). "Open in Compare" links to `/compare/:id`. Nearby
  qualified sales are a table; the selection version is in a Method disclosure.
- **Dialog:** no eyebrow; facts line; `.dialog-actions` gains "Open the full record"; the shared
  ZentraValue sits beside the record (first on phones, where the dialog is full screen); facts,
  sales and assessments use the same components as the page; the duplicate sales card and the
  sparkle icon are gone; Done is secondary. The dialog's component-CSS budget warning is gone.
- **Review of the item's diff** (independent reviewer, against a snapshot of `src/` taken at the
  start): no store, effects, route or config changes; Leaflet lifecycle and spec-asserted selectors
  kept. Fixed from its findings: the contact draft and consent carried over to the next property
  (the form is now created per property); a row tap with the map hidden on phones made Leaflet throw;
  paging valuation history dropped the monthly line; the forecast fan was legend-labelled as an 80%
  range; Living area read a different field from cards; the Comparables tab lost the page actions; a
  supported estimate without a value showed a blank cell; "within 0 mi" with no radius; the compare
  tray stayed reachable by Tab behind a sheet (one `inert` binding in `app.html`, which also covers
  the Desk's laptop sheet); heading order in the aside and dialog; the tab panel is a tab stop again;
  one alert instead of two for a failed valuation; screen-reader separators in the facts line; the
  owner's role (e.g. Trustee) is shown again. Also found while checking 390 px: the Valuation tab's
  grid children held the chart at its first 640 px width (now `min-width: 0` throughout).
- **Checks:** `ng build` passes with the two known warnings (initial 545.85 kB, 0.28 kB under item 0;
  the dialog CSS budget warning is gone); `ng test` 50 files, 204 tests pass (was 47 and 189). Specs
  updated where markup or copy changed on purpose (dialog range geometry, valuation copy, comparables
  rows, features "Unavailable"); new specs for the ZentraValue, sheet, facts, series helpers and the
  monthly line. Screenshots: `screenshots/1-property/index.html` (25 pairs at 1440 and 390, including
  limited 44, gaps 48, unsupported 49 and 46 in the dialog).
- **Left as is:** on phones Leaflet's JavaScript still arrives with the property page (the map and
  tiles start only when Map is chosen), because `comparables-map.ts` imports it statically and its
  lifecycle is on the HANDOFF list. The opportunity score's notes come from the backend and mention
  `coveragePercent`; they are shown as sent. DESIGN.md §5, §9 and §12 updated.

### 0. Shell fixes (done, review changes applied, waiting for review)
- **Start-up (revised after review, Nov 19):** item 0 first replaced the centred splash with the shell's
  own frame (rail, top bar, copper progress line, status line). Review found it worse, so `index.html` is
  back to the screen from before item 0 (`.build-start`): a small centred logo, a 180 px progress line and
  "Opening GeoZentra…" on a plain background. Three changes only: the logo is the shell's brand from
  DESIGN.md (32 px tile, "GeoZentra" at 20 px in DM Sans, was 28 px and 16 px system font) on `--paper`;
  under reduced motion nothing moves; after 8 s one line, "Taking longer than usual. Reload", shown by a
  timer. The old screen revealed its slow line with a CSS animation, which the global reduced-motion rule
  (`animation: none !important`, inlined into index.html at build) cancelled, so the line never appeared
  under reduced motion (see `0-shell/before/boot-slow-1440.png`). DESIGN.md §5 "Start-up" now describes
  this screen. The `gz.shell` hint stays: the shell itself uses it (it predates item 0). Screenshots:
  `screenshots/0-startup/index.html` (before = item 0's frame; the pre-item-0 screen is in
  `0-shell/before/`).
- **Navigation size:** new tokens `--nav-icon` 24, `--nav-btn` 40 (44 on touch), `--nav-text` 16,
  `--nav-label` 13. Rail 84 → 96 px with 24 px icons and 13 px labels (tightens under 820 px tall);
  top bars 52/60 → 60/64 px; search 360 × 40 px with 16 px text; links, account menu and More sheet at
  16 px with 44/52 px rows; avatar 36 px; bottom bar 60 → 64 px with 24 px icons (labels stay 12 px so
  "Applications" fits at 390). DESIGN.md §3, §4 and §5 updated.
- **Review fixes (top-bar search, from the foundation):** ArrowUp with nothing highlighted skipped the
  last match; the result list stayed open after tabbing away. Both fixed, with a spec.
- **Checks:** `ng build` passes (initial 546.13 kB, +0.61 kB of CSS against the start of the task);
  `ng test` 47 files, 189 tests pass; store, effects, routes, config and dependencies unchanged against
  HEAD. Screenshots: `screenshots/0-shell/index.html`.
- **Checks after the start-up revert:** only `src/index.html` changed in the app (index.html is outside
  the bundle budget); `ng build` passes with the same three known warnings (initial 546.13 kB); `ng test`
  47 files, 189 tests pass. Screenshots: `screenshots/0-startup/index.html`.
