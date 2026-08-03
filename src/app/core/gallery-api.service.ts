import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from './environment';
import { GuestRegisteredResponse, GuestResponse, GuestSignRequest } from './models/guest';
import {
  MediaItemResponse,
  MediaStatsResponse,
  MediaUploadResponse,
  PageResponse,
} from './models/media-item';
import { MediaType } from './models/media-type';
import { GuestSessionService } from './guest-session.service';

/**
 * Un solo servizio per tutte le chiamate API pubbliche (firma + media),
 * cosi' come il backend espone un'unica gestione generica dei media.
 */
@Injectable({ providedIn: 'root' })
export class GalleryApiService {
  private readonly baseUrl = environment.apiBaseUrl;

  constructor(
    private readonly http: HttpClient,
    private readonly session: GuestSessionService,
  ) {}

  // ---------------- firma ----------------

  signGuest(request: GuestSignRequest): Observable<GuestRegisteredResponse> {
    return this.http.post<GuestRegisteredResponse>(`${this.baseUrl}/guests`, request);
  }

  /**
   * Verifica che il token salvato nel browser corrisponda ancora a un invitato reale.
   * L'header X-Guest-Token viene allegato automaticamente dall'interceptor.
   */
  me(): Observable<GuestResponse> {
    return this.http.get<GuestResponse>(`${this.baseUrl}/guests/me`);
  }

  // ---------------- galleria ----------------

  /**
   * "type" chiede un tipo solo, "types" ne ammette piu' d'uno (parametro ripetuto:
   * types=PHOTO&types=VIDEO). Serve alla galleria per escludere gli audio a monte,
   * cosi' e' il database a paginare gia' senza di loro.
   */
  listMedia(
    page: number,
    size: number,
    type?: MediaType | null,
    types?: MediaType[] | null,
  ): Observable<PageResponse<MediaItemResponse>> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (type) {
      params = params.set('type', type);
    }
    for (const value of types ?? []) {
      params = params.append('types', value);
    }
    return this.http.get<PageResponse<MediaItemResponse>>(`${this.baseUrl}/media`, { params });
  }

  stats(): Observable<MediaStatsResponse> {
    return this.http.get<MediaStatsResponse>(`${this.baseUrl}/media/stats`);
  }

  // ---------------- upload ----------------

  upload(files: File[], caption?: string): Observable<MediaUploadResponse> {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    if (caption) {
      formData.append('caption', caption);
    }
    const headers = new HttpHeaders(
      this.session.token ? { 'X-Guest-Token': this.session.token } : {},
    );
    return this.http.post<MediaUploadResponse>(`${this.baseUrl}/media`, formData, { headers });
  }

  /**
   * Cancella un proprio contenuto. Il backend verifica il possesso lato server
   * (403 se il file non appartiene all'invitato del token): qui non serve
   * ripetere quel controllo, solo mostrare l'azione ai file giusti (vedi Gallery).
   */
  deleteMedia(id: string): Observable<void> {
    const headers = new HttpHeaders(
      this.session.token ? { 'X-Guest-Token': this.session.token } : {},
    );
    return this.http.delete<void>(`${this.baseUrl}/media/${id}`, { headers });
  }

  // ---------------- URL diretti (img src, download, ecc.) ----------------

  contentUrl(relativeUrl: string): string {
    return this.absoluteUrl(relativeUrl);
  }

  private absoluteUrl(relativeUrl: string): string {
    // apiBaseUrl finisce con "/api": le contentUrl del backend iniziano gia' con "/api/...".
    const origin = this.baseUrl.replace(/\/api$/, '');
    return origin + relativeUrl;
  }
}
