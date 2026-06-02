import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { createOpenbaoService, OpenbaoBaseService } from '@curandis/openbao-core';
import { AppModule } from './app.module';
import { CredentialSourceTracker } from './health/credential-source-tracker.service';
import cookieParser from 'cookie-parser';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as os from 'os';

// Carica .env prima di tutto (necessario per le variabili di configurazione)
// __dirname a runtime e' dist/src/, quindi risaliamo di 2 livelli per arrivare a backend/.env
const envFilePath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envFilePath });

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

  // 1. Ottieni credenziali DB da OpenBao
  console.log(`[Bootstrap] Modalita' OpenBao: ${isAgentMode ? 'Agent proxy' : 'AppRole diretto'}`);

  let openbaoService: OpenbaoBaseService | null = null;
  let mainDbCreds: { username: string; password: string };
  let credentialSource: 'openbao' | 'env-fallback' = 'openbao';

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
      credentialSources: [
        {
          name: 'main-db',
          staticCredsPath: 'database/static-creds/postgres-main-service-account',
          rotationEventName: 'credentials.main-db.rotated',
          credentialRefreshIntervalMs: 6 * 60 * 60 * 1000, // 6h
          fallbackEnvUsername: 'MAIN_DB_USERNAME',
          fallbackEnvPassword: 'MAIN_DB_PASSWORD',
        },
      ],
    });

    openbaoService = result.service;
    mainDbCreds = result.credentials['main-db'];
    console.log(`[Bootstrap] Credenziali DB da OpenBao (user: ${mainDbCreds.username})`);
  } catch (error) {
    // Fallback dev locale: SOLO se esplicitamente abilitato via env
    // `ALLOW_DEV_FALLBACK=true`. Il vecchio comportamento "fallback
    // automatico se NODE_ENV=development" è stato rimosso il 2026-06-01
    // dopo un incidente: l'Agent OpenBao era momentaneamente irraggiungibile
    // al boot, il backend è caduto silenziosamente sulle credenziali
    // `postgres/postgres` del .env, e tutte le richieste tenant sono
    // andate in loop 28P01 per ore senza che fosse evidente cosa stesse
    // succedendo (sintomo confuso con il bug del token stale OpenBao,
    // che era una cosa diversa). Fail-fast > start azzoppato.
    const allowDevFallback = process.env.ALLOW_DEV_FALLBACK === 'true';
    const endpoint = process.env.OPENBAO_ADDR || 'http://127.0.0.1:8200';
    const errMsg = (error as Error)?.message ?? String(error);

    if (!allowDevFallback) {
      console.error(
        `[Bootstrap] OpenBao non raggiungibile su ${endpoint}: ${errMsg}\n` +
        `[Bootstrap] Il backend NON parte senza credenziali OpenBao valide. Verifiche:\n` +
        `  - Agent OpenBao attivo:  systemctl status openbao-agent-main.service\n` +
        `  - Endpoint raggiungibile: curl -s ${endpoint}/v1/sys/health\n` +
        `  - Policy del role abilita la lettura di database/static-creds/postgres-main-service-account\n` +
        `[Bootstrap] Per dev locale senza OpenBao: export ALLOW_DEV_FALLBACK=true (richiede MAIN_DB_USERNAME/PASSWORD nel .env).`,
      );
      throw error;
    }

    // Fallback esplicito (dev locale): richiede entrambe le env vars.
    const fbUser = process.env.MAIN_DB_USERNAME;
    const fbPass = process.env.MAIN_DB_PASSWORD;
    if (!fbUser || !fbPass) {
      console.error(
        `[Bootstrap] ALLOW_DEV_FALLBACK=true ma MAIN_DB_USERNAME/MAIN_DB_PASSWORD non valorizzati nel .env. Fail.`,
      );
      throw error;
    }
    console.warn(
      `[Bootstrap] ALLOW_DEV_FALLBACK=true → uso credenziali fallback dal .env (user="${fbUser}"). ` +
      `NON USARE IN PRODUZIONE: ogni 28P01 successivo NON è recuperabile via force-refresh.`,
    );
    mainDbCreds = { username: fbUser, password: fbPass };
    credentialSource = 'env-fallback';
  }

  // 2. Crea l'app NestJS con le credenziali
  // Se openbaoService e' null (fallback development), crea un servizio dummy
  if (!openbaoService) {
    openbaoService = new OpenbaoBaseService({
      endpoint: 'http://127.0.0.1:8200',
      agentMode: true, // dummy mode, nessuna operazione reale
    });
  }

  console.log(`[Bootstrap] Credenziali DB ottenute (user: ${mainDbCreds.username})`);

  const app = await NestFactory.create(
    AppModule.forRootAsync({ mainDbCredentials: mainDbCreds, openbaoService }),
  );

  // 3. Registra la fonte delle credenziali nel tracker
  const tracker = app.get(CredentialSourceTracker);
  tracker.setSource(credentialSource, mainDbCreds.username);

  // 3b. Verifica il database effettivo all'avvio
  const expectedDb = process.env.DB_DATABASE || 'calendar_db';
  try {
    const { DataSource } = await import('typeorm');
    const ds = app.get(DataSource);
    const [row] = await ds.query('SELECT current_database() AS db');
    const actualDb = row?.db;
    if (actualDb !== expectedDb) {
      console.error(`[Bootstrap] ATTENZIONE: database effettivo="${actualDb}", atteso="${expectedDb}"!`);
    } else {
      console.log(`[Bootstrap] Database effettivo verificato: ${actualDb}`);
    }
  } catch (err: any) {
    console.warn(`[Bootstrap] Impossibile verificare database effettivo: ${err?.message}`);
  }

  // 4. Attach EventEmitter per eventi di rotazione credenziali
  const eventEmitter = app.get(EventEmitter2);
  openbaoService.setEventEmitter(eventEmitter);

  // 4. Cookie parser per gestione cookie HttpOnly (auth)
  app.use(cookieParser());

  // 5. CORS
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

  // 6. Validation pipe globale
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
  console.log('Database:');
  console.log(`   DB atteso:  ${expectedDb}`);
  console.log(`   DB user:    ${mainDbCreds.username}`);
  console.log('');
  console.log('OpenBao:');
  console.log(`   Modalita':  ${isAgentMode ? 'Agent proxy' : 'AppRole diretto'}`);
  console.log(`   Endpoint:   ${process.env.OPENBAO_ADDR || 'http://127.0.0.1:8200'}`);
  console.log('');
  console.log('CORS configurato per:');
  console.log('   http://localhost:4200 (sviluppo locale)');
  console.log('   http://*.*.*.* :4200 (sviluppo LAN)');
  console.log('   https://*.curandis.cloud (produzione)');
  console.log('');
}

bootstrap();
