// Rileva automaticamente l'URL del backend in produzione
function getApiUrl(): string {
  const w = window as any;
  const hostname = window.location.hostname;

  // Override manuale per scenari particolari di deploy
  if (w && typeof w.__API_URL__ === 'string' && w.__API_URL__) {
    return w.__API_URL__;
  }

  // 1. Sviluppo locale
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:3000';
  }

  // 2. IP della LAN
  if (/^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(hostname)) {
    return `http://${hostname}:3000`;
  }

  // 3. Tutti i tenant usano lo stesso backend API
  // Il tenant viene identificato dal JWT, non dall'hostname dell'API
  return 'https://api.curandis.cloud';
}

export const environment = {
  production: true,
  apiUrl: getApiUrl(),
  // Keycloak OIDC
  keycloakUrl: 'https://my.curandis.cloud',
  keycloakRealm: 'curandis',
  keycloakClientId: 'curandis-app-angular',
  defaultTenant: null as string | null,
};
