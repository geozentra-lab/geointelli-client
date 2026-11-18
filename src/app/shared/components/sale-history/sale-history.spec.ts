import { TestBed } from '@angular/core/testing';
import { Sale } from '../../../core/models/sale';
import { PropertyValuePrediction } from '../../../core/models/property_prediction_value';
import { SaleHistory, priceHistory } from './sale-history';

const sale = (saleDate: string, salePrice: number) => ({ saleDate, salePrice }) as Sale;
const estimate = {
  predictedPrice: 450000,
  predictionDate: '2026-10-29',
} as PropertyValuePrediction;

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
  it('renders flat prices safely and lets users select exact sale dates', () => {
    TestBed.configureTestingModule({ imports: [SaleHistory] });
    const fixture = TestBed.createComponent(SaleHistory);
    fixture.componentRef.setInput('sales', [sale('2020-02-01', 450000)]);
    fixture.componentRef.setInput('prediction', estimate);
    fixture.detectChanges();
    expect(
      fixture.componentInstance
        .chart()
        .points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)),
    ).toBe(true);
    expect(fixture.nativeElement.querySelectorAll('.price-point').length).toBe(2);
    expect(
      fixture.nativeElement.querySelector('.estimate-line').getAttribute('points'),
    ).toBeTruthy();
    fixture.nativeElement.querySelector('.history-event').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.history-value').textContent).toContain(
      'Feb 1, 2020',
    );
    expect(fixture.nativeElement.querySelector('.history-value').textContent).toContain(
      'Recorded sale',
    );
  });
  it('shows the exact price and date on hover, switches to the estimate, and hides on leave', () => {
    TestBed.configureTestingModule({ imports: [SaleHistory] });
    const fixture = TestBed.createComponent(SaleHistory);
    fixture.componentRef.setInput('sales', [sale('2020-02-01', 300000)]);
    fixture.componentRef.setInput('prediction', estimate);
    fixture.detectChanges();
    const targets = fixture.nativeElement.querySelectorAll('.point-hit');
    targets[0].dispatchEvent(new Event('pointerenter'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role=tooltip]').textContent).toContain('$300,000');
    expect(fixture.nativeElement.querySelector('[role=tooltip]').textContent).toContain(
      'Feb 1, 2020',
    );
    targets[1].dispatchEvent(new Event('pointerenter'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role=tooltip]').textContent).toContain(
      'Estimated price',
    );
    expect(fixture.nativeElement.querySelector('[role=tooltip]').textContent).toContain('$450,000');
    targets[1].dispatchEvent(new Event('pointerleave'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role=tooltip]')).toBeNull();
    targets[0].dispatchEvent(new Event('focus'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role=tooltip]').textContent).toContain('$300,000');
    targets[0].dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role=tooltip]')).toBeNull();
  });
});
