import { Component, inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { GalleryApiService } from '../../core/gallery-api.service';
import { MediaItemResponse } from '../../core/models/media-item';
import { MediaType } from '../../core/models/media-type';

const PAGE_SIZE = 24;

/**
 * Galleria condivisa: mostra i contributi di TUTTI gli invitati, con filtro per tipo
 * e caricamento a pagine successive ("carica altri").
 */
@Component({
  selector: 'app-gallery',
  standalone: true,
  imports: [MatButtonModule, MatButtonToggleModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './gallery.html',
  styleUrl: './gallery.scss'
})
export class Gallery implements OnInit {

  private readonly api = inject(GalleryApiService);

  readonly items = signal<MediaItemResponse[]>([]);
  readonly loading = signal(false);
  readonly loadingMore = signal(false);
  readonly filterType = signal<MediaType | null>(null);
  readonly page = signal(0);
  readonly hasMore = signal(true);

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
      next: result => {
        this.items.set(result.content);
        this.hasMore.set(!result.last);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  loadMore(): void {
    if (this.loadingMore() || !this.hasMore()) {
      return;
    }
    this.loadingMore.set(true);
    const nextPage = this.page() + 1;
    this.api.listMedia(nextPage, PAGE_SIZE, this.filterType()).subscribe({
      next: result => {
        this.items.update(current => [...current, ...result.content]);
        this.page.set(nextPage);
        this.hasMore.set(!result.last);
        this.loadingMore.set(false);
      },
      error: () => this.loadingMore.set(false)
    });
  }

  thumbnailFor(item: MediaItemResponse): string {
    const url = item.thumbnailUrl ?? item.contentUrl;
    return this.api.contentUrl(url);
  }

  contentFor(item: MediaItemResponse): string {
    return this.api.contentUrl(item.contentUrl);
  }

  downloadFor(item: MediaItemResponse): string {
    return this.api.contentUrl(item.downloadUrl);
  }
}
