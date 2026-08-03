import { Component, DOCUMENT, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { GalleryApiService } from '../../core/gallery-api.service';
import { GuestSessionService } from '../../core/guest-session.service';
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
export class Gallery implements OnInit, OnDestroy {
  private readonly api = inject(GalleryApiService);
  private readonly session = inject(GuestSessionService);
  private readonly document = inject(DOCUMENT);

  readonly items = signal<MediaItemResponse[]>([]);
  readonly loading = signal(false);
  readonly loadingMore = signal(false);
  readonly filterType = signal<MediaType | null>(null);
  readonly page = signal(0);
  readonly hasMore = signal(true);
  readonly viewerIndex = signal<number | null>(null);
  readonly deleting = signal(false);
  readonly confirmingDelete = signal(false);

  /** Valori originali di overflow, ripristinati alla chiusura del visualizzatore. */
  private previousHtmlOverflow: string | null = null;
  private previousBodyOverflow: string | null = null;

  readonly filters: { key: MediaType | null; label: string }[] = [
    { key: null, label: 'Tutti' },
    { key: 'PHOTO', label: 'Foto' },
    { key: 'VIDEO', label: 'Video' },
  ];

  ngOnInit(): void {
    this.loadFirstPage();
  }

  /** Se si lascia la pagina con il visualizzatore aperto, lo scroll va comunque sbloccato. */
  ngOnDestroy(): void {
    this.unlockScroll();
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
    this.viewerIndex.set(index);
    this.lockScroll();
  }

  closeViewer(): void {
    this.viewerIndex.set(null);
    this.confirmingDelete.set(false);
    this.unlockScroll();
  }

  /**
   * Il visualizzatore e' in position: fixed e copre tutto, ma senza questo blocco
   * il trascinamento del dito arriva comunque alla pagina sotto e la galleria
   * continua a scorrere dietro la foto. overflow: hidden su <html> e <body> ferma
   * lo scroll mantenendo la posizione: alla chiusura si ritrova il punto in cui
   * si era, cosa che il trucco con position: fixed sul body farebbe perdere.
   */
  private lockScroll(): void {
    if (this.previousBodyOverflow !== null) {
      return;
    }
    const html = this.document.documentElement;
    const body = this.document.body;
    this.previousHtmlOverflow = html.style.overflow;
    this.previousBodyOverflow = body.style.overflow;
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
  }

  private unlockScroll(): void {
    if (this.previousBodyOverflow === null) {
      return;
    }
    this.document.documentElement.style.overflow = this.previousHtmlOverflow ?? '';
    this.document.body.style.overflow = this.previousBodyOverflow ?? '';
    this.previousHtmlOverflow = null;
    this.previousBodyOverflow = null;
  }

  step(delta: number): void {
    const current = this.viewerIndex();
    if (current === null) {
      return;
    }
    const next = current + delta;
    if (next >= 0 && next < this.items().length) {
      this.viewerIndex.set(next);
      this.confirmingDelete.set(false);
    }
  }

  get viewerItem(): MediaItemResponse | null {
    const index = this.viewerIndex();
    return index === null ? null : (this.items()[index] ?? null);
  }

  /** Il pulsante di cancellazione compare solo sui contenuti caricati da questo stesso invitato. */
  isMine(item: MediaItemResponse): boolean {
    return !!this.session.id && item.guestId === this.session.id;
  }

  askDelete(): void {
    this.confirmingDelete.set(true);
  }

  cancelDelete(): void {
    this.confirmingDelete.set(false);
  }

  deleteCurrent(): void {
    const item = this.viewerItem;
    if (!item || this.deleting()) {
      return;
    }
    this.deleting.set(true);
    this.api.deleteMedia(item.id).subscribe({
      next: () => {
        this.items.update((current) => current.filter((i) => i.id !== item.id));
        this.deleting.set(false);
        this.confirmingDelete.set(false);
        this.closeViewer();
      },
      error: () => {
        this.deleting.set(false);
        this.confirmingDelete.set(false);
      },
    });
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
