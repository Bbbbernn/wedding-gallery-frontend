import { Injectable, signal } from '@angular/core';

/**
 * Comprime i video sul telefono PRIMA dell'upload, in stile messaggistica:
 * ridimensionamento a 720p e ricodifica H.264/AAC dentro un MP4.
 *
 * Come funziona: il video viene riprodotto in un <video> nascosto, ogni fotogramma
 * viene ridisegnato su un <canvas> piu' piccolo e il flusso del canvas (piu' l'audio
 * prelevato con WebAudio) viene registrato da MediaRecorder. Il vantaggio rispetto a
 * WebCodecs e' che la decodifica la fa il browser: qualunque formato il telefono sappia
 * leggere (compreso l'HEVC dell'iPhone) esce come MP4 H.264 leggibile da tutti.
 *
 * REGOLA IMPORTANTE: se per qualsiasi motivo la compressione non e' possibile o non
 * conviene, si carica il file ORIGINALE. Non si perde mai un ricordo per colpa di
 * un'ottimizzazione.
 */

/** Esito della compressione: `file` e' pronto da caricare in ogni caso. */
export interface CompressionResult {
  file: File;
  compressed: boolean;
  originalSize: number;
}

/** Sotto questa soglia il video e' gia' leggero: si carica com'e'. */
const MIN_SIZE_BYTES = 12 * 1024 * 1024;

/** Oltre questa durata la ricodifica (che avviene in tempo reale) diventa troppo lunga. */
const MAX_DURATION_SECONDS = 300;

const TARGET_HEIGHT = 720;
const TARGET_BITRATE = 2_500_000;
const AUDIO_BITRATE = 128_000;
const FPS = 30;

/** MP4/H.264 e' l'unico output che si riproduce ovunque, iPhone compresi. */
const MP4_TYPES = [
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
  'video/mp4;codecs=avc1,mp4a.40.2',
  'video/mp4;codecs=h264,aac',
  'video/mp4',
];

@Injectable()
export class VideoCompressorService {
  /** Nome del file in lavorazione, per mostrarlo nell'interfaccia. */
  readonly currentFile = signal<string | null>(null);
  /** Avanzamento 0-100 del file in lavorazione. */
  readonly progress = signal(0);

  /**
   * Vero se il browser sa produrre MP4 con MediaRecorder. Se e' falso non si comprime
   * affatto: un WebM sarebbe piu' leggero ma non si vedrebbe sugli iPhone, cioe' peggio
   * del problema che stiamo risolvendo.
   */
  isSupported(): boolean {
    return (
      typeof MediaRecorder !== 'undefined' &&
      typeof HTMLCanvasElement.prototype.captureStream === 'function' &&
      this.pickMimeType() !== null
    );
  }

  /** Comprime se ha senso farlo, altrimenti restituisce il file originale. */
  async compress(file: File): Promise<CompressionResult> {
    const unchanged: CompressionResult = { file, compressed: false, originalSize: file.size };

    if (!file.type.startsWith('video/') || file.size < MIN_SIZE_BYTES || !this.isSupported()) {
      return unchanged;
    }

    this.currentFile.set(file.name);
    this.progress.set(0);
    try {
      const compressed = await this.transcode(file);
      // Se la ricodifica non ha guadagnato nulla (video gia' ottimizzato), si tiene l'originale.
      return compressed && compressed.size < file.size * 0.9
        ? { file: compressed, compressed: true, originalSize: file.size }
        : unchanged;
    } catch {
      return unchanged;
    } finally {
      this.currentFile.set(null);
      this.progress.set(0);
    }
  }

  // ---------------- interno ----------------

  private pickMimeType(): string | null {
    return MP4_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) ?? null;
  }

  private transcode(file: File): Promise<File | null> {
    return new Promise<File | null>((resolve, reject) => {
      const mimeType = this.pickMimeType();
      if (!mimeType) {
        resolve(null);
        return;
      }

      const objectUrl = URL.createObjectURL(file);
      const video = document.createElement('video');
      video.src = objectUrl;
      video.playsInline = true;
      video.preload = 'auto';
      video.crossOrigin = 'anonymous';

      let audioContext: AudioContext | null = null;
      let recorder: MediaRecorder | null = null;
      let frameHandle: number | null = null;
      let settled = false;

      const cleanup = () => {
        if (frameHandle !== null) {
          cancelAnimationFrame(frameHandle);
        }
        video.pause();
        video.removeAttribute('src');
        video.load();
        URL.revokeObjectURL(objectUrl);
        audioContext?.close().catch(() => undefined);
      };

      const fail = (error: unknown) => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        reject(error);
      };

      const succeed = (result: File | null) => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        resolve(result);
      };

      video.onerror = () => fail(new Error('Video non leggibile dal browser'));

      video.onloadedmetadata = () => {
        const duration = video.duration;
        if (!isFinite(duration) || duration <= 0 || duration > MAX_DURATION_SECONDS) {
          succeed(null);
          return;
        }

        const { width, height } = this.targetSize(video.videoWidth, video.videoHeight);
        if (width === 0 || height === 0) {
          succeed(null);
          return;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d', { alpha: false });
        if (!context) {
          succeed(null);
          return;
        }

        const stream = canvas.captureStream(FPS);

        // L'audio si preleva con WebAudio invece che da video.captureStream(): cosi' la
        // traccia esiste anche se l'elemento e' silenziato, e non esce suono dal telefono
        // durante la ricodifica (non colleghiamo mai il grafo a audioContext.destination).
        try {
          audioContext = new AudioContext();
          const source = audioContext.createMediaElementSource(video);
          const destination = audioContext.createMediaStreamDestination();
          source.connect(destination);
          destination.stream.getAudioTracks().forEach((track) => stream.addTrack(track));
        } catch {
          // Video muto o audio non prelevabile: si prosegue con il solo video.
        }

        const chunks: Blob[] = [];
        try {
          recorder = new MediaRecorder(stream, {
            mimeType,
            videoBitsPerSecond: TARGET_BITRATE,
            audioBitsPerSecond: AUDIO_BITRATE,
          });
        } catch (error) {
          fail(error);
          return;
        }

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunks.push(event.data);
          }
        };
        recorder.onerror = (event) => fail(event);
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'video/mp4' });
          succeed(new File([blob], this.mp4Name(file.name), { type: 'video/mp4' }));
        };

        const drawFrame = () => {
          context.drawImage(video, 0, 0, width, height);
          this.progress.set(Math.min(99, Math.round((video.currentTime / duration) * 100)));
          frameHandle = requestAnimationFrame(drawFrame);
        };

        video.onended = () => {
          if (frameHandle !== null) {
            cancelAnimationFrame(frameHandle);
            frameHandle = null;
          }
          recorder?.state === 'recording' && recorder.stop();
        };

        recorder.start(1000);
        video
          .play()
          .then(() => drawFrame())
          .catch((error) => fail(error));
      };
    });
  }

  /** Riduce il lato corto a 720p mantenendo le proporzioni; dimensioni sempre pari (H.264). */
  private targetSize(sourceWidth: number, sourceHeight: number): { width: number; height: number } {
    if (!sourceWidth || !sourceHeight) {
      return { width: 0, height: 0 };
    }
    const shortSide = Math.min(sourceWidth, sourceHeight);
    const scale = shortSide > TARGET_HEIGHT ? TARGET_HEIGHT / shortSide : 1;
    const even = (value: number) => Math.max(2, Math.round((value * scale) / 2) * 2);
    return { width: even(sourceWidth), height: even(sourceHeight) };
  }

  private mp4Name(original: string): string {
    const dot = original.lastIndexOf('.');
    const base = dot > 0 ? original.substring(0, dot) : original;
    return `${base}.mp4`;
  }
}
