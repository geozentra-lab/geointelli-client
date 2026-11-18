import { inject, Injectable } from '@angular/core';
import { EffectNotification, OnRunEffects } from '@ngrx/effects';
import { Observable, startWith, switchMap } from 'rxjs';
import { SessionEvents } from '../core/auth/session-events';
/** Drop in-flight work and queued mutations when the identity ends, then accept new-session actions. */
@Injectable()
export abstract class SessionScopedEffects implements OnRunEffects {
  private readonly lifecycle = inject(SessionEvents);
  ngrxOnRunEffects(effects: Observable<EffectNotification>): Observable<EffectNotification> {
    return this.lifecycle.ended$.pipe(
      startWith(undefined),
      switchMap(() => effects),
    );
  }
}
