import { Component, ElementRef, inject, signal, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { GalleryApiService } from '../../core/gallery-api.service';
import { ToastService } from '../../core/toast.service';
import { AudioRecorderService } from './audio-recorder.service';
import { VideoCompressorService } from './video-compressor.service';

interface SelectedFile {
  file: File;
  previewUrl: string | null;
}

/**
 * Quanti file al massimo in un singolo invio. Tenuto basso di proposito: se la rete
 * cade, si perde solo il lotto in corso e non tutta la selezione.
 */
const MAX_FILES_PER_BATCH = 8;

/** Peso massimo di un singolo invio. Un file piu' grande di cosi' parte da solo. */
const MAX_BATCH_BYTES = 40 * 1024 * 1024;

/**
 * Upload di foto, video e audio (il backend distingue dal content-type),
 * piu' la registrazione di un messaggio vocale dal microfono del browser.
 *
 * I file non partono tutti in una POST sola: vengono divisi in lotti piccoli e
 * inviati in sequenza. All'invitato non cambia niente (puo' selezionare quanti
 * file vuole), ma un'interruzione di rete a meta' non fa piu' perdere l'intero
 * caricamento: i lotti gia' arrivati restano salvati e nella selezione rimangono
 * solo i file da riprovare.
 */
@Component({
  selector: 'app-upload',
  imports: [FormsModule],
  providers: [AudioRecorderService, VideoCompressorService],
  templateUrl: './upload.html',
  styleUrl: './upload.scss',
})
export class Upload {
  private readonly api = inject(GalleryApiService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  readonly recorder = inject(AudioRecorderService);
  readonly compressor = inject(VideoCompressorService);

  @ViewChild('fileInput') fileInput?: ElementRef<HTMLInputElement>;

  readonly selectedFiles = signal<SelectedFile[]>([]);
  readonly caption = signal('');
  readonly uploading = signal(false);
  readonly preparing = signal(false);

  /** Avanzamento dei lotti, per l'etichetta del pulsante ("Invio 2 di 5…"). */
  readonly batchTotal = signal(0);
  readonly batchDone = signal(0);

  get hasFiles(): boolean {
    return this.selectedFiles().length > 0;
  }

  onFilesPicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files) {
      return;
    }
    this.addFiles(Array.from(input.files));
    input.value = '';
  }

  removeFile(index: number): void {
    const current = this.selectedFiles();
    const removed = current[index];
    if (removed.previewUrl) {
      URL.revokeObjectURL(removed.previewUrl);
    }
    this.selectedFiles.set(current.filter((_, i) => i !== index));
  }

  isAudio(item: SelectedFile): boolean {
    return item.file.type.startsWith('audio/');
  }

  /** Testo del pulsante di invio: mostra a che punto siamo quando i lotti sono piu' di uno. */
  uploadLabel(): string {
    if (this.preparing()) {
      return 'Preparazione…';
    }
    if (!this.uploading()) {
      return `Carica ${this.selectedFiles().length} file`;
    }
    const total = this.batchTotal();
    return total > 1 ? `Invio ${this.batchDone() + 1} di ${total}…` : 'Caricamento…';
  }

  async startRecording(): Promise<void> {
    try {
      await this.recorder.start();
    } catch {
      this.toast.show('Impossibile accedere al microfono.');
    }
  }

  async stopRecording(): Promise<void> {
    const file = await this.recorder.stop();
    this.addFiles([file]);
  }

  cancelRecording(): void {
    this.recorder.cancel();
  }

  elapsedLabel(): string {
    const seconds = this.recorder.elapsedSeconds();
    const mm = Math.floor(seconds / 60)
      .toString()
      .padStart(2, '0');
    const ss = (seconds % 60).toString().padStart(2, '0');
    return `${mm}:${ss}`;
  }

  /**
   * Prima di caricare, i video pesanti vengono ricompressi sul telefono (vedi
   * VideoCompressorService). I file non video, o quelli per cui la compressione non
   * e' possibile, proseguono invariati: l'upload non viene mai bloccato da questo passo.
   * Poi si invia lotto per lotto, aspettando ogni volta la risposta del backend.
   */
  async submit(): Promise<void> {
    if (!this.hasFiles || this.uploading() || this.preparing()) {
      return;
    }

    const originals = this.selectedFiles();

    this.preparing.set(true);
    const files: File[] = [];
    for (const selected of originals) {
      const result = await this.compressor.compress(selected.file);
      files.push(result.file);
    }
    this.preparing.set(false);

    const batches = this.buildBatches(files);
    const caption = this.caption().trim() || undefined;

    this.uploading.set(true);
    this.batchTotal.set(batches.length);
    this.batchDone.set(0);

    let uploadedCount = 0;
    const failedIndexes: number[] = [];
    let firstError: string | null = null;

    for (const batch of batches) {
      try {
        const result = await firstValueFrom(
          this.api.upload(
            batch.map((i) => files[i]),
            caption,
          ),
        );
        uploadedCount += result.uploaded.length;
        for (const failure of result.failed) {
          const index = this.matchFailure(batch, files, failure.filename, failedIndexes);
          if (index !== null) {
            failedIndexes.push(index);
          }
          firstError ??= failure.error;
        }
      } catch {
        // Lotto non arrivato (rete, timeout, server): i file restano da riprovare,
        // ma si prosegue comunque con i lotti successivi.
        failedIndexes.push(...batch);
        firstError ??= 'invio non riuscito';
      }
      this.batchDone.update((done) => done + 1);
    }

    this.uploading.set(false);
    this.batchTotal.set(0);
    this.batchDone.set(0);

    this.finish(originals, files, uploadedCount, failedIndexes, firstError);
  }

  /** Esito finale: cosa mostrare e cosa lasciare selezionato. */
  private finish(
    originals: SelectedFile[],
    files: File[],
    uploadedCount: number,
    failedIndexes: number[],
    firstError: string | null,
  ): void {
    if (failedIndexes.length === 0) {
      this.toast.show('Grazie! Il tuo ricordo è nella galleria.');
      const onlyAudio = files.every((file) => file.type.startsWith('audio/'));
      this.clearSelection();
      this.router.navigate([onlyAudio ? '/voci' : '/galleria']);
      return;
    }

    if (uploadedCount === 0) {
      this.toast.show('Caricamento non riuscito, riprova.', 6000);
    } else {
      this.toast.show(
        `${uploadedCount} caricati, ${failedIndexes.length} da riprovare: ${firstError}`,
        6000,
      );
    }
    this.keepOnly(originals, failedIndexes);
  }

  /**
   * Divide i file in lotti: si chiude il lotto quando si raggiungono
   * MAX_FILES_PER_BATCH file oppure MAX_BATCH_BYTES complessivi. Un file da solo
   * piu' grande della soglia forma un lotto tutto suo (il limite per singolo file
   * resta quello del backend, qui non si scarta mai niente).
   */
  private buildBatches(files: File[]): number[][] {
    const batches: number[][] = [];
    let current: number[] = [];
    let currentBytes = 0;

    files.forEach((file, index) => {
      const wouldExceed = current.length > 0 && currentBytes + file.size > MAX_BATCH_BYTES;
      if (current.length >= MAX_FILES_PER_BATCH || wouldExceed) {
        batches.push(current);
        current = [];
        currentBytes = 0;
      }
      current.push(index);
      currentBytes += file.size;
    });

    if (current.length > 0) {
      batches.push(current);
    }
    return batches;
  }

  /**
   * Il backend segnala i fallimenti per nome file: qui si risale all'indice, saltando
   * quelli gia' contati (due file possono chiamarsi allo stesso modo).
   */
  private matchFailure(
    batch: number[],
    files: File[],
    filename: string,
    alreadyFailed: number[],
  ): number | null {
    return (
      batch.find((i) => files[i].name === filename && !alreadyFailed.includes(i)) ??
      batch.find((i) => !alreadyFailed.includes(i)) ??
      null
    );
  }

  /** Tiene selezionati solo i file da riprovare, liberando le anteprime degli altri. */
  private keepOnly(originals: SelectedFile[], indexes: number[]): void {
    const keep = new Set(indexes);
    originals.forEach((item, index) => {
      if (!keep.has(index) && item.previewUrl) {
        URL.revokeObjectURL(item.previewUrl);
      }
    });
    this.selectedFiles.set(originals.filter((_, index) => keep.has(index)));
  }

  private addFiles(files: File[]): void {
    const additions: SelectedFile[] = files.map((file) => ({
      file,
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
    }));
    this.selectedFiles.update((current) => [...current, ...additions]);
  }

  private clearSelection(): void {
    this.selectedFiles().forEach((f) => {
      if (f.previewUrl) {
        URL.revokeObjectURL(f.previewUrl);
      }
    });
    this.selectedFiles.set([]);
    this.caption.set('');
  }
}
