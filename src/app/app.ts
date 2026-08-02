import { Component, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { GuestSessionService } from './core/guest-session.service';
import { ToastService } from './core/toast.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  readonly session = inject(GuestSessionService);
  readonly toast = inject(ToastService);

  private readonly router = inject(Router);
  readonly url = signal(this.router.url);

  constructor() {
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event) => this.url.set((event as NavigationEnd).urlAfterRedirects));
  }

  /** La barra di navigazione compare solo dopo la firma e fuori dalla pagina di benvenuto. */
  get showNav(): boolean {
    return this.session.isSigned() && !this.url().startsWith('/firma');
  }

  isActive(path: string): boolean {
    return this.url().startsWith(path);
  }
}
