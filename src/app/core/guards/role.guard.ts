import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { selectUser } from '../../store/user/user.selectors';
import { Persona } from '../../store/user/user.model';
// Presentation routing only. API authorization must use server-issued roles.
export const roleGuard: CanActivateFn = (route) => {
  const roles = route.data['roles'] as Persona[] | undefined;
  const user = inject(Store).selectSignal(selectUser)();
  return (
    !roles?.length || roles.includes(user.role) || inject(Router).createUrlTree(['/dashboard'])
  );
};
