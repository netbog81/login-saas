// Rileva automaticamente l'URL del backend in produzione
// Gestisce localhost, LAN e domini personalizzati (Traefik)
function getApiUrl(): string {
  const hostname = window.location.hostname;
  const protocol = window.location.protocol; // http: o https:

  console.log('🔍 Frontend hostname detected:', hostname);
  console.log('🔍 Frontend protocol:', protocol);

  // 1. Sviluppo locale
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    const apiUrl = 'http://localhost:3000';
    console.log('✅ Using localhost backend:', apiUrl);
    return apiUrl;
  }

  // 2. IP della LAN (192.168.x.x o 10.x.x.x)
  if (/^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(hostname)) {
    const apiUrl = `http://${hostname}:3000`;
    console.log('✅ Using LAN backend:', apiUrl);
    return apiUrl;
  }

  // 3. Dominio personalizzato (es: agenda.curandis.cloud via Traefik)
  // Aggiunge api. all'inizio (richiede DNS record per api.agenda.curandis.cloud)
  const apiDomain = `api.${hostname}`;
  const apiUrl = `${protocol}//${apiDomain}`;
  console.log('✅ Using domain backend:', apiUrl);
  console.log('⚠️  Assicurati che DNS e Traefik siano configurati per:', apiDomain);
  return apiUrl;
}

export const environment = {
  production: true,
  apiUrl: getApiUrl()
};
