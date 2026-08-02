import { Routes } from '@angular/router';
import { signedGuard } from './core/signed-guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'firma' },
  {
    path: 'firma',
    loadComponent: () => import('./features/sign/sign').then((m) => m.Sign),
  },
  {
    path: 'galleria',
    canActivate: [signedGuard],
    loadComponent: () => import('./features/gallery/gallery').then((m) => m.Gallery),
  },
  {
    path: 'voci',
    canActivate: [signedGuard],
    loadComponent: () => import('./features/voices/voices').then((m) => m.Voices),
  },
  {
    path: 'carica',
    canActivate: [signedGuard],
    loadComponent: () => import('./features/upload/upload').then((m) => m.Upload),
  },
  { path: '**', redirectTo: 'firma' },
];
