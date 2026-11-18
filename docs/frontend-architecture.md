# Frontend architecture

The Angular application follows `core`, `data-access`, `store`, `shared`, and lazy-loaded `features` directories. Feature stores use actions, reducers, effects, selectors and models; API entities are registered centrally in `store/index.ts`. UI state remains separate from API state.

See [API integration](api-integration.md) for connected routes, backend revision, authentication, contract limits and verification. Unregistered preview store files remain scaffolding for services absent from master; routed screens never use their sample records. Property test fixtures are used only by legacy pure calculator tests.

The existing parcel explorer and Material property dialog remain available at `/explore/live`; `/map` redirects there. County IDs accompany folio requests, while numeric property IDs identify images, predictions and comparable-sales requests.
