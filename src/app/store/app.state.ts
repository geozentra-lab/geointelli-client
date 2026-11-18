import type { appReducers, featureStores } from './index';
/** Root slices are always present; feature slices exist once their route has been visited. */
export type AppState = { [K in keyof typeof appReducers]: ReturnType<(typeof appReducers)[K]> } & {
  [K in keyof typeof featureStores]?: ReturnType<(typeof featureStores)[K]['reducer']>;
};
