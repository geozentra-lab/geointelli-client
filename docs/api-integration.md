# Backend master integration

Contract source: `geozentra-lab/geointelli-server`, master commit `2a1c795ee85684e51b44faf253ccdf229456cf1a`. GitHub master and the local `origin/master` reference agreed during implementation. The backend working branch was not modified.

| Page              | Connected resources                                                                                                                                       |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Overview          | `/dashboards/user/{favorites,saved-searches,alerts}` cards with counts and recent items                                                                   |
| Explore           | Property search with backend filters, photos, favorites, named saved searches                                                                             |
| Parcel explorer   | Parcel viewport/folio/address search (address returns up to 20 cards; the shown match's boundary is fetched by folio+county), dialog, images, predictions |
| Property details  | Numeric property ID, images, prediction, location-intelligence school/transport context, sales                                                            |
| Compare           | `POST /properties/compare` side by side (2–5 IDs, `?ids=` links); ranked comparable recorded sales                                                        |
| Opportunities     | `GET /recommendations` from saved preferences, with status-specific guidance and limitations                                                              |
| Investment studio | Mortgage calculation and `POST /calculations/affordability`; optional costs omitted when unknown                                                          |
| Clients & deals   | CRM clients, leads (Idempotency-Key), tasks + summary, transactions + pipeline, activity history, notes                                                   |
| Saved             | Favorite add/remove and saved-search create/rename/pause/cadence/delete/open                                                                              |
| Alerts            | Rule CRUD, immutable targets, monitoring status, queued NEW_MATCH evaluation                                                                              |
| Portfolio         | Portfolio and holding CRUD, summary coverage, current exposure, dated financial-record CRUD                                                               |
| Settings          | GET/PATCH profile and persona; GET/PUT preferences; GET/PUT notification delivery (NEW_MATCH, CONTACT_REQUEST; unknown event types are preserved on save) |
| Property details  | `POST /contact-requests` (consent `property-contact-v1`, Idempotency-Key) to a professional from `GET /contact-requests/professionals`                    |
| Loan review       | `/lender/organizations` (+ members), `/lender/applications` (create, list, stage PATCH), `/lender/pipeline`, JSON import                                  |
| Import jobs       | `GET /admin/import-jobs` (+ `/{id}` results); shown only with the Keycloak realm role `admin`, polls while jobs run                                       |

AIZentra has no matching endpoint on the inspected master and shows service availability rather than simulated interactions (marked "Soon" in the navigation). Loan review records lender application status only; it does not approve credit or move funds. The lender mortgage-context and user affordability dashboard cards reuse the calculators with caller-supplied inputs, so the UI calls the calculators directly; the map-layer catalog currently lists only the parcels layer already rendered by the parcel explorer. Persona-specific dashboards are not differentiated yet. The local notification-service now provides the inbox described below. There is no saved investment-scenario API. Dashboard totals compose existing resources; no dashboard aggregate API was invented.

## Configuration

`src/environments/environment.ts` contains the API base URL and Keycloak public client configuration. Current local defaults are API `http://localhost:8081/api`, Keycloak `http://localhost:8090`, realm `geozentra`, client `frontend-app`. No secret belongs in this public client.

Public property browsing remains available anonymously. Owner-scoped APIs require a valid Keycloak identity. Configure allowed web origins and redirect URIs for the frontend origin and its routed pages. Startup first checks that Keycloak answers (4 s timeout); if it does not, the app starts in guest mode instead of redirecting to an unreachable server. Otherwise it uses the standard authorization-code/PKCE `check-sso` redirect to restore the Keycloak session after a reload, without relying on third-party iframe cookies. This can cause a brief redirect through Keycloak. Access and refresh tokens remain in memory. The adapter refreshes tokens before API calls, every 30 seconds when needed, on token expiration and when returning to the app. Invalid refresh tokens end the session; temporary network errors preserve it for retry. Realm SSO idle/max lifetimes still apply. Production must supply its own HTTPS API and identity URLs.

## Data and state rules

HTTP services own URLs and typed DTOs. Components dispatch actions and read selectors through the Workspace facade. NgRx entity adapters store collections by backend identifiers. Reads cancel outdated requests; mutations serialize and update canonical state only after acknowledgement. Lists use backend page metadata. Failed writes preserve the previous canonical entity and expose a retryable error.

Sign-out resets state and cancels active effects, including queued mutations and debounced searches. Tokens attach only to the configured API. Photos preserve signed display URLs and are not persisted to local storage.

Search has no listing-price field or price filter. Predictions are labeled as predictions and never substituted into portfolio market values. Nullable portfolio totals remain unavailable; known portions and coverage are shown separately. Financial cash flow is recorded income minus expenses over the selected period, not a monthly forecast or an investment return. Exposure and financing are current even when a historical financial period is selected. Mortgage optional costs stay unknown when omitted.

## Verification

Contract tests use Angular HTTP testing to check routes, identifiers, verbs, query parameters, full-property currency amounts, and omitted optional costs. NgRx integration tests cover acknowledged favorites, context changes, partial totals, sign-out cancellation and effect recovery. `scripts/browser-check.cjs` serves the production bundle and intercepts API responses with controlled contract fixtures; these are test-only and are not shipped as application data.

The local API port was unreachable during the live read probe. Authenticated end-to-end behavior against a running backend and Keycloak therefore remains an external verification step; fixture checks do not establish server availability or real account authorization.

## Notification inbox (local backend integration)

Inspected the local `../../geointelliai-server/notification-service` controller, DTOs, security configuration, and application configuration. The service runs on port 8082 and verifies Keycloak bearer tokens; ownership is derived from the token.

- `GET /api/notifications?page=0&size=5` supplies the five newest inbox items, including `read` and `readAt`.
- `PATCH /api/notifications/{id}` sends exactly `{ "read": true }` and accepts the returned item as canonical state. Failed writes preserve unread state.
- NgRx's notifications feature polls every 30 seconds after account restoration while the document is visible and online. Opening the popup refreshes immediately. Session end cancels active/queued work and clears state.
- The bell dot reflects unread items among the latest five. The backend currently provides no total unread count or push stream; no global unread count is inferred from `totalElements`.
- Details links use typed `propertyId`, `alertRuleId`, and `savedSearchId` fields, never arbitrary payload URLs. Property links take priority; other links open Alerts or Saved.
- Synthetic notifications from local save actions have been removed. Inbox records and read state now come from notification-service.

`environment.notificationApiUrl` defaults to `/notification-api`. Angular's `proxy.conf.json` forwards that path to `http://localhost:8082/api`, avoiding cross-origin browser requests because the current service security configuration has no CORS setup. Restart an already-running Angular dev server to load the new proxy configuration. Production hosting must provide the same reverse-proxy mapping, or configure an HTTPS notification API URL with appropriate backend CORS. Bearer authentication and bounded GET recovery apply to both configured APIs.

A direct unauthenticated probe of the local service returned HTTP 401, confirming reachability and authentication enforcement. Authenticated content and read acknowledgement are covered using controlled HTTP/browser fixtures; this does not claim a live account was modified.
