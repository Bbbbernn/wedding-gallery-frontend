export interface GuestSignRequest {
  displayName: string;
  message?: string;
}

/** Restituito una sola volta alla firma: contiene il token da salvare in localStorage. */
export interface GuestRegisteredResponse {
  id: string;
  displayName: string;
  message: string | null;
  token: string;
  createdAt: string;
}

/** Vista pubblica di un invitato (libro firme), senza token. */
export interface GuestResponse {
  id: string;
  displayName: string;
  message: string | null;
  createdAt: string;
  uploadCount: number;
}
