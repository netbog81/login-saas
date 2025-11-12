// Rileva automaticamente l'URL del backend in produzione
function getApiUrl(): string {
  // Usa sempre lo stesso host del frontend
  const protocol = window.location.protocol; // http: o https:
  const hostname = window.location.hostname;
  return `${protocol}//${hostname}:3000`;
}

export const environment = {
  production: true,
  apiUrl: getApiUrl()
};
