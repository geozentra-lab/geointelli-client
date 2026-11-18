import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Store } from '@ngrx/store';
import { ValueForecast, compactMoney, forecastPoints, isoDate } from './value-forecast';
import {
  PropertyValuePrediction,
  hasGrowth,
  predictionNotes,
} from '../../core/models/property_prediction_value';
import { provideTestStore } from '../../store';
import { ValuationActions as V } from '../../store/valuation/valuation.actions';
import { selectValuation } from '../../store/valuation/valuation.selectors';

/** Shape of a real /api/predictions/bypropertyid answer (property 1, run of 2026-11-08). */
const prediction: PropertyValuePrediction = {
  propertyId: 1,
  predictedPrice: 621063.48,
  predictedPriceLow: 462405.89,
  predictedPriceHigh: 834158.59,
  predictedPriceLow90: 397467.75,
  predictedPriceHigh90: 970443.12,
  growthPercentage: 0,
  confidence: 'medium',
  confidenceScore: 70,
  hasSaleHistory: false,
  lastSalePrice: null,
  lastSaleDate: null,
  forecast1y: 622149.52,
  forecast1yLow: 244626.66,
  forecast1yHigh: 1582288.82,
  unchangedHomeValue1y: 619979.07,
  forecast3y: 667867.21,
  forecast3yLow: 174660.58,
  forecast3yHigh: 2553791.0,
  forecast7y: 769628.07,
  forecast7yLow: 143556.47,
  forecast7yHigh: 4126093.24,
  marketOutlook1yPct: -0.17460433540462159,
  predictionDate: '2026-11-08',
  dataThrough: '2026-07-26',
  modelVersion: 'v17+v18',
  notes:
    '["No qualified sale history: estimate relies on property attributes and nearby sales only."]',
};

describe('Value estimate and forecast', () => {
  it('derives forecast horizons, growth, notes and dates from the prediction', () => {
    const points = forecastPoints(prediction);
    expect(points.map((p) => p.years)).toEqual([1, 3, 7]);
    expect(points[2].change).toBeCloseTo(23.92, 1);
    expect(forecastPoints({ ...prediction, forecast3y: null, forecast7y: 0 })).toHaveLength(1);
    // The server reports 0% growth when there is no prior sale; that is not real growth.
    expect(hasGrowth(prediction)).toBe(false);
    expect(hasGrowth({ ...prediction, lastSalePrice: 500000, growthPercentage: 24.2 })).toBe(true);
    expect(predictionNotes(prediction)).toEqual([
      'No qualified sale history: estimate relies on property attributes and nearby sales only.',
    ]);
    expect(predictionNotes({ ...prediction, notes: 'plain caveat' })).toEqual(['plain caveat']);
    expect(predictionNotes({ ...prediction, notes: null })).toEqual([]);
    expect(isoDate([2026, 11, 8])).toBe('2026-11-08');
    expect(isoDate('2026-07-26')).toBe('2026-07-26');
    expect(isoDate(null)).toBeNull();
    expect(compactMoney(769628)).toBe('$770K');
    expect(compactMoney(1582288)).toBe('$1.58M');
  });

  it('shows the estimate, ranges, confidence, forecast chart and caveats', () => {
    const fixture = TestBed.createComponent(ValueForecast);
    fixture.componentRef.setInput('prediction', prediction);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const text = el.textContent!.replace(/\s+/g, ' ');
    expect(text).toContain('$621,063');
    expect(text).toContain('Medium confidence');
    expect(text).toContain('$397,468 – $970,443');
    expect(text).not.toContain('Since last sale');
    expect(text).toContain('-0.2%');
    expect(el.querySelectorAll('.vf-card')).toHaveLength(3);
    expect(text).toContain('+23.9% vs today');
    expect(el.querySelector('svg.vf-chart')?.getAttribute('aria-label')).toContain(
      'in 7 years $770K',
    );
    expect(el.querySelectorAll('svg.vf-chart circle')).toHaveLength(4);
    expect(text).toContain('No qualified sale history');
    expect(text).toContain('sales through Jul 26, 2026');
  });

  it('drops the chart and long text in the compact dialog version', () => {
    const fixture = TestBed.createComponent(ValueForecast);
    fixture.componentRef.setInput('prediction', prediction);
    fixture.componentRef.setInput('compact', true);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('svg')).toBeNull();
    expect(el.querySelectorAll('.vf-card')).toHaveLength(3);
    expect(el.textContent).not.toContain('No qualified sale history');
  });
});

describe('Prediction loading', () => {
  let http: HttpTestingController;
  let store: Store;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), ...provideTestStore()],
    });
    http = TestBed.inject(HttpTestingController);
    store = TestBed.inject(Store);
  });
  afterEach(() => http.verify());

  it('treats a missing estimate (404) as an empty state, not an error', () => {
    store.dispatch(V.load({ propertyId: 7 }));
    http
      .expectOne((r) => r.url.endsWith('/predictions/bypropertyid'))
      .flush('none', { status: 404, statusText: 'Not Found' });
    const state = store.selectSignal(selectValuation)();
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.prediction).toBeNull();
  });

  it('reports a real failure and an empty heatmap separately', () => {
    store.dispatch(V.load({ propertyId: 7 }));
    http
      .expectOne((r) => r.url.endsWith('/predictions/bypropertyid'))
      .flush('boom', { status: 500, statusText: 'Server Error' });
    expect(store.selectSignal(selectValuation)().error).toContain('unavailable');
    store.dispatch(V.loadBulk({ propertyIds: [1, 2] }));
    http
      .expectOne((r) => r.url.endsWith('/predictions/bulk'))
      .flush('none', { status: 404, statusText: 'Not Found' });
    const state = store.selectSignal(selectValuation)();
    expect(state.bulkError).toBeNull();
    expect(state.predictions).toEqual({});
  });
});
