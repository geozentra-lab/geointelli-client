import { TestBed } from '@angular/core/testing';
import { PropertyValuation } from '../../core/models/property-valuation';
import { ZentraValue, rangeGeometry } from './zentra-value';

const supported: PropertyValuation = {
  status: 'supported',
  estimate: {
    value: 985000,
    range80: { low: 877000, high: 1093000 },
    range90: { low: 830000, high: 1150000 },
    confidence: 'medium',
  },
  forecasts: { oneYear: { value: 1026000, low: 954000, high: 1098000 } },
  evidence: { lastSale: { hasSaleHistory: true, price: 612000, date: '2019-06-14' } },
  method: { predictionDate: '2026-11-01', dataThrough: '2026-10-31' },
};

function render(valuation: PropertyValuation | null, inputs: Record<string, unknown> = {}) {
  const fixture = TestBed.createComponent(ZentraValue);
  fixture.componentRef.setInput('valuation', valuation);
  for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  return { el, text: el.textContent!.replace(/\s+/g, ' ') };
}

describe('ZentraValue', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [ZentraValue] }));

  it('scales the track to the 90% range, or the 80% range widened by a quarter each side', () => {
    expect(rangeGeometry(985000, 877000, 1093000, 830000, 1150000)).toEqual({
      low: 877000,
      high: 1093000,
      left: 14.7,
      right: 17.8,
      tick: 48.4,
    });
    // No 90% range: $200K to $500K around a $250K to $450K band.
    expect(rangeGeometry(300000, 250000, 450000)).toMatchObject({ left: 16.7, right: 16.7, tick: 33.3 });
    // A 90% range that doesn't contain the 80% range is not used as the scale.
    expect(rangeGeometry(300000, 250000, 450000, 260000, 440000)).toMatchObject({ left: 16.7 });
    expect(rangeGeometry(300000, null, 450000)).toBeNull();
    expect(rangeGeometry(300000, 450000, 450000)).toBeNull();
  });

  it('shows the figure, the 80% range, confidence, the 12-month forecast and the last sale', () => {
    const { el, text } = render(supported, { size: 'page' });
    expect(el.querySelector('.zv')!.classList).toContain('zv-page');
    expect(text).toContain('ZentraValue');
    expect(el.querySelector('.zv-fig')!.textContent!.trim()).toBe('$985,000');
    expect(el.querySelector('.range-ends')!.textContent!.replace(/\s+/g, ' ')).toContain(
      '$877,000 80% range $1,093,000',
    );
    expect(text).toMatch(/Medium confidence from sales through Oct 31/);
    expect(text).toMatch(/Forecast\s*\$1,026,000 \(\+4\.2%\)/);
    expect(text).toMatch(/Range \(illustrative\)\s*\$954,000 to \$1,098,000/);
    expect(text).toMatch(/Last sale\s*\$612,000, Jun 14, 2019/);
  });

  it('labels a limited estimate and writes its reasons, with low confidence in attention', () => {
    const { el, text } = render({
      ...supported,
      status: 'limited',
      estimate: { ...supported.estimate, confidence: 'low' },
      reasons: [{ code: 'FEW', message: 'Only 2 qualified sales nearby.' }],
    });
    expect(el.querySelector('.zv-label')!.textContent).toContain('Limited estimate');
    expect(el.querySelector('.zv-limit')!.textContent).toContain('Only 2 qualified sales nearby.');
    expect(el.querySelector('.zv-conf .attention')!.textContent).toContain('Low confidence');
    expect(text).toContain('$985,000');
  });

  it('turns the figure and range into the Unavailable marker with the backend reason', () => {
    const { el, text } = render({
      status: 'unsupported',
      reasons: [{ code: 'CONDO_HOTEL', message: 'Units in condo-hotel buildings are not modelled.' }],
    });
    expect(el.querySelector('.zv-fig')).toBeNull();
    expect(el.querySelector('.range-track')).toBeNull();
    const marker = el.querySelector('.zv-na.na')!;
    expect(marker.textContent).toContain('Unavailable');
    expect(marker.textContent).toContain('Units in condo-hotel buildings are not modelled.');
    // No forecast rows for a home without an estimate, and never a zero.
    expect(text).not.toContain('Next 12 months');
    expect(text).not.toContain('$0');

    expect(render(null).text).toContain('No valuation is on record for this property.');
  });

  it('never shows an estimate without its range: a missing range is marked', () => {
    const { el } = render({ ...supported, estimate: { value: 985000, confidence: 'high' } });
    expect(el.querySelector('.zv-gap.na')!.textContent).toContain('No 80% range was returned');
    expect(el.textContent).toContain('High confidence');
  });

  it('marks a missing 12-month forecast instead of leaving the row out', () => {
    const { el } = render({ ...supported, forecasts: null });
    const row = [...el.querySelectorAll('.record-row')].find((r) =>
      r.textContent!.includes('Forecast'),
    )!;
    expect(row.querySelector('dd.na')!.textContent).toContain('Unavailable');
  });

  it('fits on one line above the comparables table', () => {
    const { el, text } = render(supported, { layout: 'line' });
    expect(el.querySelector('.zv')).toBeNull();
    expect(text).toContain('ZentraValue $985,000 80% range $877,000 to $1,093,000 Medium confidence');
    const none = render({ status: 'unsupported', reasons: [{ code: 'X', message: 'Vacant land.' }] }, {
      layout: 'line',
    });
    expect(none.el.querySelector('.na')!.textContent).toContain('Unavailable');
    expect(none.text).toContain('Vacant land.');
  });
});
