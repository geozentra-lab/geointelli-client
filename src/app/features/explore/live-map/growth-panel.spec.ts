import { TestBed } from '@angular/core/testing';
import { GROWTH_METRICS, GrowthCell, GrowthSummary } from './services/growth-grid';
import { GrowthPanel } from './growth-panel';

const def = GROWTH_METRICS.annual;
const cell = (key: string, median: number, count: number, classIndex: number): GrowthCell =>
  ({ key, median, count, classIndex, min: median, max: median, medianEstimate: 900000, bounds: [[25.75, -80.24], [25.751, -80.239]] }) as GrowthCell;
const summary: GrowthSummary = {
  metric: def,
  homes: 5,
  median: 6.7,
  p25: -1,
  p75: 6.7,
  histogram: [2, 0, 0, 0, 0, 3, 0],
  excluded: { noEstimate: 1, noSale: 0, recentSale: 3, noForecast: 0 },
  cells: [cell('a', 6.7, 3, 5), cell('b', -1, 2, 0)],
  fastest: [cell('a', 6.7, 3, 5)],
  slowest: [],
  sources: [{ modelVersion: 'zv-2026.10', predictionDate: '2026-10-31', count: 5 }],
};

describe('Growth panel', () => {
  it('reads the figures as rows and the classes as a table, with model versions only under Method', () => {
    TestBed.configureTestingModule({ imports: [GrowthPanel] });
    const fixture = TestBed.createComponent(GrowthPanel);
    fixture.componentRef.setInput('summary', summary);
    fixture.componentRef.setInput('metric', 'annual');
    fixture.componentRef.setInput('forecastHomes', 0);
    fixture.componentRef.setInput('cellMeters', 100);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const text = (sel: string) => [...el.querySelectorAll(sel)].map((n) => n.textContent!.replace(/\s+/g, ' ').trim());
    expect(el.querySelector('h2')!.textContent).toBe('Annual growth since last sale');
    expect(text('.lm-figures dd')).toEqual([
      '+6.7%/yr',
      '-1.0%/yr to +6.7%/yr',
      '5 in 2 squares',
      '4 3 sold within the last year, 1 without an estimate',
    ]);
    expect(text('.lm-classes tbody td.num')).toEqual(['2', '0', '0', '0', '0', '3', '0']);
    // No forecasts in view: the measure is offered disabled, with the reason written out.
    const forecast = [...el.querySelectorAll('button')].find((b) => b.textContent!.trim() === 'Next 12 months')!;
    expect(forecast.disabled).toBe(true);
    expect(el.textContent).toContain('Next 12 months: no forecasts for the homes in view.');
    const method = el.querySelector('details.lm-method')!;
    expect(method.textContent).toContain('zv-2026.10');
    method.remove();
    expect(el.textContent).not.toContain('zv-2026.10');
  });
});
