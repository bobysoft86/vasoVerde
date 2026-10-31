import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (_, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const destination = (user: ReturnType<typeof auth.currentUser>) => {
    if (!user) return router.createUrlTree(['/login']);
    if (user.mustChangePassword && state.url !== '/change-password') return router.createUrlTree(['/change-password']);
    return true;
  };
  if (auth.isAuthenticated()) return destination(auth.currentUser());
  return auth.refresh().pipe(
    map((response) => destination(response.user)),
    catchError(() => of(router.createUrlTree(['/login']))),
  );
};
