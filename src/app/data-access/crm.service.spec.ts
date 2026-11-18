import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CrmService } from './crm.service';
import { environment } from '../../environments/environment';
import { nextDealStages, nextLeadStages, nextTaskStatuses } from '../core/models/crm';
describe('CRM API contract', () => {
  let http: HttpTestingController;
  let service: CrmService;
  const api = environment.apiUrl;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(CrmService);
  });
  afterEach(() => http.verify());

  it('pages clients and sends partial client patches', () => {
    service.clients(2).subscribe();
    let request = http.expectOne((r) => r.url === api + '/clients');
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('size')).toBe('20');
    request.flush({ content: [], page: 2, size: 20, totalElements: 0, totalPages: 0 });
    service.updateClient(7, { email: null }).subscribe();
    request = http.expectOne(api + '/clients/7');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ email: null });
    request.flush({});
    service.deleteClient(7).subscribe();
    expect(http.expectOne(api + '/clients/7').request.method).toBe('DELETE');
  });

  it('sends the lead Idempotency-Key and omits empty stage filters', () => {
    service.createLead({ clientId: 3, title: 'Condo', source: 'Website' }, 'key-1').subscribe();
    let request = http.expectOne(api + '/leads');
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Idempotency-Key')).toBe('key-1');
    request.flush({});
    service.leads(0, null).subscribe();
    request = http.expectOne((r) => r.url === api + '/leads');
    expect(request.request.params.has('stage')).toBe(false);
    request.flush({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 });
    service.leads(0, 'QUALIFIED').subscribe();
    request = http.expectOne((r) => r.url === api + '/leads');
    expect(request.request.params.get('stage')).toBe('QUALIFIED');
    request.flush({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 });
  });

  it('uses task, deal, summary and pipeline routes', () => {
    service.tasks(0, 'OPEN').subscribe();
    const tasks = http.expectOne((r) => r.url === api + '/tasks');
    expect(tasks.request.params.get('status')).toBe('OPEN');
    tasks.flush({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 });
    service.taskSummary().subscribe();
    http.expectOne(api + '/tasks/summary').flush({});
    service.updateTask(4, { status: 'COMPLETED' }).subscribe();
    const patch = http.expectOne(api + '/tasks/4');
    expect(patch.request.method).toBe('PATCH');
    expect(patch.request.body).toEqual({ status: 'COMPLETED' });
    patch.flush({});
    service.deals(1, 'OFFER').subscribe();
    const deals = http.expectOne((r) => r.url === api + '/transactions');
    expect(deals.request.params.get('stage')).toBe('OFFER');
    deals.flush({ content: [], page: 1, size: 20, totalElements: 0, totalPages: 0 });
    service.pipeline().subscribe();
    http.expectOne(api + '/transactions/pipeline').flush({});
  });

  it('reads histories per subject and posts notes', () => {
    service.activities(0, 10).subscribe();
    const feed = http.expectOne((r) => r.url === api + '/crm/activities');
    expect(feed.request.params.get('size')).toBe('10');
    feed.flush({ content: [], page: 0, size: 10, totalElements: 0, totalPages: 0 });
    for (const [subject, path] of [
      ['CLIENT', 'clients'],
      ['LEAD', 'leads'],
      ['TASK', 'tasks'],
      ['TRANSACTION', 'transactions'],
    ] as const) {
      service.history(subject, 9).subscribe();
      http
        .expectOne((r) => r.url === `${api}/${path}/9/activities`)
        .flush({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 });
    }
    service.addNote('LEAD', 5, 'Called back').subscribe();
    const note = http.expectOne(api + '/leads/5/activities');
    expect(note.request.method).toBe('POST');
    expect(note.request.body).toEqual({ description: 'Called back' });
    note.flush({});
  });

  it('offers only backend-supported transitions', () => {
    expect(nextLeadStages('NEW')).toEqual(['CONTACTED', 'LOST']);
    expect(nextLeadStages('CONVERTED')).toEqual([]);
    expect(nextTaskStatuses('COMPLETED')).toEqual(['OPEN']);
    expect(nextTaskStatuses('IN_PROGRESS')).toEqual(['OPEN', 'COMPLETED', 'CANCELLED']);
    expect(nextDealStages('UNDER_CONTRACT')).toEqual(['CLOSED', 'CANCELLED']);
    expect(nextDealStages('CLOSED')).toEqual([]);
  });
});
