import { labelFor } from './label.pipe';
import { joinParts, placeLine } from '../data/format';

describe('Display helpers', () => {
  it('turns API codes into sentence-case labels and keeps acronyms', () => {
    expect(labelFor('OWNER_OCCUPIED')).toBe('Owner occupied');
    expect(labelFor('PROPERTY_TAX')).toBe('Property tax');
    expect(labelFor('HOA')).toBe('HOA');
    expect(labelFor('CSV_IMPORT')).toBe('CSV import');
    expect(labelFor('COMPARABLES_FOUND')).toBe('Comparables found');
    expect(labelFor('baselinePending')).toBe('Baseline pending');
    expect(labelFor(null)).toBe('');
  });

  it('writes places without stray commas or "null"', () => {
    expect(placeLine('Hialeah', 'FL', '33010')).toBe('Hialeah, FL 33010');
    expect(placeLine('Miami-Dade', 'FL')).toBe('Miami-Dade, FL');
    expect(placeLine(null, 'FL')).toBe('FL');
    expect(placeLine('Hialeah', null, null)).toBe('Hialeah');
    expect(placeLine(null, undefined)).toBe('');
    expect(joinParts(' · ', 'Miami-Dade, FL', '', 'Folio 1')).toBe('Miami-Dade, FL · Folio 1');
  });
});
