#!/bin/sh
set -e

# Rigenera env.js con l'URL del backend preso dalla variabile d'ambiente Railway.
# Se API_BASE_URL non e' impostata, il frontend proverebbe a chiamare se stesso: meglio
# fallire in modo rumoroso nei log che servire un sito silenziosamente rotto.
if [ -z "$API_BASE_URL" ]; then
  echo "ATTENZIONE: variabile d'ambiente API_BASE_URL non impostata." >&2
  echo "Il frontend verra' avviato ma le chiamate alle API falliranno." >&2
fi

cat > /usr/share/nginx/html/env.js << EOJS
window.__env = {
  apiBaseUrl: "${API_BASE_URL:-http://localhost:8080/api}"
};
EOJS

exec "$@"
