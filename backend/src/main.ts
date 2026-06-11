import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { createOpenbaoService, OpenbaoBaseService } from '@curandis/openbao-core';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

// __dirname varia tra host (dist/src/) e container (dist/). Provo entrambi i
// path possibili per il .env locale. In container il .env tipicamente NON
// esiste (le env vars arrivano dal compose), quindi dotenv non trova nulla
// e va bene così (default silenzioso).
const envCandidates = [
  path.resolve(__dirname, '../.env'),     // container: __dirname = /app/dist
  path.resolve(__dirname, '../../.env'),  // host dev: __dirname = backend/dist/src
];
const envFilePath = envCandidates.find((p) => {
  try { return require('fs').existsSync(p); } catch { return false; }
}) ?? envCandidates[1];
dotenv.config({ path: envFilePath });

/**
 * Legge un payload KV v2 da OpenBao via REST diretto (no Vault SDK qui per
 * mantenere il bootstrap leggero). Path atteso: `kv/<namespace>/<key>`.
 * Throws se 403/404/connessione fallita: i secret bootstrap sono critici.
 */
async function readKvSecret(
  endpoint: string,
  kvPath: string,
  token: string,
): Promise<Record<string, string>> {
  const trimmed = kvPath.replace(/^\/+|\/+$/g, '');
  const [mount, ...rest] = trimmed.split('/');
  if (!mount || rest.length === 0) {
    throw new Error(`Path KV malformato: "${kvPath}". Atteso "<mount>/<path>"`);
  }
  const url = `${endpoint}/v1/${mount}/data/${rest.join('/')}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { 'X-Vault-Token': token },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`OpenBao KV read fallito (${res.status}) per "${kvPath}": ${body}`);
  }
  const json = (await res.json()) as { data?: { data?: Record<string, string> } };
  const data = json?.data?.data;
  if (!data) {
    throw new Error(`KV vuoto per "${kvPath}"`);
  }
  return data;
}

/** Estrae il token corrente da Agent sink o da env (AppRole mode). */
function resolveOpenbaoToken(isAgentMode: boolean): string {
  if (isAgentMode) {
    const sinkPath = process.env.OPENBAO_AGENT_TOKEN_PATH;
    if (!sinkPath) {
      throw new Error('OPENBAO_AGENT_MODE=true ma OPENBAO_AGENT_TOKEN_PATH non impostato');
    }
    return fs.readFileSync(sinkPath, 'utf8').trim();
  }
  const directToken = process.env.OPENBAO_TOKEN || '';
  if (!directToken) {
    throw new Error(
      'AppRole mode in bootstrap: serve OPENBAO_TOKEN o passare a OPENBAO_AGENT_MODE=true',
    );
  }
  return directToken;
}

function getLocalIp(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '192.168.x.x';
}

async function bootstrap() {
  const isAgentMode = process.env.OPENBAO_AGENT_MODE === 'true';
  const isDevelopment = process.env.NODE_ENV === 'development';

  console.log(`[Bootstrap] Modalita' OpenBao: ${isAgentMode ? 'Agent proxy' : 'AppRole diretto'}`);

  let openbaoService: OpenbaoBaseService;

  try {
    const result = await createOpenbaoService({
      config: {
        endpoint: process.env.OPENBAO_ADDR || 'http://127.0.0.1:8200',
        agentMode: isAgentMode,
        agentTokenPath: isAgentMode ? process.env.OPENBAO_AGENT_TOKEN_PATH : undefined,
        roleId: isAgentMode ? undefined : process.env.CURANDIS_OPENBAO_ROLE_ID,
        secretId: isAgentMode ? undefined : process.env.CURANDIS_OPENBAO_SECRET_ID,
        envFilePath: isAgentMode ? undefined : envFilePath,
        enableProxyHealthCheck: true,
        proxyHealthCheckIntervalMs: 60 * 1000,
      },
      credentialSources: [],
    });
    openbaoService = result.service;
    console.log('[Bootstrap] OpenBao autenticato');
  } catch (error) {
    if (!isDevelopment) {
      const endpoint = process.env.OPENBAO_ADDR || 'http://127.0.0.1:8200';
      console.error(
        `[Bootstrap] OpenBao non raggiungibile su ${endpoint}: ${(error as Error).message}\n` +
        `[Bootstrap] Il backend NON parte senza OpenBao valido. Verifiche:\n` +
        `  - Agent OpenBao attivo:  systemctl status openbao-agent-clinico.service\n` +
        `  - Endpoint raggiungibile: curl -s ${endpoint}/v1/sys/health\n`,
      );
      throw error;
    }
    console.warn('[Bootstrap] OpenBao non disponibile, avvio in modalita\' sviluppo');
    openbaoService = new OpenbaoBaseService({
      endpoint: 'http://127.0.0.1:8200',
      agentMode: true,
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // Bootstrap secret loading da OpenBao KV
  // RabbitMQ: kv/clinico/rabbitmq { host, port, user, password, vhost }
  // Iniettato come process.env per i config service che leggono RABBITMQ_URL.
  // ─────────────────────────────────────────────────────────────────
  try {
    const endpoint = process.env.OPENBAO_ADDR || 'http://127.0.0.1:8200';
    const token = resolveOpenbaoToken(isAgentMode);

    try {
      const rmq = await readKvSecret(endpoint, 'kv/clinico/rabbitmq', token);
      process.env.RABBITMQ_HOST = rmq.host;
      process.env.RABBITMQ_PORT = rmq.port;
      process.env.RABBITMQ_USER = rmq.user;
      process.env.RABBITMQ_PASSWORD = rmq.password;
      process.env.RABBITMQ_VHOST = rmq.vhost;
      // I config esistenti (registry-events, clinical-events, smoke scripts)
      // leggono RABBITMQ_URL come singola stringa: la ricostruiamo qui
      // dal KV per non dover rifattorizzare quei file.
      process.env.RABBITMQ_URL =
        `amqp://${rmq.user}:${rmq.password}@${rmq.host}:${rmq.port}/${rmq.vhost}`;
      console.log(`[Bootstrap] RabbitMQ creds caricate da KV (host=${rmq.host}, vhost=${rmq.vhost})`);
    } catch (e) {
      if (!isDevelopment) throw e;
      console.warn(`[Bootstrap] KV kv/clinico/rabbitmq non disponibile (dev): ${(e as Error).message}`);
    }
  } catch (error) {
    console.error(`[Bootstrap] Secret loading fallito: ${(error as Error).message}`);
    throw error;
  }

  const app = await NestFactory.create(
    AppModule.forRootAsync({ openbaoService }),
  );

  // EventEmitter per eventi di rotazione credenziali (gestiti da tenant-datasource)
  const eventEmitter = app.get(EventEmitter2);
  openbaoService.setEventEmitter(eventEmitter);

  app.use(cookieParser());

  app.enableCors({
    origin: [
      'http://localhost:4200',
      'http://localhost:4201',
      /^http:\/\/.*:4200$/,
      'https://agenda.curandis.cloud',
      /^https:\/\/.*\.curandis\.cloud$/,
    ],
    credentials: true,
  });

  // NOTA: whitelist disabilitato per compatibilita' con GraphQL InputTypes
  // che non hanno decoratori class-validator ma solo @Field()
  app.useGlobalPipes(new ValidationPipe({
    whitelist: false,
    forbidNonWhitelisted: false,
    transform: true,
  }));

  const port = process.env.PORT || 3000;
  const host = '0.0.0.0';
  const localIp = getLocalIp();

  await app.listen(port, host);

  console.log('');
  console.log('Backend NestJS avviato con successo!');
  console.log('');
  console.log('Indirizzi disponibili:');
  console.log(`   Localhost:  http://localhost:${port}`);
  console.log(`   LAN:        http://${localIp}:${port}`);
  console.log('');
  console.log('OpenBao:');
  console.log(`   Modalita':  ${isAgentMode ? 'Agent proxy' : 'AppRole diretto'}`);
  console.log(`   Endpoint:   ${process.env.OPENBAO_ADDR || 'http://127.0.0.1:8200'}`);
  console.log('');
  console.log('CORS configurato per:');
  console.log('   http://localhost:4200 (sviluppo locale)');
  console.log('   https://*.curandis.cloud (produzione)');
  console.log('');
}

bootstrap();
