import { Component, DOCUMENT, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { GalleryApiService } from '../../core/gallery-api.service';
import { GuestSessionService } from '../../core/guest-session.service';
import { ToastService } from '../../core/toast.service';
import { MediaItemResponse } from '../../core/models/media-item';
import { MediaType } from '../../core/models/media-type';

const PAGE_SIZE = 24;

/** Tipi mostrati in galleria con il filtro "Tutti": gli audio stanno nella sezione Voci. */
const GALLERY_TYPES: MediaType[] = ['PHOTO', 'VIDEO'];

/** Deve restare allineato a MAX_SELECTION nel MediaController: il vincolo e' la lunghezza dell'URL. */
const MAX_SELECTION = 50;

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
  private readonly toast = inject(ToastService);
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
  readonly selectionMode = signal(false);
  readonly selection = signal<string[]>([]);

  /** Posizione della galleria al momento dell'apertura, da ripristinare alla chiusura. */
  private lockedScrollY: number | null = null;

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
    this.selection.set([]);
    this.loadFirstPage();
  }

  loadFirstPage(): void {
    this.loading.set(true);
    this.page.set(0);
    this.api.listMedia(0, PAGE_SIZE, this.filterType(), this.typesFilter()).subscribe({
      next: (result) => {
        this.items.set(result.content);
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
    this.api.listMedia(nextPage, PAGE_SIZE, this.filterType(), this.typesFilter()).subscribe({
      next: (result) => {
        this.items.update((current) => [...current, ...result.content]);
        this.page.set(nextPage);
        this.hasMore.set(!result.last);
        this.loadingMore.set(false);
      },
      error: () => this.loadingMore.set(false),
    });
  }

  /** In modalita' selezione il tocco sulla tile spunta il contenuto invece di aprirlo. */
  onTileClick(index: number): void {
    if (this.selectionMode()) {
      this.toggleSelection(this.items()[index].id);
      return;
    }
    this.openViewer(index);
  }

  toggleSelectionMode(): void {
    const next = !this.selectionMode();
    this.selectionMode.set(next);
    if (!next) {
      this.selection.set([]);
    }
  }

  isSelected(id: string): boolean {
    return this.selection().includes(id);
  }

  toggleSelection(id: string): void {
    const current = this.selection();
    if (current.includes(id)) {
      this.selection.set(current.filter((selected) => selected !== id));
      return;
    }
    if (current.length >= MAX_SELECTION) {
      this.toast.show(`Puoi scaricarne al massimo ${MAX_SELECTION} per volta.`);
      return;
    }
    this.selection.set([...current, id]);
  }

  /**
   * Il download parte come navigazione verso l'URL dello ZIP: il browser lo tratta come
   * un file da salvare (Content-Disposition: attachment) e la pagina resta dov'e'.
   * Subito dopo la selezione viene svuotata e la galleria torna normale: lasciare i
   * contenuti ancora spuntati farebbe credere che ci sia altro da scaricare.
   */
  downloadSelection(): void {
    const ids = this.selection();
    if (ids.length === 0) {
      return;
    }
    this.toast.show('Preparo il file da scaricare…');
    this.document.defaultView?.location.assign(this.api.archiveUrl(ids));
    this.selection.set([]);
    this.selectionMode.set(false);
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
   * Il solo overflow: hidden non basta sui browser mobili: il trascinamento
   * arriva comunque al documento e la galleria continua a scorrere dietro la
   * foto, spuntando in fondo allo schermo quando la barra degli indirizzi si
   * ritrae. Qui il body viene tolto dal flusso (position: fixed) e traslato di
   * -scrollY: la pagina non ha piu' nulla da scorrere. La posizione viene
   * salvata e ripristinata a mano alla chiusura, cosi' si torna esattamente al
   * punto della griglia in cui si era.
   */
  private lockScroll(): void {
    if (this.lockedScrollY !== null) {
      return;
    }
    const body = this.document.body;
    this.lockedScrollY = this.document.defaultView?.scrollY ?? 0;
    body.style.position = 'fixed';
    body.style.top = `-${this.lockedScrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    body.style.overflow = 'hidden';
  }

  private unlockScroll(): void {
    if (this.lockedScrollY === null) {
      return;
    }
    const body = this.document.body;
    body.style.position = '';
    body.style.top = '';
    body.style.left = '';
    body.style.right = '';
    body.style.width = '';
    body.style.overflow = '';
    this.document.defaultView?.scrollTo(0, this.lockedScrollY);
    this.lockedScrollY = null;
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
        this.selection.update((current) => current.filter((id) => id !== item.id));
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

  /**
   * Con un filtro attivo basta "type"; con "Tutti" si chiedono esplicitamente foto e
   * video, altrimenti il backend restituirebbe anche gli audio.
   */
  private typesFilter(): MediaType[] | null {
    return this.filterType() ? null : GALLERY_TYPES;
  }
}
