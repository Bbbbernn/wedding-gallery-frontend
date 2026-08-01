// Placeholder per lo sviluppo locale. In produzione (Docker/Railway) questo file
// viene rigenerato all'avvio del container da docker-entrypoint.sh, con l'URL
// del backend preso dalla variabile d'ambiente API_BASE_URL.
window.__env = {
  apiBaseUrl: 'http://localhost:8080/api'
};
