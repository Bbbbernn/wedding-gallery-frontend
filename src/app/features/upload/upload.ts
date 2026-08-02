import { Component, ElementRef, inject, signal, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { GalleryApiService } from '../../core/gallery-api.service';
import { ToastService } from '../../core/toast.service';
import { AudioRecorderService } from './audio-recorder.service';

interface SelectedFile {
  file: File;
  previewUrl: string | null;
}

/**
 * Upload di foto, video e audio (il backend distingue dal content-type),
 * piu' la registrazione di un messaggio vocale dal microfono del browser.
 */
@Component({
  selector: 'app-upload',
  imports: [FormsModule],
  providers: [AudioRecorderService],
  templateUrl: './upload.html',
  styleUrl: './upload.scss',
})
export class Upload {
  private readonly api = inject(GalleryApiService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  readonly recorder = inject(AudioRecorderService);

  @ViewChild('fileInput') fileInput?: ElementRef<HTMLInputElement>;

  readonly selectedFiles = signal<SelectedFile[]>([]);
  readonly caption = signal('');
  readonly uploading = signal(false);

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

  submit(): void {
    if (!this.hasFiles || this.uploading()) {
      return;
    }
    this.uploading.set(true);
    const files = this.selectedFiles().map((f) => f.file);

    this.api.upload(files, this.caption().trim() || undefined).subscribe({
      next: (result) => {
        this.uploading.set(false);
        if (result.failed.length > 0) {
          this.toast.show(
            `${result.uploaded.length} caricati, ${result.failed.length} non riusciti: ${result.failed[0].error}`,
            6000,
          );
        } else {
          this.toast.show('Grazie! Il tuo ricordo è nella galleria.');
        }
        if (result.uploaded.length > 0) {
          const onlyAudio = files.every((file) => file.type.startsWith('audio/'));
          this.clearSelection();
          this.router.navigate([onlyAudio ? '/voci' : '/galleria']);
        }
      },
      error: () => {
        this.uploading.set(false);
        this.toast.show('Caricamento non riuscito, riprova.');
      },
    });
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
