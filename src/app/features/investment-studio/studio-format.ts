/**
 * Number formats for the Studio's results. Each returns null for a missing value, so the template
 * shows the Unavailable marker instead (DESIGN.md §6); none of them ever turns null into 0.
 */
const WHOLE = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});
const CENTS = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const MINUS = '−';

const known = (v: number | null | undefined): v is number =>
  v !== null && v !== undefined && Number.isFinite(v);

/** "$612,000"; with cents, "$3,612.45" (monthly payments). */
export function money(v: number | null | undefined, cents = false): string | null {
  if (!known(v)) return null;
  const s = (cents ? CENTS : WHOLE).format(Math.abs(v));
  return v < 0 ? MINUS + s : s;
}
/** "+$420" or "−$135" (a true minus), for gains and losses (DESIGN.md §11 polarity). */
export function signedMoney(v: number | null | undefined, cents = false): string | null {
  if (!known(v)) return null;
  const s = (cents ? CENTS : WHOLE).format(Math.abs(v));
  return Math.round(v * 100) === 0 ? s : (v < 0 ? MINUS : '+') + s;
}
/** "6.25%", two places at most, a true minus. */
export function percent(v: number | null | undefined, digits = 2): string | null {
  if (!known(v)) return null;
  const s = Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: digits }) + '%';
  return v < 0 ? MINUS + s : s;
}
/** The polarity class of a figure: none for zero or a missing value. */
export function polarity(v: number | null | undefined): 'positive' | 'negative' | null {
  if (!known(v) || Math.round(v * 100) === 0) return null;
  return v > 0 ? 'positive' : 'negative';
}
/** "price, rate and term". */
export function joinList(items: string[]): string {
  return items.length < 2 ? (items[0] ?? '') : items.slice(0, -1).join(', ') + ' and ' + items.at(-1);
}
/** Two requests with the same figures (key order aside): is the result still the form's? */
export function sameFigures(x: unknown, y: unknown): boolean {
  const norm = (r: unknown) =>
    JSON.stringify(r, (_k, v) =>
      v && typeof v === 'object' && !Array.isArray(v)
        ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
        : v,
    );
  return norm(x) === norm(y);
}
