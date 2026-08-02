import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GalleryApiService } from '../../core/gallery-api.service';
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
  styleUrl: './voices.scss'
})
export class Voices implements OnInit {

  private readonly api = inject(GalleryApiService);

  readonly items = signal<MediaItemResponse[]>([]);
  readonly loading = signal(false);
  readonly playingId = signal<string | null>(null);
  readonly progress = signal(0);

  ngOnInit(): void {
    this.loading.set(true);
    this.api.listMedia(0, PAGE_SIZE, 'AUDIO').subscribe({
      next: result => {
        this.items.set(result.content);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
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
    document.querySelectorAll('audio').forEach(other => (other as HTMLAudioElement).pause());
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
