import { OpenbaoTokenProvider } from './openbao-token.provider';

/**
 * Credenziali del client OAuth di Google, lette da OpenBao.
 *
 * Sono di MODULO, non per tenant: il progetto Google Cloud è uno solo per
 * tutta l'installazione Curandis, e i singoli studi non hanno credenziali
 * proprie. Stessa convenzione di `kv/clinico/s3` (segreto di modulo) contro
 * `kv/tenant-clinico-s3/<alias>` (per tenant).
 *
 *   kv/clinico/google-calendar
 *     client_id      ID client OAuth (tipo "Applicazione web")
 *     client_secret  segreto del client
 */

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
}

const KV_PATH = 'kv/data/clinico/google-calendar';

/** Cache breve: le credenziali non cambiano, ma un riavvio non deve dipendere da OpenBao. */
let cached: { config: GoogleOAuthConfig; at: number } | null = null;
const CACHE_TTL_MS = 10 * 60 * 1000;

export async function readGoogleOAuthConfig(
  tokenProvider: OpenbaoTokenProvider,
): Promise<GoogleOAuthConfig> {
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.config;

  const token = await tokenProvider.getToken();
  const data = await readKvSecret(token, KV_PATH);

  if (!data) {
    throw new Error(
      `Credenziali Google non trovate su OpenBao (${KV_PATH}). ` +
        'Creale con: bao kv put kv/clinico/google-calendar client_id="..." client_secret="..."',
    );
  }

  // Errore parlante sui nomi delle chiavi: un refuso qui si manifesterebbe
  // altrimenti solo al primo collegamento di un operatore, dopo il redirect
  // di Google, cioè nel punto più scomodo per capirci qualcosa.
  const missing = ['client_id', 'client_secret'].filter(k => !data[k]);
  if (missing.length > 0) {
    throw new Error(
      `Credenziali Google incomplete su ${KV_PATH}: mancano ${missing.join(', ')}. ` +
        `Chiavi trovate: ${Object.keys(data).join(', ') || '(nessuna)'}.`,
    );
  }

  const config: GoogleOAuthConfig = {
    clientId: data['client_id'],
    clientSecret: data['client_secret'],
  };
  cached = { config, at: Date.now() };
  return config;
}

/** Azzera la cache: utile dopo una rotazione delle credenziali. */
export function invalidateGoogleOAuthConfigCache(): void {
  cached = null;
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
    throw new Error(`Google OAuth config: lettura ${path} fallita (HTTP ${resp.status})`);
  }
  const json = (await resp.json()) as { data?: { data?: Record<string, string> } };
  return json.data?.data ?? null;
}
