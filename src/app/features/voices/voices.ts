import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GalleryApiService } from '../../core/gallery-api.service';
import { GuestSessionService } from '../../core/guest-session.service';
import { MediaItemResponse } from '../../core/models/media-item';

const PAGE_SIZE = 50;

/**
 * Sezione dedicata ai messaggi vocali: lista ad ascolto, non griglia.
 * L'onda sonora e' decorativa e deterministica (dipende dall'id del media).
 */
@Component({
  selector: 'app-voices',
  imports: [RouterLink],
  templateUrl: './voices.html',
  styleUrl: './voices.scss',
})
export class Voices implements OnInit {
  private readonly api = inject(GalleryApiService);
  private readonly session = inject(GuestSessionService);

  readonly items = signal<MediaItemResponse[]>([]);
  readonly loading = signal(false);
  readonly playingId = signal<string | null>(null);
  readonly progress = signal(0);
  readonly confirmingId = signal<string | null>(null);
  readonly deleting = signal(false);

  ngOnInit(): void {
    this.loading.set(true);
    this.api.listMedia(0, PAGE_SIZE, 'AUDIO').subscribe({
      next: (result) => {
        this.items.set(result.content);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  /** Come in galleria: il cestino compare solo sui messaggi caricati da questo invitato. */
  isMine(item: MediaItemResponse): boolean {
    return !!this.session.id && item.guestId === this.session.id;
  }

  askDelete(item: MediaItemResponse): void {
    this.confirmingId.set(item.id);
  }

  cancelDelete(): void {
    this.confirmingId.set(null);
  }

  confirmDelete(): void {
    const id = this.confirmingId();
    if (!id || this.deleting()) {
      return;
    }
    this.deleting.set(true);
    this.api.deleteMedia(id).subscribe({
      next: () => {
        this.items.update((current) => current.filter((item) => item.id !== id));
        if (this.playingId() === id) {
          this.playingId.set(null);
          this.progress.set(0);
        }
        this.deleting.set(false);
        this.confirmingId.set(null);
      },
      error: () => {
        this.deleting.set(false);
        this.confirmingId.set(null);
      },
    });
  }

  contentFor(item: MediaItemResponse): string {
    return this.api.contentUrl(item.contentUrl);
  }

  toggle(player: HTMLAudioElement, item: MediaItemResponse): void {
    if (this.playingId() === item.id) {
      player.pause();
      this.playingId.set(null);
      return;
    }
    document.querySelectorAll('audio').forEach((other) => (other as HTMLAudioElement).pause());
    this.progress.set(0);
    player.play();
    this.playingId.set(item.id);
  }

  onTime(player: HTMLAudioElement, item: MediaItemResponse): void {
    if (this.playingId() !== item.id || !player.duration) {
      return;
    }
    this.progress.set(player.currentTime / player.duration);
  }

  onEnded(item: MediaItemResponse): void {
    if (this.playingId() === item.id) {
      this.playingId.set(null);
      this.progress.set(0);
    }
  }

  /** 22 barre "pseudo-casuali" ma stabili per lo stesso file. */
  bars(item: MediaItemResponse): number[] {
    const seed = item.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return Array.from({ length: 22 }, (_, i) => 22 + Math.abs(Math.sin((i + seed) * 1.7)) * 78);
  }

  barActive(item: MediaItemResponse, index: number): boolean {
    return this.playingId() === item.id && index / 22 <= this.progress();
  }

  durationLabel(item: MediaItemResponse): string {
    const kb = Math.round(item.sizeBytes / 1024);
    return kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
  }
}
