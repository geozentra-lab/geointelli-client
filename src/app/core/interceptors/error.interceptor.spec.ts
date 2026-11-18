import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { vi } from 'vitest';
import { errorInterceptor } from './error.interceptor';
import { environment } from '../../../environments/environment';
describe('Bounded request recovery', () => {
  let http: HttpTestingController;
  let client: HttpClient;
  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    client = TestBed.inject(HttpClient);
  });
  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });
  it('retries temporary safe-read failures twice and then reports failure', async () => {
    let failed = false;
    client
      .get(environment.apiUrl + '/properties/search')
      .subscribe({ error: () => (failed = true) });
    http
      .expectOne((r) => r.url.endsWith('/properties/search'))
      .flush({}, { status: 503, statusText: 'Unavailable' });
    expect(failed).toBe(false);
    await vi.advanceTimersByTimeAsync(400);
    http
      .expectOne((r) => r.url.endsWith('/properties/search'))
      .flush({}, { status: 503, statusText: 'Unavailable' });
    await vi.advanceTimersByTimeAsync(800);
    http
      .expectOne((r) => r.url.endsWith('/properties/search'))
      .flush({}, { status: 503, statusText: 'Unavailable' });
    expect(failed).toBe(true);
    await vi.advanceTimersByTimeAsync(5000);
    http.expectNone((r) => r.url.endsWith('/properties/search'));
  });
  it('never retries writes or authentication failures', async () => {
    let errors = 0;
    client
      .post(environment.apiUrl + '/portfolios', { name: 'Test' })
      .subscribe({ error: () => errors++ });
    http
      .expectOne((r) => r.url.endsWith('/portfolios'))
      .flush({}, { status: 503, statusText: 'Unavailable' });
    client.get(environment.apiUrl + '/users/me').subscribe({ error: () => errors++ });
    http
      .expectOne((r) => r.url.endsWith('/users/me'))
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    await vi.advanceTimersByTimeAsync(10000);
    expect(errors).toBe(2);
    http.expectNone(() => true);
  });
  it('does not send a retry after the caller has cancelled', async () => {
    const subscription = client.get(environment.apiUrl + '/properties/search').subscribe();
    http
      .expectOne((r) => r.url.endsWith('/properties/search'))
      .flush({}, { status: 503, statusText: 'Unavailable' });
    subscription.unsubscribe();
    await vi.advanceTimersByTimeAsync(5000);
    http.expectNone(() => true);
  });
});
