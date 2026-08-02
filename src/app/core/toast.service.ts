import { Injectable, signal } from '@angular/core';

/**
 * Sostituisce MatSnackBar: un solo messaggio alla volta, renderizzato da App.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {

  readonly message = signal<string | null>(null);
  private timer: ReturnType<typeof setTimeout> | null = null;

  show(message: string, durationMs = 3500): void {
    this.message.set(message);
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => this.message.set(null), durationMs);
  }
}
