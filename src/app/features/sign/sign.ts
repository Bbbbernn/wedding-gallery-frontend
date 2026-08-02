import { Component, inject, OnInit, signal } from '@angular/core';
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
export class Sign implements OnInit {
  private readonly api = inject(GalleryApiService);
  private readonly session = inject(GuestSessionService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly step = signal<'welcome' | 'form'>('welcome');
  readonly displayName = signal('');
  readonly message = signal('');
  readonly submitting = signal(false);

  /**
   * Se nel browser c'e' gia' una firma, non si ripropone il form: si verifica che il
   * token corrisponda ancora a un invitato reale e si va dritti in galleria. Senza
   * questo controllo ogni riapertura del sito creava un invitato NUOVO, con un token
   * nuovo scritto sopra al precedente.
   */
  ngOnInit(): void {
    if (!this.session.isSigned()) {
      return;
    }
    this.api.me().subscribe({
      next: (guest) => {
        this.toast.show(`Bentornato, ${guest.displayName}`);
        this.router.navigate(['/galleria'], { replaceUrl: true });
      },
      error: () => {
        // Token orfano (es. database ripulito): si riparte dalla firma.
        this.session.clear();
      },
    });
  }

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
