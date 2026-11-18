import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';

import { ParcelService } from './parcel.service';

describe('ParcelService', () => {
  let service: ParcelService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient()] });
    service = TestBed.inject(ParcelService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
