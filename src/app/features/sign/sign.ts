import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { GalleryApiService } from '../../core/gallery-api.service';
import { GuestSessionService } from '../../core/guest-session.service';
import { ToastService } from '../../core/toast.service';

/**
 * Due passaggi in un solo componente: benvenuto a tutto schermo -> form di firma.
 */
@Component({
  selector: 'app-sign',
  imports: [FormsModule],
  templateUrl: './sign.html',
  styleUrl: './sign.scss',
})
export class Sign {
  private readonly api = inject(GalleryApiService);
  private readonly session = inject(GuestSessionService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly step = signal<'welcome' | 'form'>('welcome');
  readonly displayName = signal('');
  readonly message = signal('');
  readonly submitting = signal(false);

  get canSubmit(): boolean {
    return this.displayName().trim().length >= 2 && !this.submitting();
  }

  submit(): void {
    if (!this.canSubmit) {
      return;
    }
    this.submitting.set(true);
    this.api
      .signGuest({
        displayName: this.displayName().trim(),
        message: this.message().trim() || undefined,
      })
      .subscribe({
        next: (response) => {
          this.session.save(response);
          this.router.navigate(['/galleria']);
        },
        error: () => {
          this.submitting.set(false);
          this.toast.show('Qualcosa è andato storto, riprova.');
        },
      });
  }
}
