import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';

import { TransportationAnalysisService } from './transportation-analysis.service';

describe('TransportationAnalysisService', () => {
  let service: TransportationAnalysisService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient()] });
    service = TestBed.inject(TransportationAnalysisService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
