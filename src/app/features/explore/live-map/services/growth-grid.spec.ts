import { PropertyValuePrediction } from '../../../../core/models/property_prediction_value';
import {
  GROWTH_METRICS,
  GrowthPoint,
  buildGrid,
  cellKeyAt,
  classIndex,
  formatGrowth,
  growthValue,
  summarize,
} from './growth-grid';

/** A v13 row as the bulk endpoint sends it today: growthPercentage is null. */
const home = (over: Partial<PropertyValuePrediction> = {}) =>
  ({
    propertyId: 1,
    predictedPrice: 747454.25,
    growthPercentage: null,
    lastSalePrice: 485100,
    lastSaleDate: '2016-07-06',
    predictionDate: '2026-06-25',
    modelVersion: 'v13',
    forecast1y: null,
    ...over,
  }) as unknown as PropertyValuePrediction;

describe('Growth grid', () => {
  it('derives annual, total and forecast growth from the estimate and last sale', () => {
    const annual = growthValue(home(), 'annual');
    // 747,454 / 485,100 over 9.97 years ≈ 4.4% a year.
    expect('value' in annual && annual.value).toBeCloseTo(4.42, 1);
    const total = growthValue(home(), 'total');
    expect('value' in total && total.value).toBeCloseTo(54.08, 1);
    const forecast = growthValue(home({ forecast1y: 762403.34 }), 'forecast');
    expect('value' in forecast && forecast.value).toBeCloseTo(2, 1);
  });

  it('leaves out homes it cannot measure instead of treating them as zero', () => {
    expect(growthValue(home({ lastSalePrice: null }), 'annual')).toEqual({ excluded: 'noSale' });
    expect(growthValue(home({ lastSaleDate: '2026-01-10' }), 'annual')).toEqual({
      excluded: 'recentSale',
    });
    expect(growthValue(home(), 'forecast')).toEqual({ excluded: 'noForecast' });
    expect(growthValue(undefined, 'total')).toEqual({ excluded: 'noEstimate' });
  });

  it('uses fixed colour steps with inclusive lower bounds', () => {
    const def = GROWTH_METRICS.annual;
    expect(def.classes.map((c) => c.label)).toEqual([
      'Below 0%',
      '0% to +2%',
      '+2% to +3.5%',
      '+3.5% to +5%',
      '+5% to +6.5%',
      '+6.5% to +8%',
      '+8% or more',
    ]);
    expect([-1, 0, 4.9, 5, 12].map((v) => classIndex(v, def))).toEqual([0, 1, 3, 4, 6]);
    expect(formatGrowth(4.44, def)).toBe('+4.4%/yr');
  });

  it('groups homes into stable squares and summarises each by its median', () => {
    const def = GROWTH_METRICS.annual;
    const at = (lat: number, lng: number, value: number, id: number): GrowthPoint => ({
      propertyId: id,
      lat,
      lng,
      value,
      estimate: 500000 + id,
    });
    const points = [
      at(25.83001, -80.29001, 3, 1),
      at(25.83002, -80.29002, 5, 2),
      at(25.83003, -80.29003, 9, 3),
      at(25.8, -80.2, 1, 4),
    ];
    const cells = buildGrid(points, 100, def);
    expect(cells.map((c) => c.count).sort()).toEqual([1, 3]);
    const busy = cells.find((c) => c.count === 3)!;
    expect([busy.median, busy.min, busy.max]).toEqual([5, 3, 9]);
    expect(busy.classIndex).toBe(4);
    // The hover lookup finds the same square from any position inside it.
    expect(cellKeyAt(25.83002, -80.29002, 100)).toBe(busy.key);
    const [[s, w], [n, e]] = busy.bounds;
    expect(s < 25.83001 && n > 25.83003 && w < -80.29003 && e > -80.29001).toBe(true);

    const summary = summarize(
      points,
      { noSale: 2, recentSale: 1, noForecast: 0, noEstimate: 0 },
      cells,
      def,
      [],
    );
    expect(summary.median).toBe(4);
    expect(summary.histogram).toEqual([0, 1, 1, 0, 1, 0, 1]);
    // The single-home square is too thin to rank.
    expect(summary.fastest.map((c) => c.key)).toEqual([busy.key]);
    expect(summary.slowest).toEqual([]);
  });
});
