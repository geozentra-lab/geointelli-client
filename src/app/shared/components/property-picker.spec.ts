import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Store } from '@ngrx/store';
import { provideTestStore } from '../../store';
import { selectCatalog } from '../../store/catalog/catalog.selectors';
import { CatalogActions } from '../../store/catalog/catalog.actions';
import { PropertyPicker } from './property-picker';

const item = (id: number, address: string) => ({
  id,
  folio: 'F' + id,
  countyId: 1,
  countyName: 'Miami-Dade',
  stateCode: 'FL',
  stateName: 'Florida',
  address,
  city: 'Miami',
  zip: '33101',
  dorCode: null,
  propertyType: null,
  bedrooms: null,
  bathrooms: null,
  livingAreaSqft: null,
  lotSize: null,
  yearBuilt: null,
  neighborhood: null,
  neighborhoodDescription: null,
});

describe('Property address picker', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        ...provideTestStore(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  it('searches by address after a pause, keeping only the latest query', () => {
    const picker = TestBed.createComponent(PropertyPicker).componentInstance;
    picker.search('12');
    vi.advanceTimersByTime(300);
    http.expectNone((r) => r.url.endsWith('/properties/search'));
    picker.search('123 Main');
    vi.advanceTimersByTime(100);
    picker.search('123 Main St');
    vi.advanceTimersByTime(300);
    const r = http.expectOne((r) => r.url.endsWith('/properties/search'));
    expect(r.request.params.get('address')).toBe('123 Main St');
    expect(r.request.params.get('size')).toBe('8');
    r.flush({ content: [item(42, '123 Main St')] });
    expect(picker.state().items.map((p) => p.id)).toEqual([42]);
    // Matches are cached so their photos load and other screens can label them by address.
    expect(TestBed.inject(Store).selectSignal(selectCatalog)().entities[42]?.address).toBe(
      '123 Main St',
    );
    http.expectOne((r) => r.url.includes('/images/property/42')).flush([]);
  });

  it('emits the chosen property ID and resets the search', () => {
    const picker = TestBed.createComponent(PropertyPicker).componentInstance;
    const picked: (number | null)[] = [];
    picker.selected.subscribe((id) => picked.push(id));
    picker.choose(item(7, '7 Ocean Dr'));
    expect(picked).toEqual([7]);
    expect(picker.state().query).toBe('');
  });

  it('looks up a property referenced only by ID once', () => {
    const store = TestBed.inject(Store);
    store.dispatch(CatalogActions.resolveProperty({ id: 9 }));
    store.dispatch(CatalogActions.resolveProperty({ id: 9 }));
    http.expectOne((r) => r.url.endsWith('/properties/id/9')).flush({ id: 9, folio: 'F9' });
    http.expectOne((r) => r.url.includes('/images/property/9')).flush([]);
    expect(store.selectSignal(selectCatalog)().entities[9]?.folio).toBe('F9');
  });
});
