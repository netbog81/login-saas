import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { createOpenbaoService, OpenbaoBaseService } from '@curandis/openbao-core';
import { AppModule } from './app.module';
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
  const isDevelopment = process.env.NODE_ENV === 'development';

  // 1. Ottieni credenziali DB da OpenBao (con fallback development)
  console.log(`[Bootstrap] Modalita' OpenBao: ${isAgentMode ? 'Agent proxy' : 'AppRole diretto'}`);

  let openbaoService: OpenbaoBaseService | null = null;
  let mainDbCreds: { username: string; password: string };

  try {
    const result = await createOpenbaoService({
      config: {
        endpoint: process.env.OPENBAO_ADDR || 'http://127.0.0.1:8200',
        agentMode: isAgentMode,
        roleId: isAgentMode ? undefined : process.env.CURANDIS_OPENBAO_ROLE_ID,
        secretId: isAgentMode ? undefined : process.env.CURANDIS_OPENBAO_SECRET_ID,
        envFilePath: isAgentMode ? undefined : envFilePath,
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
    if (isDevelopment) {
      // In development, fallback a credenziali dal .env
      const fbUser = process.env.MAIN_DB_USERNAME;
      const fbPass = process.env.MAIN_DB_PASSWORD;
      if (fbUser && fbPass) {
        console.warn('[Bootstrap] OpenBao non disponibile, uso credenziali fallback dal .env');
        mainDbCreds = { username: fbUser, password: fbPass };
      } else {
        console.error('[Bootstrap] OpenBao non disponibile e nessuna credenziale fallback nel .env');
        throw error;
      }
    } else {
      // In produzione, OpenBao e' obbligatorio
      throw error;
    }
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

  // 3. Attach EventEmitter per eventi di rotazione credenziali
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
  console.log('OpenBao:');
  console.log(`   Modalita':  ${isAgentMode ? 'Agent proxy' : 'AppRole diretto'}`);
  console.log(`   Endpoint:   ${process.env.OPENBAO_ADDR || 'http://127.0.0.1:8200'}`);
  console.log(`   DB user:    ${mainDbCreds.username}`);
  console.log('');
  console.log('CORS configurato per:');
  console.log('   http://localhost:4200 (sviluppo locale)');
  console.log('   http://*.*.*.* :4200 (sviluppo LAN)');
  console.log('   https://*.curandis.cloud (produzione)');
  console.log('');
}

bootstrap();
