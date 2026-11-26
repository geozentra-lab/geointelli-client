import { TestBed } from '@angular/core/testing';
import { OpportunityFactor } from '../../core/models/opportunity';
import { ScoreFactors } from './score-factors';
import { Reasons } from './reasons';

const text = (el: Element | null) => el!.textContent!.replace(/\s+/g, ' ').trim();
const FACTORS: OpportunityFactor[] = [
  {
    code: 'FORECAST_GROWTH_1Y',
    label: 'One-year forecast growth',
    category: 'MARKET',
    weight: 20,
    status: 'AVAILABLE',
    signal: 4.2,
    signalUnit: 'PERCENT',
    subscore: 71,
    points: 14.2,
    explanation: 'One-year forecast +4.2% against the current estimate.',
  },
  {
    code: 'RENTAL_YIELD',
    label: 'Rental yield',
    category: 'RENT',
    weight: 20,
    status: 'UNAVAILABLE',
    signal: null,
    signalUnit: null,
    subscore: null,
    points: null,
    explanation: 'Unavailable: No rent estimate is stored for this property. It adds no points.',
  },
];

function render(compact: boolean) {
  TestBed.configureTestingModule({ imports: [ScoreFactors] });
  const fixture = TestBed.createComponent(ScoreFactors);
  fixture.componentRef.setInput('factors', FACTORS);
  fixture.componentRef.setInput('compact', compact);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('Opportunity score factors', () => {
  it('gives each factor its points out of its weight as a bar, and hatches a missing one', () => {
    const el = render(false);
    expect([...el.querySelectorAll('thead th')].map((th) => text(th))).toEqual(['Factor', 'Evidence', 'Points']);
    const [available, missing] = [...el.querySelectorAll('tbody tr')];
    expect(text(available.querySelectorAll('td')[1])).toBe('+4.20%');
    expect(text(available.querySelectorAll('td')[2])).toBe('14.2 of 20');
    expect((available.querySelector('.points-bar i') as HTMLElement).style.width).toBe('71%');
    // Never a zero-width bar or "0": the marker, with the backend's reason in the row.
    const points = missing.querySelectorAll('td')[2];
    expect(points.classList).toContain('na');
    expect(points.querySelector('.points-bar')).toBeNull();
    expect(text(points.querySelector('.na-word'))).toBe('Unavailable');
    expect(text(missing.querySelector('.cell-sub'))).toBe(
      'Rent · Unavailable: No rent estimate is stored for this property. It adds no points.',
    );
  });

  it('leaves out the Evidence column in a narrow pane (the explanation states it)', () => {
    const el = render(true);
    expect([...el.querySelectorAll('thead th')].map((th) => text(th))).toEqual(['Factor', 'Points']);
    expect(el.querySelectorAll('tbody tr')[0].querySelectorAll('td')).toHaveLength(2);
  });
});

describe('Reasons, one line or two', () => {
  it('lets a single reason wrap onto a second line; two reasons take a line each', () => {
    TestBed.configureTestingModule({ imports: [Reasons] });
    const fixture = TestBed.createComponent(Reasons);
    fixture.componentRef.setInput('reasons', ['Matches your saved target county: Miami-Dade, FL']);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.classList).toContain('one');
    fixture.componentRef.setInput('reasons', ['Within your budget', 'Built after 1990', '3 beds']);
    fixture.detectChanges();
    expect(el.classList).not.toContain('one');
    expect(text(el.querySelector('.more'))).toBe('+1 more');
  });
});
