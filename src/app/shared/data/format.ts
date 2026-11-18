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
