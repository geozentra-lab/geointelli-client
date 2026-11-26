import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Store } from '@ngrx/store';
import { provideTestStore } from '../../store';
import { ValuationActions as V } from '../../store/valuation/valuation.actions';
import { selectValuationDetail } from '../../store/valuation/valuation.selectors';
import {
  PropertyValuation,
  ValuationHistoryEntry,
  valuationPoints,
} from '../../core/models/property-valuation';
import { PropertyValuationView } from './property-valuation';
import { forecastSeries, historySeries } from './valuation-series';

/** Trimmed from the local response for property 301400. */
const supported: PropertyValuation = {
  status: 'supported',
  reasons: [],
  estimate: {
    value: 671182.72,
    range80: { low: 551940.35, high: 816186.46 },
    range90: { low: 499244.99, high: 902335.03 },
    confidence: 'high',
  },
  forecasts: {
    oneYear: { value: 617015.32, low: 281975.91, high: 1350143.4 },
    threeYears: { value: 662355.78, low: 201327.52, high: 2179111.84 },
    fiveYears: { value: 721840.5, low: 182310.4, high: 2862024.1 },
  },
  explanation: {
    baseline: 755227,
    summary: 'A typical Miami-Dade home is valued at about $755,227 today.',
    factors: [
      {
        code: 'sale_history',
        label: 'Sale history',
        pct: 13,
        usd: 77037,
        text: 'Its last sale price raises the value by about 13%.',
      },
      {
        code: 'nearby_sales',
        label: 'Nearby sales',
        pct: -7.7,
        usd: -55655,
        text: 'Nearby sale evidence lowers the value by about 8%.',
      },
    ],
    note: 'These factors explain the model estimate.',
  },
  evidence: {
    lastSale: { hasSaleHistory: true, price: 695000, date: '2026-05-06' },
    comparables: {
      label: 'Comparable sales selected separately as supporting evidence.',
      status: 'COMPARABLES_FOUND',
      data: {
        warnings: ['Similarity uses current property facts.'],
        comparables: [
          {
            rank: 1,
            candidate: {
              propertyId: 301299,
              folio: '0431170071240',
              address: '630 E 14 ST, Hialeah, FL 33010-0000',
              bedrooms: 2,
              livingAreaSqft: 1586,
              saleDate: '2025-11-26',
              salePrice: 550000,
              matchLevel: 'SAME_NEIGHBORHOOD',
              distanceMeters: 656.5,
            },
          },
        ],
      } as never,
    },
  },
  method: {
    valuationMethod: 'XGBoost v14 + 6-month rolling bias (v17)',
    modelVersion: 'v17+v18',
    predictionDate: '2026-11-08',
    dataThrough: '2026-07-26',
    createdAt: '2026-11-08T20:24:20.015242',
  },
  reproducibility: { runId: '2026-11-08-6c55c6e4', inputHash: '6feae3b69b51d079' },
  notes: ['Three- and five-year forecasts are trend scenarios; forecast ranges are illustrative.'],
};

function render(valuation: PropertyValuation) {
  const fixture = TestBed.createComponent(PropertyValuationView);
  fixture.componentRef.setInput('valuation', valuation);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('Property valuation', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

  it('places each forecast at its true date, with bounds only when both ends are known', () => {
    const points = valuationPoints(supported);
    expect(points.map((p) => [p.years, p.value, p.scenario])).toEqual([
      [0, 671182.72, false],
      [1, 617015.32, false],
      [3, 662355.78, true],
      [5, 721840.5, true],
    ]);
    const series = forecastSeries(supported);
    // Years count from the estimate date (Nov 8, 2026), so 1, 3 and 5 years are spaced by time.
    expect(series.map((p) => p.date.toISOString().slice(0, 10))).toEqual([
      '2027-11-08',
      '2029-11-08',
      '2031-11-08',
    ]);
    expect(series[0]).toMatchObject({ value: 617015.32, low: 281975.91, high: 1350143.4 });

    // A forecast without bounds keeps its point but adds nothing to the fan.
    const partial = forecastSeries({
      ...supported,
      forecasts: { ...supported.forecasts, threeYears: { value: 662355.78 } },
    });
    expect(partial[1]).toMatchObject({ value: 662355.78, low: null, high: null });
    // Hiding the illustrative ranges drops every bound, so the scale follows the values alone.
    expect(forecastSeries(supported, false).every((p) => p.low === null && p.high === null)).toBe(
      true,
    );
    // Without an estimate date the forecasts can't be placed, so nothing is drawn.
    expect(forecastSeries({ ...supported, method: { ...supported.method, predictionDate: null } })).toEqual(
      [],
    );
  });

  it('shows 5 years; a valuation scored before the change keeps its 7 years, never called 5', () => {
    const el = render(supported);
    expect(el.textContent).toContain('Three- and five-year values are trend scenarios.');
    expect(el.textContent).toContain('In 5 years');
    expect(el.textContent).not.toContain('7 years');

    const older: PropertyValuation = {
      ...supported,
      forecasts: { ...supported.forecasts, fiveYears: undefined, sevenYears: { value: 763276.88, low: 165474.47, high: 3520733.94 } },
    };
    expect(valuationPoints(older).map((p) => p.years)).toEqual([0, 1, 3, 7]);
    expect(forecastSeries(older).at(-1)!.date.toISOString().slice(0, 10)).toBe('2033-11-08');
    const oldEl = render(older);
    expect(oldEl.textContent).toContain('Three- and seven-year values are trend scenarios.');
    expect(oldEl.textContent).toContain('In 7 years');
    expect(oldEl.textContent).not.toContain('5 years');

    // Both sent (not expected): the 5-year value wins and the 7-year one is left out.
    const both = { ...supported, forecasts: { ...supported.forecasts, sevenYears: { value: 763276.88 } } };
    expect(valuationPoints(both).map((p) => p.years)).toEqual([0, 1, 3, 5]);
  });

  it('draws the monthly ZentraValue from published versions with an estimate only', () => {
    const entry = (id: number, date: string, valuation: PropertyValuation) =>
      ({ id, valuation: { ...valuation, method: { predictionDate: date } } }) as ValuationHistoryEntry;
    const { line, band } = historySeries([
      entry(3, '2026-11-01', supported),
      entry(2, '2026-11-01', { ...supported, estimate: { value: 1 } }),
      entry(1, '2026-10-01', { ...supported, estimate: { value: 650000 } }),
      entry(0, '2026-09-01', { status: 'unsupported' }),
    ]);
    // Oldest first; the newest version wins a shared date; unsupported versions are left out.
    expect(line.map((p) => [p.date.toISOString().slice(0, 10), p.value])).toEqual([
      ['2026-10-01', 650000],
      ['2026-11-01', 671182.72],
    ]);
    // A version without both range ends stays on the line but adds no band point.
    expect(band.map((b) => b.date.toISOString().slice(0, 10))).toEqual(['2026-11-01']);
  });

  it('treats missing forecasts as unavailable, never zero', () => {
    const points = valuationPoints({
      ...supported,
      forecasts: { oneYear: { value: null }, fiveYears: { value: 721840.5 } },
    });
    expect(points.map((p) => p.years)).toEqual([0, 5]);
    const el = render({ ...supported, forecasts: undefined });
    expect(el.textContent).toContain('Forecasts are not available for this property.');
    expect(el.querySelector('svg')).toBeNull();
    expect(el.textContent).not.toContain('$0');
  });

  it('shows a supported estimate, explanation, evidence and method as sent', () => {
    const text = render(supported).textContent!.replace(/\s+/g, ' ');
    expect(text).toContain('$671,183');
    expect(text).toContain('$551,940 to $816,186 80% range');
    expect(text).toContain('High confidence');
    expect(text).toContain('Forecast years count from the estimate date');
    expect(text).toContain('Trend scenario');
    expect(text).toContain('$281,976 to $1,350,143 Illustrative');
    expect(text).toContain("The estimate's 90% range is $499,245 to $902,335");
    // The fan is named as illustrative in the legend, apart from any 80% range.
    expect(text).toContain('Forecast range, illustrative');
    expect(text).toContain('Sale history');
    expect(text).toContain('+13% · +$77,037');
    expect(text).toContain('−7.7% · −$55,655');
    expect(text).toContain('not meant to be added together');
    expect(text).toContain('Supporting comparable sales');
    expect(text).toContain('630 E 14 ST');
    // Model details sit in the Method disclosure, never in the running text.
    const method = render(supported).querySelector('details.method')!;
    expect(method.querySelector('summary')!.textContent).toContain('Method');
    expect(method.textContent).toMatch(/Latest sale in model data\s*Jul 26/);
    expect(method.textContent).toMatch(/Run\s*2026-11-08-6c55c6e4/);
    expect(method.textContent).toContain('v17+v18');
    expect(text).not.toContain('Limited estimate');
  });

  it('marks a supported estimate that arrives without a value', () => {
    const el = render({ ...supported, estimate: { ...supported.estimate, value: null } });
    const cell = el.querySelector('.forecast-table tbody tr td:nth-child(2)')!;
    expect(cell.classList).toContain('na');
    expect(cell.textContent).toContain('Unavailable');
    expect(el.textContent).not.toContain('$0');
  });

  it('keeps the limited caution beside the graph', () => {
    const el = render({
      ...supported,
      status: 'limited',
      reasons: [{ code: 'no_sale_history', message: 'No recorded sale.' }],
      evidence: { ...supported.evidence, lastSale: { hasSaleHistory: false } },
    });
    // The aside's ZentraValue block lists the reasons too; here they sit right above the chart.
    const cautions = el.querySelectorAll('.caution');
    expect(cautions.length).toBe(1);
    expect(cautions[0].textContent).toContain('Limited estimate: No recorded sale.');
    expect(cautions[0].nextElementSibling?.tagName.toLowerCase()).toBe('gz-time-chart');
    expect(el.querySelector('gz-time-chart svg')).toBeTruthy();
    expect(el.textContent).toContain('$671,183');
  });

  it('shows only reasons and method for an unsupported valuation', () => {
    const el = render({
      status: 'unsupported',
      reasons: [{ code: 'above_validated_range', message: 'Above the tested range.' }],
      method: { modelVersion: 'v17+v18', dataThrough: '2026-07-26' },
    });
    const text = el.textContent!;
    expect(text).toContain('No estimate for this property');
    expect(text).toContain('Above the tested range.');
    expect(text).toContain('v17+v18');
    expect(text).not.toContain('ZentraValue estimate');
    expect(el.querySelector('svg')).toBeNull();

    const notModelled = render({
      status: 'unsupported',
      reasons: [{ code: 'not_modelled', message: 'Not covered by the model yet.' }],
    });
    expect(notModelled.textContent).toContain('Not covered by the model yet.');
    expect(notModelled.textContent).not.toContain('Method');
  });
});

describe('Valuation loading', () => {
  let http: HttpTestingController;
  let store: Store;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), ...provideTestStore()],
    });
    http = TestBed.inject(HttpTestingController);
    store = TestBed.inject(Store);
  });

  it('cancels the previous property and never shows its result under the next', () => {
    store.dispatch(V.loadDetail({ propertyId: 1 }));
    const first = http.expectOne((r) => r.url.endsWith('/properties/id/1/valuation'));
    store.dispatch(V.loadDetail({ propertyId: 301400 }));
    expect(first.cancelled).toBe(true);
    // Even a late answer for property 1 is ignored.
    store.dispatch(V.detailLoaded({ propertyId: 1, valuation: { status: 'limited' } }));
    expect(store.selectSignal(selectValuationDetail)()).toMatchObject({
      propertyId: 301400,
      valuation: null,
      loading: true,
    });
    http.expectOne((r) => r.url.endsWith('/properties/id/301400/valuation')).flush(supported);
    expect(store.selectSignal(selectValuationDetail)()).toMatchObject({
      propertyId: 301400,
      loading: false,
      valuation: { status: 'supported' },
    });
  });

  it('separates a missing property (404) from a failed request', () => {
    store.dispatch(V.loadDetail({ propertyId: 999999999 }));
    http
      .expectOne((r) => r.url.endsWith('/properties/id/999999999/valuation'))
      .flush('none', { status: 404, statusText: 'Not Found' });
    expect(store.selectSignal(selectValuationDetail)()).toMatchObject({ notFound: true });

    store.dispatch(V.loadDetail({ propertyId: 5 }));
    http
      .expectOne((r) => r.url.endsWith('/properties/id/5/valuation'))
      .flush('boom', { status: 500, statusText: 'Server Error' });
    expect(store.selectSignal(selectValuationDetail)()).toMatchObject({
      notFound: false,
      error: 'The valuation could not be loaded. Please retry.',
    });
  });
});
