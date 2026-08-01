import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { GuestSessionService } from './guest-session.service';

/**
 * Aggiunge automaticamente l'header X-Guest-Token a ogni richiesta verso le API,
 * cosi' i singoli componenti non devono preoccuparsene (upload escluso, che lo imposta
 * gia' esplicitamente in GalleryApiService per chiarezza sul flusso multipart).
 */
export const guestTokenInterceptor: HttpInterceptorFn = (req, next) => {
  const session = inject(GuestSessionService);
  const token = session.token;

  if (!token || req.headers.has('X-Guest-Token')) {
    return next(req);
  }

  return next(req.clone({
    setHeaders: { 'X-Guest-Token': token }
  }));
};
