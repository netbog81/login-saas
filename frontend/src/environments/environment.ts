// Rileva automaticamente l'URL del backend
// Gestisce localhost, LAN e domini personalizzati (Traefik)
function getApiUrl(): string {
  const w = window as any;
  const hostname = window.location.hostname;

  // Override manuale (puoi impostarlo da index.html con window.__API_URL__)
  if (w && typeof w.__API_URL__ === 'string' && w.__API_URL__) {
    return w.__API_URL__;
  }

  // 1. Sviluppo locale
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:3000';
  }

  // 2. IP della LAN (192.168.x.x o 10.x.x.x)
  if (/^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(hostname)) {
    return `http://${hostname}:3000`;
  }

  // 3. Tutti i tenant usano lo stesso backend API
  // Il tenant viene identificato dal JWT, non dall'hostname dell'API
  return 'https://api.curandis.cloud';
}

export const environment = {
  production: false,
  apiUrl: getApiUrl(),
  // Keycloak OIDC
  keycloakUrl: 'https://my.curandis.cloud',
  keycloakRealm: 'curandis',
  keycloakClientId: 'curandis-app-angular',
  // In development, specifica il tenant di default (es: 'demo4')
  defaultTenant: 'demo4',
};
