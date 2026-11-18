import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Store } from '@ngrx/store';
import { provideTestStore } from '../../store';
import { ValuationActions as V } from '../../store/valuation/valuation.actions';
import { selectValuationDetail } from '../../store/valuation/valuation.selectors';
import { PropertyValuation, valuationPoints } from '../../core/models/property-valuation';
import { PropertyValuationView, valuationChart } from './property-valuation';

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
    sevenYears: { value: 763276.88, low: 165474.47, high: 3520733.94 },
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
  notes: ['Three- and seven-year forecasts are trend scenarios; forecast ranges are illustrative.'],
};

function render(valuation: PropertyValuation) {
  const fixture = TestBed.createComponent(PropertyValuationView);
  fixture.componentRef.setInput('valuation', valuation);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('Property valuation', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

  it('plots year 0 and each forecast, and bands only between bounded points', () => {
    const points = valuationPoints(supported);
    expect(points.map((p) => [p.years, p.value, p.scenario])).toEqual([
      [0, 671182.72, false],
      [1, 617015.32, false],
      [3, 662355.78, true],
      [7, 763276.88, true],
    ]);
    const chart = valuationChart(points)!;
    expect(chart.bands.length).toBe(3);
    expect(chart.segments.map((s) => s.scenario)).toEqual([false, true, true]);

    // A forecast without bounds keeps its point but loses the bands that touch it.
    const partial = valuationPoints({
      ...supported,
      forecasts: { ...supported.forecasts, threeYears: { value: 662355.78 } },
    });
    expect(valuationChart(partial)!.bands.length).toBe(1);
    // Without ranges the scale follows the values alone.
    const plain = valuationChart(points, false)!;
    expect(plain.bands.length).toBe(0);
    expect(plain.yTicks[3].label).toBe('$775K');
  });

  it('treats missing forecasts as unavailable, never zero', () => {
    const points = valuationPoints({
      ...supported,
      forecasts: { oneYear: { value: null }, sevenYears: { value: 763276.88 } },
    });
    expect(points.map((p) => p.years)).toEqual([0, 7]);
    const el = render({ ...supported, forecasts: undefined });
    expect(el.textContent).toContain('Forecasts are not available for this property.');
    expect(el.querySelector('svg')).toBeNull();
    expect(el.textContent).not.toContain('$0');
  });

  it('shows a supported estimate, explanation, evidence and method as sent', () => {
    const text = render(supported).textContent!.replace(/\s+/g, ' ');
    expect(text).toContain('$671,183');
    expect(text).toContain('$551,940 – $816,186');
    expect(text).toContain('High confidence');
    expect(text).toContain('Years after Nov 8, 2026');
    expect(text).toContain('Trend scenario');
    expect(text).toContain('Illustrative range $281,976 – $1,350,143');
    expect(text).toContain('Sale history');
    expect(text).toContain('+13% · +$77,037');
    expect(text).toContain('not meant to be added together');
    expect(text).toContain('Supporting evidence: comparable sales');
    expect(text).toContain('630 E 14 ST');
    expect(text).toMatch(/Latest sale in model data\s*Jul 26, 2026/);
    expect(text).toContain('Run 2026-11-08-6c55c6e4');
    expect(text).not.toContain('Limited valuation');
  });

  it('keeps a limited caution at the top and beside the graph', () => {
    const el = render({
      ...supported,
      status: 'limited',
      reasons: [{ code: 'no_sale_history', message: 'No recorded sale.' }],
      evidence: { ...supported.evidence, lastSale: { hasSaleHistory: false } },
    });
    const cautions = el.querySelectorAll('.caution');
    expect(cautions.length).toBe(2);
    expect(cautions[1].textContent).toContain('No recorded sale.');
    expect(cautions[1].nextElementSibling?.tagName.toLowerCase()).toBe('svg');
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
