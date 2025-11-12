// Rileva automaticamente l'URL del backend
// Se accedi da http://192.168.88.24:4200, userà http://192.168.88.24:3000
function getApiUrl(): string {
  // In sviluppo locale, usa localhost
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:3000';
  }

  // Altrimenti usa lo stesso host del frontend
  return `http://${window.location.hostname}:3000`;
}

export const environment = {
  production: false,
  apiUrl: getApiUrl()
};
