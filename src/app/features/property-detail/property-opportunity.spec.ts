import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Store } from '@ngrx/store';
import { provideTestStore } from '../../store';
import { PropertyInsightsActions as A } from '../../store/property-insights/property-insights.actions';
import { OpportunityScoreDTO } from '../../core/models/opportunity';
import { formatLocalDate, formatRecordDate } from '../../shared/data/format';
import { PropertyOpportunity } from './property-opportunity';

/** Late evening in UTC: the next day east of Greenwich, the same day west of it. */
const SCORED_AT = '2026-11-18T23:30:00Z';
const score: OpportunityScoreDTO = {
  propertyId: 42,
  scoreVersion: 'opportunity-v1',
  status: 'SCORED',
  score: 36.3,
  maxScore: 100,
  coveragePercent: 50,
  factors: [],
  reasons: [],
  valuation: {
    estimatedValue: 985000,
    valuationStatus: 'SUPPORTED',
    confidence: 'MEDIUM',
    modelVersion: 'v17',
    dataThrough: '2026-10-31',
    runId: 'run-1',
  },
  scoredAt: SCORED_AT,
  notes: [],
};

describe('Property opportunity score', () => {
  it('writes the scored instant on the viewer’s own day, and sales through as a calendar date', () => {
    TestBed.configureTestingModule({
      imports: [PropertyOpportunity],
      providers: [provideHttpClient(), provideHttpClientTesting(), ...provideTestStore()],
    });
    const store = TestBed.inject(Store);
    const fixture = TestBed.createComponent(PropertyOpportunity);
    fixture.componentRef.setInput('propertyId', 42);
    fixture.detectChanges();
    store.dispatch(A.opportunityLoaded({ propertyId: 42, score }));
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent!.replace(/\s+/g, ' ');
    // The same day as the Opportunities record pane shows (DESIGN.md §13), not the UTC one.
    expect(text).toContain(`Scored ${formatLocalDate(SCORED_AT)}.`);
    expect(text).toContain(`with sales through ${formatRecordDate('2026-10-31')}`);
  });
});
