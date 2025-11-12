// Rileva automaticamente l'URL del backend
// Gestisce localhost, LAN e domini personalizzati (Traefik)
function getApiUrl(): string {
  const hostname = window.location.hostname;
  const protocol = window.location.protocol; // http: o https:

  // 1. Sviluppo locale
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:3000';
  }

  // 2. IP della LAN (192.168.x.x o 10.x.x.x)
  if (/^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(hostname)) {
    return `http://${hostname}:3000`;
  }

  // 3. Dominio personalizzato (es: agenda.curandis.cloud via Traefik)
  // Aggiunge api. all'inizio (richiede DNS record per api.agenda.curandis.cloud)
  const apiDomain = `api.${hostname}`;
  return `${protocol}//${apiDomain}`;
}

export const environment = {
  production: false,
  apiUrl: getApiUrl()
};
