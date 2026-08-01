import { Injectable, signal } from '@angular/core';
import { GuestRegisteredResponse } from './models/guest';

const STORAGE_KEY = 'wedding-gallery.guest';

interface StoredGuest {
  id: string;
  displayName: string;
  token: string;
}

/**
 * Tiene la "firma" dell'invitato nel browser (localStorage), al posto del login.
 * Il token viene generato una sola volta dal backend e riletto a ogni avvio dell'app.
 */
@Injectable({ providedIn: 'root' })
export class GuestSessionService {

  private readonly guestSignal = signal<StoredGuest | null>(this.readFromStorage());

  readonly guest = this.guestSignal.asReadonly();

  isSigned(): boolean {
    return this.guestSignal() !== null;
  }

  get token(): string | null {
    return this.guestSignal()?.token ?? null;
  }

  get displayName(): string | null {
    return this.guestSignal()?.displayName ?? null;
  }

  save(response: GuestRegisteredResponse): void {
    const stored: StoredGuest = {
      id: response.id,
      displayName: response.displayName,
      token: response.token
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    this.guestSignal.set(stored);
  }

  /** Usato se il token salvato risulta non piu' valido (es. dopo un reset del database). */
  clear(): void {
    localStorage.removeItem(STORAGE_KEY);
    this.guestSignal.set(null);
  }

  private readFromStorage(): StoredGuest | null {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as StoredGuest;
    } catch {
      return null;
    }
  }
}
