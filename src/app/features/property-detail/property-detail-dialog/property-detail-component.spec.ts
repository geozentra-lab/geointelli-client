import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { provideTestStore } from '../../../store';
import { Store } from '@ngrx/store';
import { PropertyCompareActions } from '../../../store/property-compare/property-compare.actions';
import { PropertyDetailComponent } from './property-detail-component';

function open() {
  TestBed.configureTestingModule({
    imports: [PropertyDetailComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      ...provideTestStore(),
      { provide: MAT_DIALOG_DATA, useValue: { folio: '000123', propertyId: 42, countyId: 17 } },
    ],
  });
  const fixture = TestBed.createComponent(PropertyDetailComponent);
  fixture.detectChanges();
  return { fixture, http: TestBed.inject(HttpTestingController) };
}

describe('Live property dialog', () => {
  it('keeps folio and numeric prediction identifier separate', () => {
    const { fixture } = open();
    expect(fixture.componentInstance.data).toEqual({
      folio: '000123',
      propertyId: 42,
      countyId: 17,
    });
  });

  it('shows the same canonical valuation as the property page, with the range marker from data', () => {
    const { fixture, http } = open();
    // The dialog reads the canonical valuation, not the older predictions endpoint.
    expect(http.match((r) => r.url.includes('/predictions/')).length).toBe(0);
    http
      .expectOne((r) => r.url.endsWith('/properties/id/42/valuation'))
      .flush({
        status: 'supported',
        estimate: {
          value: 300000,
          range80: { low: 250000, high: 450000 },
          confidence: 'medium',
        },
        forecasts: { oneYear: { value: 306000 } },
        evidence: { lastSale: { hasSaleHistory: true, price: 210000, date: '2016-07-06' } },
        method: { predictionDate: '2026-11-08' },
      });
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const text = el.textContent!.replace(/\s+/g, ' ');
    expect(text).toContain('$300,000');
    const ends = el.querySelector('.range-ends')!.textContent!.replace(/\s+/g, ' ');
    expect(ends).toContain('$250,000');
    expect(ends).toContain('80% range');
    expect(ends).toContain('$450,000');
    expect(text).toContain('Medium confidence');
    expect(text).toContain('(+2.0%)');
    expect(text).toContain('$210,000');
    // No 90% range was sent, so the track spans the 80% range widened by 25% on each side
    // ($200,000 to $500,000): the band and the estimate's tick sit where the data puts them.
    const band = el.querySelector<HTMLElement>('.range-track i')!;
    expect(band.style.left).toBe('16.7%');
    expect(band.style.right).toBe('16.7%');
    expect(el.querySelector<HTMLElement>('.range-track i.pt')!.style.left).toBe('33.3%');
  });

  it('lists the reasons instead of a value when the property is unsupported', () => {
    const { fixture, http } = open();
    http
      .expectOne((r) => r.url.endsWith('/properties/id/42/valuation'))
      .flush({
        status: 'unsupported',
        reasons: [{ code: 'above_validated_range', message: 'Above the tested range.' }],
      });
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    // The figure and range become the Unavailable marker, with the backend's reason on it.
    expect(el.querySelector('.zv-fig')).toBeNull();
    expect(el.querySelector('.range-track')).toBeNull();
    const marker = el.querySelector('.zv-na.na')!;
    expect(marker.textContent).toContain('Unavailable');
    expect(marker.textContent).toContain('Above the tested range.');
    expect(el.textContent).not.toContain('$0');
  });

  it('lets the home be added to the comparison from the dialog', () => {
    const { fixture } = open();
    const el = fixture.nativeElement as HTMLElement;
    const toggle = [...el.querySelectorAll<HTMLButtonElement>('.dialog-actions button')].find((b) =>
      b.textContent!.includes('Compare'),
    )!;
    expect(toggle.textContent).toContain('+ Compare');
    toggle.click();
    fixture.detectChanges();
    expect(toggle.textContent).toContain('Comparing');
    expect(el.textContent).toContain('Add 1 more to compare');
    // With a second home picked, the dialog links straight to the side-by-side view, because the
    // comparison tray is hidden behind the dialog.
    TestBed.inject(Store).dispatch(PropertyCompareActions.toggle({ propertyId: 7 }));
    fixture.detectChanges();
    const link = el.querySelector<HTMLAnchorElement>('.dialog-actions a.btn')!;
    expect(link.textContent).toContain('Compare side by side (2)');
    expect(decodeURIComponent(link.getAttribute('href')!)).toBe('/compare?ids=42,7');
  });
});
