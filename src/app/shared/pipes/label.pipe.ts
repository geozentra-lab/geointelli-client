import { Pipe, PipeTransform } from '@angular/core';

/** Words that stay in capitals when an API code is turned into a label. */
const ACRONYMS = new Set(['HOA', 'USD', 'CSV', 'API', 'ID', 'ZIP', 'DOR', 'URL', 'UTC', 'AVM']);

/** Codes whose plain-English label is not just the words of the code. */
const OVERRIDES: Record<string, string> = {
  COMPARABLES_FOUND: 'Comparables found',
  CANDIDATES_FOUND: 'Candidates found',
  INSUFFICIENT_DATA: 'Not enough sales',
  OWNER_OCCUPIED: 'Owner occupied',
  MANAGEMENT_FEE: 'Management fee',
  OTHER_INCOME: 'Other income',
  OTHER_EXPENSE: 'Other expense',
  MORTGAGE_PAYMENT: 'Mortgage payment',
  PROPERTY_TAX: 'Property tax',
  UNKNOWN: 'Unknown',
};

/**
 * Turns an API code (OWNER_OCCUPIED, comparablesFound, PROPERTY_TAX) into a sentence-case label
 * ("Owner occupied", "Comparables found", "Property tax"), keeping acronyms such as HOA in capitals.
 * Null or empty input gives an empty string. Use the pipe in templates, the function in code.
 */
export function labelFor(code: string | null | undefined): string {
  if (!code) return '';
  const key = code.trim();
  if (OVERRIDES[key]) return OVERRIDES[key];
  const words = key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(/[\s_-]+/)
    .filter(Boolean);
  return words
    .map((w, i) => {
      const upper = w.toUpperCase();
      if (ACRONYMS.has(upper)) return upper;
      const lower = w.toLowerCase();
      return i === 0 ? lower[0].toUpperCase() + lower.slice(1) : lower;
    })
    .join(' ');
}

@Pipe({ name: 'label' })
export class LabelPipe implements PipeTransform {
  transform(code: string | null | undefined): string {
    return labelFor(code);
  }
}
