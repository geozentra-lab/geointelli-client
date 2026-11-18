export type SearchMode = 'folio' | 'address';

export type SearchQuery =
  | { mode: 'folio'; value: string; countyId: number }
  | { mode: 'address'; value: string };
