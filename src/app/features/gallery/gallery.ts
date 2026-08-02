import { Component, inject, OnInit, signal } from '@angular/core';
import { GalleryApiService } from '../../core/gallery-api.service';
import { MediaItemResponse } from '../../core/models/media-item';
import { MediaType } from '../../core/models/media-type';

const PAGE_SIZE = 24;

/**
 * Galleria condivisa in masonry (colonne CSS) + visualizzatore a schermo intero.
 * Gli audio non compaiono qui: hanno la loro sezione "Voci".
 */
@Component({
  selector: 'app-gallery',
  imports: [],
  templateUrl: './gallery.html',
  styleUrl: './gallery.scss',
})
export class Gallery implements OnInit {
  private readonly api = inject(GalleryApiService);

  readonly items = signal<MediaItemResponse[]>([]);
  readonly loading = signal(false);
  readonly loadingMore = signal(false);
  readonly filterType = signal<MediaType | null>(null);
  readonly page = signal(0);
  readonly hasMore = signal(true);
  readonly viewerIndex = signal<number | null>(null);

  readonly filters: { key: MediaType | null; label: string }[] = [
    { key: null, label: 'Tutti' },
    { key: 'PHOTO', label: 'Foto' },
    { key: 'VIDEO', label: 'Video' },
  ];

  ngOnInit(): void {
    this.loadFirstPage();
  }

  onFilterChange(type: MediaType | null): void {
    this.filterType.set(type);
    this.loadFirstPage();
  }

  loadFirstPage(): void {
    this.loading.set(true);
    this.page.set(0);
    this.api.listMedia(0, PAGE_SIZE, this.filterType()).subscribe({
      next: (result) => {
        this.items.set(this.withoutAudio(result.content));
        this.hasMore.set(!result.last);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  loadMore(): void {
    if (this.loadingMore() || !this.hasMore()) {
      return;
    }
    this.loadingMore.set(true);
    const nextPage = this.page() + 1;
    this.api.listMedia(nextPage, PAGE_SIZE, this.filterType()).subscribe({
      next: (result) => {
        this.items.update((current) => [...current, ...this.withoutAudio(result.content)]);
        this.page.set(nextPage);
        this.hasMore.set(!result.last);
        this.loadingMore.set(false);
      },
      error: () => this.loadingMore.set(false),
    });
  }

  openViewer(index: number): void {
    if (this.items()[index]?.mediaType === 'PHOTO') {
      this.viewerIndex.set(index);
    }
  }

  closeViewer(): void {
    this.viewerIndex.set(null);
  }

  step(delta: number): void {
    const current = this.viewerIndex();
    if (current === null) {
      return;
    }
    const next = current + delta;
    if (next >= 0 && next < this.items().length) {
      this.viewerIndex.set(next);
    }
  }

  get viewerItem(): MediaItemResponse | null {
    const index = this.viewerIndex();
    return index === null ? null : (this.items()[index] ?? null);
  }

  thumbnailFor(item: MediaItemResponse): string {
    return this.api.contentUrl(item.thumbnailUrl ?? item.contentUrl);
  }

  contentFor(item: MediaItemResponse): string {
    return this.api.contentUrl(item.contentUrl);
  }

  downloadFor(item: MediaItemResponse): string {
    return this.api.contentUrl(item.downloadUrl);
  }

  private withoutAudio(items: MediaItemResponse[]): MediaItemResponse[] {
    return items.filter((item) => item.mediaType !== 'AUDIO');
  }
}
