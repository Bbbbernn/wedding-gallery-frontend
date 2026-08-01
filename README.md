# Wedding Gallery — frontend

Frontend Angular 21 (standalone components, Angular Material) per la galleria condivisa
del matrimonio. Si appoggia al backend Spring Boot (`wedding-gallery`).

## Avvio in locale

1. Assicurati che il backend sia in esecuzione su `http://localhost:8080`
   (vedi il README del progetto backend).
2. Installa le dipendenze:
   ```bash
   npm install
   ```
3. Avvia il dev server:
   ```bash
   ng serve
   ```
4. Apri `http://localhost:4200`.

L'URL del backend è configurato in `src/app/core/environment.ts`. Prima del deploy
su Railway, sostituisci `apiBaseUrl` con l'URL pubblico del backend.

## Struttura

```
src/app/
  core/                    servizi condivisi
    environment.ts          configurazione (URL API)
    guest-session.service.ts  gestione del token "firma" in localStorage
    gallery-api.service.ts    chiamate HTTP verso il backend
    guest-token.interceptor.ts  aggiunge X-Guest-Token alle richieste
    signed-guard.ts          blocca le rotte finché non ci si è firmati
    models/                  interfacce TypeScript (rispecchiano i DTO backend)
  features/
    sign/                    pagina di firma (nome + messaggio facoltativo)
    gallery/                 galleria condivisa, filtro per tipo, paginazione
    upload/                  upload multiplo + registrazione audio dal browser
```

## Pagine

- `/firma` — firma dell'invitato, salva il token in `localStorage`
- `/galleria` — galleria di tutti i contributi (richiede la firma)
- `/carica` — upload di foto/video, o registrazione di un messaggio audio (richiede la firma)

## Registrazione audio

Usa l'API `MediaRecorder` del browser (richiede HTTPS in produzione, salvo `localhost`
in sviluppo). Il file generato è in formato `audio/webm`, già supportato dal backend.

## Prossimi passi

- Pagina di amministrazione (moderazione, download ZIP completo)
- Build e deploy su Railway come servizio statico (o servito dal backend stesso)
