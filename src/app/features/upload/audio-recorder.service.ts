import { Injectable, signal } from '@angular/core';

/**
 * Registrazione audio dal browser con MediaRecorder. Il Blob prodotto viene poi
 * allegato al FormData dell'upload come un file normale (vedi Upload).
 *
 * Il formato NON e' fissato a mano: si chiede al browser quale sa produrre
 * (Safari/iOS fa MP4, Chrome/Firefox fanno WebM/Opus) e si etichetta il file
 * con il mimeType realmente usato dal MediaRecorder. Etichettare tutto come
 * audio/webm faceva salvare al backend un content-type non corrispondente al
 * file, e i vocali registrati da iPhone non si riproducevano su Android
 * (e viceversa).
 */
@Injectable()
export class AudioRecorderService {
  /** In ordine di preferenza: il primo supportato dal browser vince. */
  private static readonly CANDIDATE_TYPES = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4;codecs=mp4a.40.2',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ];

  /** Estensione da usare in base al tipo base del file prodotto. */
  private static readonly EXTENSIONS: Record<string, string> = {
    'audio/webm': 'webm',
    'audio/mp4': 'm4a',
    'audio/ogg': 'ogg',
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
    'audio/aac': 'aac',
  };

  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private stream: MediaStream | null = null;

  readonly recording = signal(false);
  readonly elapsedSeconds = signal(0);
  private timer: ReturnType<typeof setInterval> | null = null;

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.chunks = [];

    const preferred = this.pickMimeType();
    // Senza mimeType supportato si lascia decidere il browser: quello che esce
    // lo leggiamo comunque da mediaRecorder.mimeType allo stop.
    this.mediaRecorder = preferred
      ? new MediaRecorder(this.stream, { mimeType: preferred })
      : new MediaRecorder(this.stream);

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.chunks.push(event.data);
      }
    };
    this.mediaRecorder.start();
    this.recording.set(true);
    this.elapsedSeconds.set(0);
    this.timer = setInterval(() => this.elapsedSeconds.update((s) => s + 1), 1000);
  }

  stop(): Promise<File> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('Nessuna registrazione in corso'));
        return;
      }
      const recorder = this.mediaRecorder;
      recorder.onstop = () => {
        const type = this.resolveType(recorder);
        const extension = AudioRecorderService.EXTENSIONS[type] ?? 'webm';
        const blob = new Blob(this.chunks, { type });
        const file = new File([blob], `messaggio-audio-${Date.now()}.${extension}`, { type });
        this.cleanup();
        resolve(file);
      };
      recorder.stop();
    });
  }

  cancel(): void {
    this.mediaRecorder?.stop();
    this.cleanup();
  }

  /** Primo formato della lista che il browser dichiara di saper registrare. */
  private pickMimeType(): string | null {
    if (
      typeof MediaRecorder === 'undefined' ||
      typeof MediaRecorder.isTypeSupported !== 'function'
    ) {
      return null;
    }
    return (
      AudioRecorderService.CANDIDATE_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) ??
      null
    );
  }

  /**
   * Tipo base (senza i parametri "codecs=...") realmente prodotto dal recorder.
   * Alcuni browser restituiscono mimeType vuoto: in quel caso si guarda il primo
   * chunk, e solo come ultima spiaggia si torna ad audio/webm.
   */
  private resolveType(recorder: MediaRecorder): string {
    const raw = recorder.mimeType || this.chunks[0]?.type || 'audio/webm';
    const base = raw.split(';')[0].trim().toLowerCase();
    return base.startsWith('audio/') ? base : 'audio/webm';
  }

  private cleanup(): void {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.mediaRecorder = null;
    this.recording.set(false);
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
