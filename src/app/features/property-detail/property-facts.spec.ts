import { TestBed } from '@angular/core/testing';
import { Property } from '../../core/models/property';
import { PropertyFacts } from './property-facts';

const base = {
  countyId: 1,
  countyName: 'Miami-Dade',
  folio: '0141370120450',
  bedroomCount: 3,
  bathroomCount: 2,
  halfBathroomCount: 1,
  buildingActualArea: 1840,
  buildingHeatedArea: 1600,
  yearBuilt: '1952',
  floorCount: 1,
  lotSize: 6250,
  lands: [{ frontFeet: 50, depth: 125 }],
  primaryZoneDescription: 'SINGLE FAMILY - GENERAL',
  subdivision: 'BLUFF PARK SUB',
  municipality: 'Miami',
  dorDescription: 'Single family',
  neighborhoodDescription: 'Silver Bluff',
  status: 'Active',
  owners: [{ name: 'MARISOL A HERRERA', percentageOwn: 50 }],
} as unknown as Property;

function render(property: Property) {
  TestBed.configureTestingModule({ imports: [PropertyFacts] });
  const fixture = TestBed.createComponent(PropertyFacts);
  fixture.componentRef.setInput('property', property);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}
const row = (el: HTMLElement, label: string) =>
  [...el.querySelectorAll('.record-row')].find((r) => r.querySelector('dt')!.textContent === label)!;

describe('Property facts', () => {
  it('reads the county record as ruled groups, with units and half baths written out', () => {
    const el = render(base);
    expect(el.textContent).toContain("From the Miami-Dade property appraiser's record.");
    expect(row(el, 'Bathrooms').querySelector('dd')!.textContent!.trim()).toBe('2, 1 half');
    // The same living-area field as cards and Compare (actual, not heated, area).
    expect(row(el, 'Living area').querySelector('dd')!.textContent!.trim()).toBe('1,840 sq ft');
    expect(row(el, 'Frontage and depth').querySelector('dd')!.textContent!.trim()).toBe(
      '50 ft by 125 ft',
    );
    expect(row(el, 'MARISOL A HERRERA').querySelector('dd')!.textContent!.trim()).toBe('50%');
    expect(el.querySelector('.na')).toBeNull();
    expect(el.textContent).not.toContain('Unavailable: not in the county record.');
  });

  it('marks missing values Unavailable with the reason once per group, and keeps a recorded zero', () => {
    const el = render({
      ...base,
      bedroomCount: 0,
      bathroomCount: null,
      yearBuilt: '',
      lotSize: null,
      lands: [],
      owners: [],
    } as unknown as Property);
    expect(row(el, 'Bedrooms').querySelector('dd')!.textContent!.trim()).toBe('0');
    for (const label of ['Bathrooms', 'Year built', 'Lot', 'Frontage and depth']) {
      const dd = row(el, label).querySelector('dd')!;
      expect(dd.classList).toContain('na');
      expect(dd.textContent).toContain('Unavailable');
      expect(dd.textContent).toContain('Not in the county record');
    }
    // Building and Land each write the reason once, under their rows.
    const notes = [...el.querySelectorAll('.record-note')].map((n) => n.textContent!.trim());
    expect(notes.filter((n) => n === 'Unavailable: not in the county record.')).toHaveLength(2);
    expect(notes).toContain('No owners are listed in the county record.');
    expect(el.textContent).not.toMatch(/null|undefined|NaN|—/);
  });

  it('writes the reason under the owners when a share is missing, and a role other than Owner', () => {
    const el = render({
      ...base,
      owners: [
        { name: 'NORWOOD 18402 LLC', percentageOwn: null, role: 'Owner' },
        { name: 'RIVERA FAMILY REVOCABLE TRUST', percentageOwn: 100, role: 'Trustee' },
      ],
    } as unknown as Property);
    expect(row(el, 'RIVERA FAMILY REVOCABLE TRUST, Trustee')).toBeTruthy();
    expect(row(el, 'NORWOOD 18402 LLC').querySelector('dd')!.classList).toContain('na');
    const notes = [...el.querySelectorAll('.record-note')].map((n) => n.textContent!.trim());
    expect(notes).toContain('Unavailable: share not in the county record.');
  });
});
