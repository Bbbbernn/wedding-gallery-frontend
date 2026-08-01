import { Component, ElementRef, inject, signal, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { GalleryApiService } from '../../core/gallery-api.service';
import { AudioRecorderService } from './audio-recorder.service';

interface SelectedFile {
  file: File;
  previewUrl: string | null;
}

/**
 * Upload di foto, video e audio. Gestione unica per tutti i tipi (il backend
 * distingue solo tramite content-type), piu' la possibilita' di registrare
 * un messaggio audio direttamente dal microfono del browser.
 */
@Component({
  selector: 'app-upload',
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule
  ],
  providers: [AudioRecorderService],
  templateUrl: './upload.html',
  styleUrl: './upload.scss'
})
export class Upload {

  private readonly api = inject(GalleryApiService);
  private readonly snackBar = inject(MatSnackBar);
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

  async startRecording(): Promise<void> {
    try {
      await this.recorder.start();
    } catch {
      this.snackBar.open('Impossibile accedere al microfono.', 'Chiudi', { duration: 4000 });
    }
  }

  async stopRecording(): Promise<void> {
    const file = await this.recorder.stop();
    this.addFiles([file]);
  }

  cancelRecording(): void {
    this.recorder.cancel();
  }

  submit(): void {
    if (!this.hasFiles || this.uploading()) {
      return;
    }
    this.uploading.set(true);
    const files = this.selectedFiles().map(f => f.file);

    this.api.upload(files, this.caption().trim() || undefined).subscribe({
      next: result => {
        this.uploading.set(false);
        if (result.failed.length > 0) {
          this.snackBar.open(
            `${result.uploaded.length} caricati, ${result.failed.length} falliti: ${result.failed[0].error}`,
            'Chiudi',
            { duration: 6000 }
          );
        } else {
          this.snackBar.open('Caricamento completato!', 'Chiudi', { duration: 3000 });
        }
        if (result.uploaded.length > 0) {
          this.clearSelection();
          this.router.navigate(['/galleria']);
        }
      },
      error: () => {
        this.uploading.set(false);
        this.snackBar.open('Caricamento fallito, riprova.', 'Chiudi', { duration: 4000 });
      }
    });
  }

  private addFiles(files: File[]): void {
    const additions: SelectedFile[] = files.map(file => ({
      file,
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null
    }));
    this.selectedFiles.update(current => [...current, ...additions]);
  }

  private clearSelection(): void {
    this.selectedFiles().forEach(f => {
      if (f.previewUrl) {
        URL.revokeObjectURL(f.previewUrl);
      }
    });
    this.selectedFiles.set([]);
    this.caption.set('');
  }
}
