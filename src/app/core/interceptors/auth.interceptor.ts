import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { Observable, from, switchMap, takeUntil } from 'rxjs';
import { KeycloakService } from '../auth/keycloak.service';
import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { SessionEvents } from '../auth/session-events';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(
    private keycloakService: KeycloakService,
    private session: SessionEvents,
  ) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (
      ![environment.apiUrl, environment.notificationApiUrl].some((base) =>
        req.url.startsWith(base + '/'),
      )
    ) {
      return next.handle(req);
    }

    return (
      environment.authenticationEnabled
        ? from(this.addToken(req)).pipe(switchMap((authReq) => next.handle(authReq)))
        : next.handle(req)
    ).pipe(takeUntil(this.session.ended$));
  }

  private async addToken(req: HttpRequest<any>): Promise<HttpRequest<any>> {
    const token = await this.keycloakService.getValidToken();

    if (!token) {
      return req;
    }

    return req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    });
  }
}
