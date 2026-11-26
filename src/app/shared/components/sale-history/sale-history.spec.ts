import { TestBed } from '@angular/core/testing';
import { Sale } from '../../../core/models/sale';
import { PropertyValuePrediction } from '../../../core/models/property_prediction_value';
import { SaleHistory, priceHistory } from './sale-history';

const sale = (saleDate: string, salePrice: number, saleType = 'Qual by exam of deed', instrumentNumber = '26451-3302') =>
  ({ saleDate, salePrice, saleType, instrumentNumber }) as Sale;
const estimate = {
  predictedPrice: 450000,
  predictionDate: '2026-10-29',
} as PropertyValuePrediction;

function render(sales: Sale[], prediction: PropertyValuePrediction | null = estimate) {
  TestBed.configureTestingModule({ imports: [SaleHistory] });
  const fixture = TestBed.createComponent(SaleHistory);
  fixture.componentRef.setInput('sales', sales);
  fixture.componentRef.setInput('prediction', prediction);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}
const cells = (row: Element) => [...row.querySelectorAll('td')].map((td) => td.textContent!.replace(/\s+/g, ' ').trim());

describe('Property sale history', () => {
  it('sorts sales by date without mutating records and appends the estimate', () => {
    const sales = [sale('2024-04-01', 400000), sale('2020-02-01', 300000)];
    const points = priceHistory(sales, estimate);
    expect(points.map((p) => p.price)).toEqual([300000, 400000, 450000]);
    expect(points.at(-1)).toEqual({ price: 450000, date: '2026-10-29', estimate: true });
    expect(sales[0].salePrice).toBe(400000);
  });

  it('excludes invalid records and never fabricates missing dates or an estimate', () => {
    expect(priceHistory([sale('bad-date', 200000), sale('2020-01-01', -1)], null)).toEqual([]);
    expect(priceHistory([], { ...estimate, predictionDate: '' })).toEqual([
      { price: 450000, date: null, estimate: true },
    ]);
  });

  it('lists every recorded sale in its table twin, newest first, with full prices', () => {
    const el = render([
      sale('2008-06-20', 410000),
      sale('2019-06-14', 612000, 'Sales which are qualified', '31480-2219'),
    ]);
    const rows = [...el.querySelectorAll('tbody tr')];
    expect(rows.map(cells)).toEqual([
      ['Jun 14, 2019 Sales which are qualified', '$612,000', 'Sales which are qualified', '31480-2219'],
      ['Jun 20, 2008 Qual by exam of deed', '$410,000', 'Qual by exam of deed', '26451-3302'],
    ]);
    // The tiles that were clipped on phones are gone.
    expect(el.querySelector('.history-event')).toBeNull();
  });

  it('places sales on a time axis: 2008, 2019 and 2026 are spaced by years, not by event', () => {
    const el = render([sale('2008-06-20', 410000), sale('2019-06-20', 612000)], {
      ...estimate,
      predictionDate: '2026-06-20',
    });
    const xs = [...el.querySelectorAll('circle.dot')].map((c) => Number(c.getAttribute('cx')));
    expect(xs).toHaveLength(3);
    // 11 years, then 7 years: the gaps keep that ratio.
    expect((xs[1] - xs[0]) / (xs[2] - xs[1])).toBeCloseTo(11 / 7, 1);
    expect(el.querySelector('circle.dot.model')).toBeTruthy();
    expect(el.textContent).toContain('is a model estimate, not a sale');
  });

  it('joins the sales with a line and the last sale to the ZentraValue with a dashed one, as before', () => {
    const el = render([sale('2008-06-20', 410000), sale('2019-06-20', 612000)], {
      ...estimate,
      predictionDate: '2026-06-20',
    });
    const [first, second, model] = [...el.querySelectorAll('circle.dot')].map((c) => [
      Number(c.getAttribute('cx')).toFixed(1),
      Number(c.getAttribute('cy')).toFixed(1),
    ]);
    const recorded = el.querySelector('path.recorded-line')!.getAttribute('d')!;
    expect(recorded).toBe(`M${first[0]},${first[1]}L${second[0]},${second[1]}`);
    const bridge = el.querySelector('path.bridge')!.getAttribute('d')!;
    expect(bridge).toBe(`M${second[0]},${second[1]}L${model[0]},${model[1]}`);
    // Drawn in once; pathLength 1 lets one dash cover the whole line whatever its length.
    expect(el.querySelector('path.recorded-line')!.getAttribute('pathLength')).toBe('1');
  });

  it('draws no line through a single sale, only the dashed one to the estimate', () => {
    const el = render([sale('2019-06-20', 612000)], { ...estimate, predictionDate: '2026-06-20' });
    expect(el.querySelector('path.recorded-line')).toBeNull();
    expect(el.querySelector('path.bridge')).toBeTruthy();
  });

  it('lists a $0 transfer without plotting it, and marks missing fields Unavailable', () => {
    const el = render(
      [sale('2015-08-21', 455000), sale('2021-05-03', 0, 'Corrective, tax or QCD; min consideration', '')],
      null,
    );
    expect(el.querySelectorAll('circle.dot')).toHaveLength(1);
    expect(el.textContent).toContain('$0');
    expect(el.textContent).toContain('A $0 sale is a transfer recorded without a price');
    const missing = el.querySelector('td.na')!;
    expect(missing.textContent).toContain('Unavailable');
    expect(missing.textContent).toContain('Not in the county record');
  });

  it('sorts the table by price when the header is pressed, and says so with aria-sort', () => {
    TestBed.configureTestingModule({ imports: [SaleHistory] });
    const fixture = TestBed.createComponent(SaleHistory);
    fixture.componentRef.setInput('sales', [
      sale('2008-06-20', 410000),
      sale('2019-06-14', 612000),
      sale('2012-01-01', 99000),
    ]);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const header = (name: string) =>
      [...el.querySelectorAll('th')].find((th) => th.textContent!.includes(name))!;
    expect(header('Date').getAttribute('aria-sort')).toBe('descending');
    header('Price').querySelector('button')!.click();
    fixture.detectChanges();
    expect(header('Price').getAttribute('aria-sort')).toBe('descending');
    expect(header('Date').hasAttribute('aria-sort')).toBe(false);
    const prices = [...el.querySelectorAll('tbody tr')].map((r) => cells(r)[1]);
    expect(prices).toEqual(['$612,000', '$410,000', '$99,000']);
  });

  it('draws the monthly ZentraValue and its 80% band when the page passes them, and says so', () => {
    TestBed.configureTestingModule({ imports: [SaleHistory] });
    const fixture = TestBed.createComponent(SaleHistory);
    fixture.componentRef.setInput('sales', [sale('2008-06-20', 410000), sale('2019-06-14', 612000)]);
    fixture.componentRef.setInput('prediction', { ...estimate, predictionDate: '2026-11-01' });
    fixture.componentRef.setInput('line', [
      { date: new Date('2026-09-01T00:00:00Z'), value: 970000 },
      { date: new Date('2026-10-01T00:00:00Z'), value: 980000 },
      { date: new Date('2026-11-01T00:00:00Z'), value: 985000 },
    ]);
    fixture.componentRef.setInput('band', [
      { date: new Date('2026-09-01T00:00:00Z'), low: 870000, high: 1080000 },
      { date: new Date('2026-11-01T00:00:00Z'), low: 877000, high: 1093000 },
    ]);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.sales-lede')!.textContent).toContain(
      '2 recorded sales; the last 3 monthly ZentraValues, Sep 2026 to Nov 2026.',
    );
    expect(el.querySelector('path.line')).toBeTruthy();
    expect(el.querySelector('path.band')).toBeTruthy();
    const legend = el.querySelector('.legend')!.textContent!;
    expect(legend).toContain('ZentraValue, monthly');
    expect(legend).toContain('80% range');
  });

  it('says plainly when nothing is recorded', () => {
    const el = render([], null);
    expect(el.textContent).toContain('No sales are recorded for this property.');
    expect(el.querySelector('table')).toBeNull();
  });
});
