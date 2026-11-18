# Interaction and reliability pass

Favorites use a shared control across cards and property details. A red filled heart reflects the pending intent immediately. NgRx keeps the acknowledged server collection separate, serializes writes, prevents duplicate clicks, and restores the previous appearance if a write fails. Initial collection reads are cancelled when a mutation begins so stale responses cannot overwrite it.

Public browsing remains available to guests. Account actions explain that sign-in is required without navigating away. Authentication errors offer sign-in; operation failures offer the appropriate retry. Network availability has a shared banner. API GET requests have a 20-second attempt timeout and at most two retries for transient failures; writes are never automatically retried.

Search retains its last results during refresh and errors. Saved-search, profile, alert, and portfolio drafts survive failed writes and clear only after acknowledgement. Saving prevents duplicate submissions. Saved-search and alert deletion use confirmation dialogs. Monitoring and evaluation have individual pending states.

Loading uses centered spinners. Property photos also track image-byte loading. The interface includes dismissible feedback, keyboard-operated property tabs, visible focus, a skip link, mobile navigation state, and reduced-motion support. The map is loaded when its view is selected.

Validation: 63 tests pass and the production build succeeds. The browser harness exercises the production bundle with intercepted contract fixtures, including optimistic favorites, rollback, transient search failures, retained drafts, delete cancellation, and desktop/mobile routes. This does not establish live backend availability or real-account authorization. Existing build warnings concern the property-dialog stylesheet budget and Leaflet CommonJS dependencies.

Interaction decisions follow [visibility of system status](https://www.nngroup.com/articles/visibility-system-status/) and the W3C guidance for [status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html). These improvements do not constitute a full accessibility audit.
