// Rileva automaticamente l'URL del backend
// Gestisce localhost, LAN e domini personalizzati (Traefik)
function getApiUrl(): string {
  const w = window as any;
  const hostname = window.location.hostname;
  const protocol = window.location.protocol; // http: o https:

  // Override manuale (puoi impostarlo da index.html con window.__API_URL__)
  if (w && typeof w.__API_URL__ === 'string' && w.__API_URL__) {
    console.log('✅ Using forced API URL from window.__API_URL__:', w.__API_URL__);
    return w.__API_URL__;
  }

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
  // Trasforma agenda.curandis.cloud → apiagenda.curandis.cloud
  // Protezione: se l'app fosse servita per errore su un dominio già prefissato con "api",
  // evita duplicazioni tipo apiapiagenda.curandis.cloud
  const apiDomain = /^api/.test(hostname)
    ? hostname
    : hostname.replace(/^([^.]+)\./, 'api$1.');
  const apiUrl = `${protocol}//${apiDomain}`;
  console.log('✅ Using domain backend:', apiUrl);
  console.log('⚠️  Assicurati che DNS e Traefik siano configurati per:', apiDomain);
  return apiUrl;
}

export const environment = {
  production: false,
  apiUrl: getApiUrl()
};
