# Handoff: uncommitted work (branch design-refresh, based on 155e9c0)

Scope: nearly all of `src/app` is new or rewritten since 155e9c0 (untracked: core/models, data-access,
features/*, shared/, store/; modified: app.*, styles.css, material-theme.scss, auth). 35 old files deleted
(old map/property components, old services and models). Not reviewed here: demo-video/, docs/, keycloak/,
scripts/, .claude/, proxy.conf.json, skills-lock.json.

## Finished
- Endpoint adaptation to geointelliai-server origin/master 0f60963: dashboard cards (user activity,
  realtor clients-leads and tasks-pipeline, investor value-equity-debt and occupancy-exposure, lender
  approved-funded), collateral LTV, loan type, opportunities and opportunity score, valuation history,
  scenarios and POST /calculations/investment, valuation-change alert criteria and notifications,
  realtor license, admin data quality, revaluation queue and opportunity rescoring.
- NgRx migration: all server reads and writes go through store/ (actions, effects, selectors). The
  component-scoped request() helper and 6 unregistered stub slices are deleted. Shared Remote<T> state
  in store/remote.ts. New slices: realtorDashboard, investorDashboard, lenderDashboard, investment,
  propertyInsights, realtorLicense, admin, opportunities. Typeaheads use keyed catalog.lookups.
- Pages touched: dashboard (4 personas), opportunities (scored + matches tabs), property page
  (opportunity score, valuation history), investment studio (rental tab), alerts, saved, settings
  (license), loan review, admin (import jobs, data quality, valuation operations), sidebar admin links.
- `ng build` passes (3 known warnings: initial bundle ~556 kB > 500 kB budget, dialog CSS budget,
  leaflet CommonJS). `ng test` 40 files / 144 tests pass. Run tests from C:\ (uppercase).

## Unfinished / unverified
- Signed-in pages (dashboards, alerts, settings license, loan review, admin) were never seen in a
  browser; only unit tests cover them. Public pages were checked with a fixture API.
- Unused demo components still exist: sample-source, property-table, trend-chart, ValueForecast.
- Initial bundle is over budget; not addressed.

## Fragile: a design pass should not change
- Store contracts: action names and payloads, reducer guards that drop late answers by
  propertyId / portfolioId / organizationId, and the effects' switchMap/exhaustMap choices.
- appReducers vs featureStores registration in store/index.ts and the route providers in app.routes.ts.
- Specs assert visible text and selectors: dashboards.spec.ts (.kpi-value, .stages a, "Partial: 3 of 5
  holdings valued", "Verify your license"), master-0f60963-contracts.spec.ts, property-detail dialog spec
  (.dialog-actions, .range-track i). Restyle freely, but update specs if markup or copy changes.
- Missing values must stay "unavailable", never 0: usdCompact, amount(), Kpi unavailable text.
- Shared field and button rules in styles.css (:where() base fields, .ng-touched invalid state, --control-h).
- comparables-map.ts Leaflet lifecycle (afterNextRender, ResizeObserver) and parcel placement.
