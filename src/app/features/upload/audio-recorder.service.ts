import { Injectable, signal } from '@angular/core';

/**
 * Registrazione audio dal browser con MediaRecorder. Il Blob prodotto viene poi
 * allegato al FormData dell'upload come un file normale (vedi Upload).
 */
@Injectable()
export class AudioRecorderService {

  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private stream: MediaStream | null = null;

  readonly recording = signal(false);
  readonly elapsedSeconds = signal(0);
  private timer: ReturnType<typeof setInterval> | null = null;

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.chunks = [];
    this.mediaRecorder = new MediaRecorder(this.stream);
    this.mediaRecorder.ondataavailable = event => {
      if (event.data.size > 0) {
        this.chunks.push(event.data);
      }
    };
    this.mediaRecorder.start();
    this.recording.set(true);
    this.elapsedSeconds.set(0);
    this.timer = setInterval(() => this.elapsedSeconds.update(s => s + 1), 1000);
  }

  stop(): Promise<File> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('Nessuna registrazione in corso'));
        return;
      }
      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: 'audio/webm' });
        const file = new File([blob], `messaggio-audio-${Date.now()}.webm`, { type: 'audio/webm' });
        this.cleanup();
        resolve(file);
      };
      this.mediaRecorder.stop();
    });
  }

  cancel(): void {
    this.mediaRecorder?.stop();
    this.cleanup();
  }

  private cleanup(): void {
    this.stream?.getTracks().forEach(track => track.stop());
    this.stream = null;
    this.mediaRecorder = null;
    this.recording.set(false);
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
