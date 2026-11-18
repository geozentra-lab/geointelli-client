/**
 * The state of one server read held in the store: the last value, whether a request is in flight
 * and the error of the last attempt. Reducers move it with the helpers below so every slice treats
 * loading, refreshing and failure the same way.
 */
export interface Remote<T> {
  value: T | null;
  loading: boolean;
  error: string | null;
}

export const idle = <T>(): Remote<T> => ({ value: null, loading: false, error: null });

/** A request started. keep leaves the current value visible while it loads (refresh, next page). */
export const pending = <T>(r: Remote<T>, keep = true): Remote<T> => ({
  value: keep ? r.value : null,
  loading: true,
  error: null,
});

export const done = <T>(value: T): Remote<T> => ({ value, loading: false, error: null });

/** The request failed; a value already shown stays, with the error beside it. */
export const failed = <R extends Remote<unknown>>(r: R, error: string): R => ({
  ...r,
  loading: false,
  error,
});

/** A dashboard card can arrive with status ERROR when the server could not build it. */
export const cardDone = <T extends { status: string; error: string | null }>(
  card: T,
): Remote<T> => ({
  value: card,
  loading: false,
  error: card.status === 'ERROR' ? card.error || 'This card is unavailable right now.' : null,
});
