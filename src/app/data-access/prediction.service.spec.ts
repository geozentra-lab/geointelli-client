import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';

import { PredictionService } from './prediction.service';

describe('PredictionService', () => {
  let service: PredictionService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient()] });
    service = TestBed.inject(PredictionService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
