import { S3ConnectionConfig } from '@curandis/storage-core';
import { OpenbaoTokenProvider } from './openbao-token.provider';

/**
 * Risolve i parametri di connessione S3/MicroCeph del TENANT da OpenBao KV.
 *
 * Ordine di risoluzione:
 *  1. `kv/tenant-clinico-s3/<alias>` — credenziali PER TENANT (utente RGW
 *     dedicato, bucket di proprietà del tenant). Path speculare al pattern
 *     `kv/tenant-clinico-db/<alias>` già in uso per i DB.
 *  2. Fallback: `kv/clinico/s3` — secret di modulo (unico utente RGW).
 *     Utile in dev e durante il provisioning graduale dei tenant.
 *
 * Campi attesi (KV v2, identici in entrambi i path):
 *   endpoint    es. "http://10.x.x.x:80" (VM MicroCeph, rete privata)
 *   access_key  access key RGW
 *   secret_key  secret key RGW
 *   region      opzionale (default us-east-1, RGW la ignora)
 *
 * Chiamata lazy da storage-core alla prima operazione S3 del tenant e
 * ri-chiamata alla scadenza della cache client (rotazione credenziali).
 */
export async function readS3ConfigFromKv(
  tokenProvider: OpenbaoTokenProvider,
  tenantAlias: string,
): Promise<S3ConnectionConfig> {
  const token = tokenProvider.getToken();
  if (!token) {
    throw new Error('S3 config: OpenBao token not available');
  }

  const perTenant = await readKvSecret(token, `kv/data/tenant-clinico-s3/${tenantAlias}`);
  const data = perTenant ?? (await readKvSecret(token, 'kv/data/clinico/s3'));
  if (!data) {
    throw new Error(
      `S3 config: nessun secret trovato per il tenant "${tenantAlias}" ` +
        `(cercati kv/tenant-clinico-s3/${tenantAlias} e fallback kv/clinico/s3)`,
    );
  }
  if (!data['endpoint'] || !data['access_key'] || !data['secret_key']) {
    throw new Error(
      `S3 config (tenant "${tenantAlias}"): campi endpoint/access_key/secret_key mancanti`,
    );
  }

  return {
    endpoint: data['endpoint'],
    accessKeyId: data['access_key'],
    secretAccessKey: data['secret_key'],
    region: data['region'] || 'us-east-1',
    forcePathStyle: true,
  };
}

/** Legge un secret KV v2 via agent. Ritorna null se non esiste (404). */
async function readKvSecret(
  token: string,
  path: string,
): Promise<Record<string, string> | null> {
  const addr = (process.env.OPENBAO_ADDR || 'http://127.0.0.1:8200').replace(/\/$/, '');
  const resp = await fetch(`${addr}/v1/${path}`, {
    headers: { 'X-Vault-Token': token },
  });
  if (resp.status === 404) return null;
  if (!resp.ok) {
    throw new Error(`S3 config: read ${path} failed (HTTP ${resp.status})`);
  }
  const json = (await resp.json()) as { data?: { data?: Record<string, string> } };
  return json.data?.data ?? null;
}
