/**
 * Configurazione dell'ambiente. L'URL dell'API viene letto a runtime da /assets/env.js
 * (generato dal container Docker all'avvio, vedi docker-entrypoint.sh), cosi' si puo'
 * cambiare backend senza ricompilare il frontend. In sviluppo (ng serve) il file
 * /assets/env.js non esiste: si ripiega sul default qui sotto.
 */
declare global {
  interface Window {
    __env?: { apiBaseUrl?: string };
  }
}

function resolveApiBaseUrl(): string {
  const injected = (window as any).__env?.apiBaseUrl;
  return injected && injected.trim().length > 0 ? injected : 'http://localhost:8080/api';
}

export const environment = {
  production: false,
  apiBaseUrl: resolveApiBaseUrl()
};
