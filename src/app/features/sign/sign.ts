import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { GalleryApiService } from '../../core/gallery-api.service';
import { GuestSessionService } from '../../core/guest-session.service';

/**
 * Pagina di "firma": unico passaggio richiesto agli invitati al posto del login.
 * Dopo la firma il token viene salvato nel browser e non viene piu' richiesto nulla.
 */
@Component({
  selector: 'app-sign',
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './sign.html',
  styleUrl: './sign.scss'
})
export class Sign {

  private readonly api = inject(GalleryApiService);
  private readonly session = inject(GuestSessionService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

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
    this.api.signGuest({
      displayName: this.displayName().trim(),
      message: this.message().trim() || undefined
    }).subscribe({
      next: response => {
        this.session.save(response);
        this.router.navigate(['/galleria']);
      },
      error: () => {
        this.submitting.set(false);
        this.snackBar.open('Qualcosa e\' andato storto, riprova.', 'Chiudi', { duration: 4000 });
      }
    });
  }
}
