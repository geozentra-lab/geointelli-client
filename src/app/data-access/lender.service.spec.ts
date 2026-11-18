import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { LenderService } from './lender.service';
import { environment } from '../../environments/environment';
import { nextLenderStages, parseLenderImport } from '../core/models/lender';
describe('Lender API contract', () => {
  let http: HttpTestingController;
  let service: LenderService;
  const api = environment.apiUrl + '/lender';
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(LenderService);
  });
  afterEach(() => http.verify());

  it('scopes every application call by organizationId and omits an empty stage filter', () => {
    service.applications(4, 1, null).subscribe();
    let r = http.expectOne((r) => r.url === api + '/applications');
    expect(r.request.params.get('organizationId')).toBe('4');
    expect(r.request.params.get('page')).toBe('1');
    expect(r.request.params.has('stage')).toBe(false);
    r.flush({ content: [], page: 1, size: 20, totalElements: 0, totalPages: 0 });
    service.applications(4, 0, 'APPROVED').subscribe();
    r = http.expectOne((r) => r.url === api + '/applications');
    expect(r.request.params.get('stage')).toBe('APPROVED');
    r.flush({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 });
    service.pipeline(4).subscribe();
    r = http.expectOne((r) => r.url === api + '/pipeline');
    expect(r.request.params.get('organizationId')).toBe('4');
    r.flush({});
    service.importApplications(4, { source: 'P', rows: [] }).subscribe();
    r = http.expectOne((r) => r.url === api + '/applications/import');
    expect(r.request.method).toBe('POST');
    expect(r.request.params.get('organizationId')).toBe('4');
    r.flush({});
  });

  it('never sends the organization or actor in the create body, and patches only changed fields', () => {
    service.createApplication(4, { applicantName: 'A', requestedAmount: 1000 }).subscribe();
    let r = http.expectOne((r) => r.url === api + '/applications');
    expect(r.request.method).toBe('POST');
    expect(r.request.body).toEqual({ applicantName: 'A', requestedAmount: 1000 });
    r.flush({});
    service.updateApplication(4, 9, { stage: 'APPROVED', approvedAmount: 900 }).subscribe();
    r = http.expectOne((r) => r.url === api + '/applications/9');
    expect(r.request.method).toBe('PATCH');
    expect(r.request.params.get('organizationId')).toBe('4');
    expect(r.request.body).toEqual({ stage: 'APPROVED', approvedAmount: 900 });
    r.flush({});
  });

  it('manages organization members by user ID', () => {
    service.addMember(4, 12).subscribe();
    let r = http.expectOne(api + '/organizations/4/members');
    expect(r.request.method).toBe('POST');
    expect(r.request.body).toEqual({ userId: 12 });
    r.flush(null);
    service.removeMember(4, 12).subscribe();
    r = http.expectOne(api + '/organizations/4/members/12');
    expect(r.request.method).toBe('DELETE');
    r.flush(null);
  });

  it('offers exactly the backend stage transitions', () => {
    expect(nextLenderStages('DRAFT')).toEqual(['SUBMITTED', 'WITHDRAWN']);
    expect(nextLenderStages('SUBMITTED')).toEqual(['UNDER_REVIEW', 'WITHDRAWN']);
    expect(nextLenderStages('UNDER_REVIEW')).toEqual(['APPROVED', 'REJECTED', 'WITHDRAWN']);
    expect(nextLenderStages('APPROVED')).toEqual(['FUNDED', 'WITHDRAWN']);
    for (const terminal of ['FUNDED', 'REJECTED', 'WITHDRAWN'] as const)
      expect(nextLenderStages(terminal)).toEqual([]);
  });

  it('validates pasted import JSON before sending', () => {
    expect('error' in parseLenderImport('{')).toBe(true);
    expect('error' in parseLenderImport('{"source":"P","rows":[]}')).toBe(true);
    const tooMany = JSON.stringify({ source: 'P', rows: Array.from({ length: 101 }, () => ({})) });
    expect('error' in parseLenderImport(tooMany)).toBe(true);
    const ok = parseLenderImport('{"source":" partner ","rows":[{"externalId":"1"}]}');
    expect('request' in ok && ok.request.source).toBe('partner');
  });
});
