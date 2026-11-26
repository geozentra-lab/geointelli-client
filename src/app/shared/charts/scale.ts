/**
 * Scales and ticks for the hand-written SVG charts (DESIGN.md §11). Pure functions, so every chart
 * reads the same way and the rules are tested once.
 */

/** Maps a domain onto a range linearly; a flat domain maps to the middle of the range. */
export function linear(d0: number, d1: number, r0: number, r1: number) {
  return (v: number) => (d1 === d0 ? (r0 + r1) / 2 : r0 + ((v - d0) / (d1 - d0)) * (r1 - r0));
}

/**
 * Round ticks from 0 up to at least `max`: 3 to 5 of them. Prices and counts always start at 0.
 * zeroBasedTicks(1_180_000) → [0, 500000, 1000000, 1500000]
 */
export function zeroBasedTicks(max: number, most = 4): number[] {
  if (!(max > 0) || !Number.isFinite(max)) return [0, 1];
  const rough = max / most;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const step =
    [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => Math.ceil(max / s - 1e-9) <= most) ??
    10 * pow;
  const n = Math.max(2, Math.ceil(max / step - 1e-9));
  return Array.from({ length: n + 1 }, (_, i) => +(i * step).toPrecision(12));
}

/** Axis money: $0, $950, $400K, $1.2M, $15M. Compact money appears only on axes and map labels. */
export function axisMoney(v: number): string {
  const abs = Math.abs(v);
  const sign = v < 0 ? '−' : '';
  const trim = (n: number) => String(+n.toFixed(n >= 10 ? 0 : 1));
  if (abs >= 1e9) return `${sign}$${trim(abs / 1e9)}B`;
  if (abs >= 1e6) return `${sign}$${trim(abs / 1e6)}M`;
  if (abs >= 1e3) return `${sign}$${trim(abs / 1e3)}K`;
  return `${sign}$${Math.round(abs)}`;
}

const DAY = 86_400_000;
const YEAR = 365.25 * DAY;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface TimeTick {
  date: Date;
  label: string;
}

/**
 * Ticks on calendar boundaries for a time axis that is linear in time: every 2 years on desktop
 * and every 5 on phones (or wider when the span needs it), or months when the span is under two
 * years. Dates are UTC (records carry dates, not times).
 */
export function timeTicks(from: Date, to: Date, width: number): TimeTick[] {
  const span = to.getTime() - from.getTime();
  if (!(span > 0)) return [];
  const room = Math.max(2, Math.floor(width / 48)); // a 12 px year label needs about 48 px
  if (span < 2 * YEAR) {
    const months = span / (YEAR / 12);
    const step = [1, 2, 3, 6, 12].find((s) => months / s <= room) ?? 12;
    const ticks: TimeTick[] = [];
    let y = from.getUTCFullYear();
    let m = Math.ceil(from.getUTCMonth() / step) * step;
    for (;;) {
      if (m >= 12) {
        y += Math.floor(m / 12);
        m %= 12;
      }
      const d = new Date(Date.UTC(y, m, 1));
      if (d > to) break;
      if (d >= from) ticks.push({ date: d, label: m === 0 ? String(y) : `${MONTHS[m]}` });
      m += step;
    }
    return ticks;
  }
  const years = span / YEAR;
  const base = width < 480 ? 5 : 2;
  const step = [base, 5, 10, 20, 50].find((s) => s >= base && years / s <= room) ?? 50;
  const ticks: TimeTick[] = [];
  for (let y = Math.ceil(from.getUTCFullYear() / step) * step; ; y += step) {
    const d = new Date(Date.UTC(y, 0, 1));
    if (d > to) break;
    if (d >= from) ticks.push({ date: d, label: String(y) });
  }
  return ticks;
}

/** "Jun 2008": a point's month for direct labels. */
export function monthLabel(d: Date): string {
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Shifts a date by whole years and months (UTC). */
export function addMonths(d: Date, months: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, d.getUTCDate()));
}
