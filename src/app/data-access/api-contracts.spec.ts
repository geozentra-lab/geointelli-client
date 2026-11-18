import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ParcelService } from './parcel.service';
import { AddressService } from './address.service';
import { PropertyService } from './property.service';
import { PredictionService } from './prediction.service';
import { environment } from '../../environments/environment';
import { LocationService } from './location.service';
import { ImageService } from './image.service';
describe('Preserved API contracts', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('requests photos by internal property ID and preserves signed display URLs', () => {
    const url = 'https://images.example.test/42.webp?X-Amz-Signature=signature&X-Amz-Expires=600';
    let received: string | undefined;
    TestBed.inject(ImageService)
      .getPropertyImages(42)
      .subscribe((images) => (received = images[0].storagePath));
    const request = http.expectOne(environment.apiUrl + '/images/property/42');
    expect(request.request.method).toBe('GET');
    request.flush([{ id: 1, storagePath: url, displayOrder: 0, primaryImage: true }]);
    expect(received).toBe(url);
  });
  it('preserves bbox, leading-zero folio and address parameter names', () => {
    const parcels = TestBed.inject(ParcelService),
      addresses = TestBed.inject(AddressService);
    parcels.getParcels('-80.3,25.7,-80.2,25.8').subscribe();
    let request = http.expectOne((r) => r.url === environment.apiUrl + '/parcels');
    expect(request.request.params.get('bbox')).toBe('-80.3,25.7,-80.2,25.8');
    request.flush([]);
    parcels.getParcelByFolio('000123', 17).subscribe();
    request = http.expectOne((r) => r.url.endsWith('/parcels/byfolio'));
    expect(request.request.params.get('folio')).toBe('000123');
    expect(request.request.params.get('countyId')).toBe('17');
    request.flush([]);
    addresses.search('Oak Avenue').subscribe();
    request = http.expectOne((r) => r.url.endsWith('/addresses/search'));
    expect(request.request.params.get('rawAddress')).toBe('Oak Avenue');
    request.flush([]);
    addresses.suggest(' Oak ').subscribe();
    request = http.expectOne((r) => r.url.endsWith('/addresses/suggest'));
    expect(request.request.params.get('raw')).toBe('Oak');
    request.flush([]);
  });
  it('uses folio for detail and propertyId for single and bulk predictions', () => {
    TestBed.inject(PropertyService).getPropertyDetails('000123', 17).subscribe();
    const detail = http.expectOne((r) => r.url === environment.apiUrl + '/properties/000123');
    expect(detail.request.params.get('countyId')).toBe('17');
    detail.flush({});
    const predictions = TestBed.inject(PredictionService);
    predictions.getPropertyValuePrediction(42).subscribe();
    const single = http.expectOne((r) => r.url.endsWith('/predictions/bypropertyid'));
    expect(single.request.params.get('propertyId')).toBe('42');
    single.flush({});
    predictions.getPropertyValuePredictionBulk([42, 43]).subscribe();
    const bulk = http.expectOne(environment.apiUrl + '/predictions/bulk');
    expect(bulk.request.method).toBe('POST');
    expect(bulk.request.body).toEqual({ propertyIds: [42, 43] });
    bulk.flush({});
  });
  it('loads backend state and county identifiers for folio search', () => {
    const service = TestBed.inject(LocationService);
    service.getStates().subscribe();
    http.expectOne(environment.apiUrl + '/locations/states').flush([]);
    service.getCounties(99).subscribe();
    const request = http.expectOne((r) => r.url.endsWith('/locations/counties'));
    expect(request.request.params.get('stateId')).toBe('99');
    request.flush([]);
  });
});
