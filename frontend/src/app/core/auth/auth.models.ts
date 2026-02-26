/**
 * Risposta dell'endpoint GET /api/me del backend.
 * Contiene schemaName e tenantStatus risolti da OpenBao.
 */
export interface UserMeResponse {
  userId: string;
  email: string;
  name: string;
  orgId: string;
  schemaName: string;
  tenantStatus: 'active' | 'pending_schema' | 'suspended' | 'deleted';
  roles: string[];
}

/**
 * Informazioni utente nel segnale corrente dell'applicazione.
 * Popolato da OidcAuthService dopo il callback Keycloak + GET /api/me.
 */
export interface UserInfo {
  userId: string;
  email: string;
  name: string;
  roles: string[];
  tenantId: string;   // alias del tenant (subdomain)
  orgId: string;      // organization ID Keycloak
  schemaName: string; // risolto da OpenBao via backend
  /** Stato schema: active | pending_schema | suspended | deleted */
  tenantStatus: string;
}
