import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ContactRequestService } from './contact-request.service';
import { ImportJobService } from './import-job.service';
import { CONTACT_CONSENT_VERSION } from '../core/models/contact';
import { notificationUrl } from '../core/models/notification';
describe('Backend master contracts: contact requests and import jobs', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('submits a consented contact request with an Idempotency-Key', () => {
    TestBed.inject(ContactRequestService)
      .submit(
        {
          propertyId: 5,
          professionalUserId: 9,
          contactName: 'Sam Buyer',
          contactPhone: '+1 305 555 0100',
          consent: true,
          consentVersion: CONTACT_CONSENT_VERSION,
        },
        'key-1',
      )
      .subscribe();
    const r = http.expectOne((r) => r.url.endsWith('/contact-requests'));
    expect(r.request.method).toBe('POST');
    expect(r.request.headers.get('Idempotency-Key')).toBe('key-1');
    expect(r.request.body.consent).toBe(true);
    expect(r.request.body.consentVersion).toBe('property-contact-v1');
    expect(r.request.body.contactEmail).toBeUndefined();
    r.flush({});
  });
  it('lists selectable professionals within the backend page bounds', () => {
    TestBed.inject(ContactRequestService).professionals().subscribe();
    const r = http.expectOne((r) => r.url.endsWith('/contact-requests/professionals'));
    expect(Number(r.request.params.get('size'))).toBeLessThanOrEqual(100);
    r.flush({ content: [] });
  });
  it('reads admin import jobs from the admin namespace', () => {
    const service = TestBed.inject(ImportJobService);
    service.list(2).subscribe();
    service.get('7').subscribe();
    const list = http.expectOne((r) => r.url.endsWith('/admin/import-jobs'));
    expect(list.request.params.get('page')).toBe('2');
    list.flush({ jobs: { content: [] }, untrackedJobTypes: [], note: null });
    http.expectOne((r) => r.url.endsWith('/admin/import-jobs/7')).flush({});
  });
  it('opens the leads tab from a contact-request notification', () => {
    expect(
      notificationUrl({ eventType: 'CONTACT_REQUEST', propertyId: 5 } as Parameters<
        typeof notificationUrl
      >[0]),
    ).toBe('/crm/leads');
  });
});
