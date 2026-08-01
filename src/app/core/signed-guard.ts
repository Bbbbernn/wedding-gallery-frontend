import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { GuestSessionService } from './guest-session.service';

/** Blocca l'accesso alla galleria/upload finche' l'invitato non si e' firmato. */
export const signedGuard: CanActivateFn = () => {
  const session = inject(GuestSessionService);
  const router = inject(Router);

  if (session.isSigned()) {
    return true;
  }
  return router.createUrlTree(['/firma']);
};
