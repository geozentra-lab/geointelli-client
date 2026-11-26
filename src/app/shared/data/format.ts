/**
 * Small display helpers shared by cards, pages and dialogs, so the same fact is written the same
 * way everywhere. Missing parts are left out; nothing is ever shown as "null" or as a stray comma.
 */

type Part = string | number | null | undefined;

/** Joins the parts that have a value: joinParts(', ', 'Hialeah', null, 'FL') → "Hialeah, FL". */
export function joinParts(separator: string, ...parts: Part[]): string {
  return parts
    .map((p) => (p === null || p === undefined ? '' : String(p).trim()))
    .filter(Boolean)
    .join(separator);
}

/** "Hialeah, FL 33010": place (city or county), state code and ZIP, whichever are known. */
export function placeLine(place: Part, stateCode: Part, zip?: Part): string {
  const region = joinParts(' ', stateCode, zip);
  return joinParts(', ', place, region);
}

/**
 * A folio the way the county prints it: 13-digit Miami-Dade folios become 01-4137-012-0450. Any
 * other format is returned as given (trimmed); a missing folio is an empty string, never "null".
 */
export function formatFolio(folio: string | null | undefined): string {
  const f = (folio ?? '').trim();
  return /^\d{13}$/.test(f) ? `${f.slice(0, 2)}-${f.slice(2, 6)}-${f.slice(6, 9)}-${f.slice(9)}` : f;
}

const SHORT = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const LONG = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});
/**
 * A record date (DESIGN.md §13): "Nov 18" within the current year, otherwise "Oct 16, 2025".
 * Date-only strings are calendar dates, so they are read and written in UTC (no day shift).
 * Returns null for a missing or unreadable date.
 */
export function formatRecordDate(
  value: string | Date | null | undefined,
  now: Date = new Date(),
): string | null {
  if (value === null || value === undefined || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return (d.getUTCFullYear() === now.getUTCFullYear() ? SHORT : LONG).format(d);
}

const SHORT_LOCAL = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const LONG_LOCAL = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});
/**
 * The day of an instant (a timestamp such as generatedAt or scoredAt) in the viewer's own time
 * zone, written like formatRecordDate: "Nov 18", or "Oct 16, 2025" outside the current year. A
 * timestamp late in a US evening is the next day in UTC; this keeps it on the viewer's day. Use
 * formatRecordDate for calendar dates ("2026-10-31"). Null for a missing or unreadable value.
 */
export function formatLocalDate(
  value: string | Date | null | undefined,
  now: Date = new Date(),
): string | null {
  if (value === null || value === undefined || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return (d.getFullYear() === now.getFullYear() ? SHORT_LOCAL : LONG_LOCAL).format(d);
}

const LOCAL_TIME = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });
/** The time of an instant in the viewer's own time zone: "3:57 PM". Null when missing or unreadable. */
export function formatLocalTime(value: string | Date | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : LOCAL_TIME.format(d);
}
/** An instant's day and time on the viewer's own clock: "Nov 18, 3:57 PM" (the year outside this one). */
export function formatLocalDateTime(
  value: string | Date | null | undefined,
  now: Date = new Date(),
): string | null {
  const day = formatLocalDate(value, now);
  return day ? `${day}, ${formatLocalTime(value)}` : null;
}

/** "1 search", "3 searches": a count with its noun, pluralised. */
export function countOf(n: number, one: string, many = one + 's'): string {
  return `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;
}

/**
 * A ZentraValue's confidence, in one format everywhere (DESIGN.md §9): the score out of 100, then
 * its band as the valuation states it, "Confidence 78 of 100 · Medium". Without a band, the score
 * alone; without a score, "Medium confidence"; with neither, "Confidence not stated". Nothing is
 * derived: a band is never worked out from a score.
 */
export function formatConfidence(
  score: number | null | undefined,
  band: string | null | undefined,
): string {
  const value = formatConfidenceValue(score, band);
  if (value === null) return 'Confidence not stated';
  return score === null || score === undefined || Number.isNaN(score)
    ? `${value} confidence`
    : `Confidence ${value}`;
}
/** The same, as the value of a row labelled "Confidence": "78 of 100 · Medium"; null for neither. */
export function formatConfidenceValue(
  score: number | null | undefined,
  band: string | null | undefined,
): string | null {
  const b = (band ?? '').trim().toLowerCase();
  const word = b ? b[0].toUpperCase() + b.slice(1) : null;
  if (score === null || score === undefined || Number.isNaN(score)) return word;
  const s = `${Math.round(score)} of 100`;
  return word ? `${s} · ${word}` : s;
}
/** Low confidence is set in --attention (DESIGN.md §2, §9). */
export function isLowConfidence(band: string | null | undefined): boolean {
  return (band ?? '').trim().toLowerCase() === 'low';
}

/**
 * Field names the backend's notes use, in the words the page shows them under: "Evidence covers 50
 * of 100" is coveragePercent, and "Updated Nov 18" is generatedAt (DESIGN.md §13).
 */
const FIELD_WORDS: Record<string, string> = {
  coveragePercent: 'evidence coverage',
  generatedAt: 'the “Updated” date',
};
/** A field name left in the copy: camelCase ("sourceAsOf") or snake_case ("source_as_of"). */
const FIELD_NAME = /\b[a-z]+(?:[A-Z][a-z0-9]*)+\b|\b[a-z]+_[a-z0-9_]+\b/;

/**
 * Backend copy (notes, limitations, disclaimers) without developer field names (DESIGN.md §13):
 * a known name becomes the words the page uses for it, capitalised at the start of a sentence; a
 * note that still names a field is hidden (null) rather than shown as code.
 */
export function plainNote(note: string | null | undefined): string | null {
  if (!note) return null;
  let s = note;
  for (const [field, words] of Object.entries(FIELD_WORDS))
    s = s.replace(new RegExp(String.raw`\b${field}\b`, 'g'), (_m, at: number, all: string) =>
      // At the start of a sentence the words take a capital.
      /(^|[.!?]\s+)$/.test(all.slice(0, at)) ? words[0].toUpperCase() + words.slice(1) : words,
    );
  return FIELD_NAME.test(s) ? null : s;
}
/** Several notes, the hidden ones left out. */
export function plainNotes(notes: readonly (string | null | undefined)[]): string[] {
  return notes.map(plainNote).filter((n): n is string => n !== null);
}
