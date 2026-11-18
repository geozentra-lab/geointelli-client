import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { map, switchMap, timer } from 'rxjs';
import { UiActions } from './ui.actions';
@Injectable()
export class UiEffects {
  private actions = inject(Actions);
  clear = createEffect(() =>
    this.actions.pipe(
      ofType(UiActions.toast),
      switchMap(({ message }) => timer(5000).pipe(map(() => UiActions.clearToast({ message })))),
    ),
  );
}
