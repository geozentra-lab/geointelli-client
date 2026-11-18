import { SessionScopedEffects } from '../session-scoped-effects';
import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, map, of, switchMap, EMPTY } from 'rxjs';
import { ImageService } from '../../data-access/image.service';
import { PropertyImagesActions as A } from './property-images.actions';
@Injectable()
export class PropertyImagesEffects extends SessionScopedEffects {
  private actions = inject(Actions);
  private service = inject(ImageService);
  load = createEffect(() =>
    this.actions.pipe(
      ofType(A.load, A.clear),
      switchMap((action) =>
        action.type === A.clear.type
          ? EMPTY
          : this.service.getPropertyImages(action.propertyId).pipe(
              map((images) => A.loaded({ propertyId: action.propertyId, images })),
              catchError(() =>
                of(
                  A.failed({
                    propertyId: action.propertyId,
                    error: 'Property photos could not load. Please try again.',
                  }),
                ),
              ),
            ),
      ),
    ),
  );
}
