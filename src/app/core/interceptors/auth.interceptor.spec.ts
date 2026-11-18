import { HttpHandler, HttpRequest, HttpResponse } from '@angular/common/http';
import { firstValueFrom, of } from 'rxjs';
import { AuthInterceptor } from './auth.interceptor';
import { KeycloakService } from '../auth/keycloak.service';
import { SessionEvents } from '../auth/session-events';
import { environment } from '../../../environments/environment';
describe('API bearer scoping', () => {
  it('awaits a refreshed token before sending API requests', async () => {
    let sent: HttpRequest<unknown> | undefined;
    let resolve!: (token: string) => void;
    const token = new Promise<string>((r) => (resolve = r));
    const interceptor = new AuthInterceptor(
      { getValidToken: () => token } as KeycloakService,
      new SessionEvents(),
    );
    const handler: HttpHandler = {
      handle: (request) => {
        sent = request;
        return of(new HttpResponse());
      },
    };
    const result = firstValueFrom(
      interceptor.intercept(new HttpRequest('GET', environment.apiUrl + '/users/me'), handler),
    );
    expect(sent).toBeUndefined();
    resolve('test-token');
    await result;
    expect(sent?.headers.get('Authorization')).toBe('Bearer test-token');
  });
  it('never attaches the API bearer to external signed photos', async () => {
    let requested = false;
    let sent: HttpRequest<unknown> | undefined;
    const interceptor = new AuthInterceptor(
      {
        getValidToken: async () => {
          requested = true;
          return 'test-token';
        },
      } as KeycloakService,
      new SessionEvents(),
    );
    await firstValueFrom(
      interceptor.intercept(
        new HttpRequest('GET', 'https://photos.example.test/photo?signature=test'),
        {
          handle: (request) => {
            sent = request;
            return of(new HttpResponse());
          },
        },
      ),
    );
    expect(requested).toBe(false);
    expect(sent?.headers.has('Authorization')).toBe(false);
  });
  it('cancels a request waiting for a token when the identity ends', async () => {
    let sent = false;
    let resolve!: (token: string) => void;
    const token = new Promise<string>((r) => (resolve = r));
    const session = new SessionEvents();
    const interceptor = new AuthInterceptor(
      { getValidToken: () => token } as KeycloakService,
      session,
    );
    const subscription = interceptor
      .intercept(new HttpRequest('GET', environment.apiUrl + '/users/me'), {
        handle: () => {
          sent = true;
          return of(new HttpResponse());
        },
      })
      .subscribe();
    session.end();
    resolve('old-token');
    await token;
    await Promise.resolve();
    expect(sent).toBe(false);
    expect(subscription.closed).toBe(true);
  });
});
