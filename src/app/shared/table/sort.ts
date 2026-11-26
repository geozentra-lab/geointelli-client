/** The active sort of a table: one column, one direction. */
export interface Sort {
  key: string;
  dir: 'asc' | 'desc';
}
export type SortValue = string | number | Date | null | undefined;

function normalise(v: SortValue): string | number | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.getTime();
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  return v.trim() === '' ? null : v;
}

/**
 * Sorts rows client-side, within what is loaded (DESIGN.md §7: say "Sorted within this page" when
 * the server pages the list). Missing values always sort last, in either direction, so unknown
 * years never lead the list. Ties keep their original order. Returns a new array.
 */
export function sortRows<T>(
  rows: readonly T[],
  sort: Sort | null,
  value: (row: T, key: string) => SortValue,
): T[] {
  if (!sort) return [...rows];
  const dir = sort.dir === 'asc' ? 1 : -1;
  return rows
    .map((row, index) => ({ row, index, v: normalise(value(row, sort.key)) }))
    .sort((a, b) => {
      if (a.v === null || b.v === null) {
        if (a.v === b.v) return a.index - b.index;
        return a.v === null ? 1 : -1;
      }
      const c =
        typeof a.v === 'number' && typeof b.v === 'number'
          ? a.v - b.v
          : String(a.v).localeCompare(String(b.v), undefined, {
              numeric: true,
              sensitivity: 'base',
            });
      return c * dir || a.index - b.index;
    })
    .map((x) => x.row);
}
