import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import * as os from 'os';

// Funzione per ottenere l'IP locale della LAN
function getLocalIp(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Salta indirizzi interni (loopback) e IPv6
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '192.168.x.x'; // Fallback se non trova IP
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Abilita CORS per permettere richieste dal frontend Angular
  app.enableCors({
    origin: [
      // Localhost
      'http://localhost:4200',
      'http://localhost:4201',
      // LAN
      /^http:\/\/.*:4200$/, // Regex per qualsiasi IP/host sulla porta 4200
      // Domini personalizzati (Traefik con HTTPS)
      'https://agenda.curandis.cloud',
      /^https:\/\/.*\.curandis\.cloud$/, // Tutti i subdomain di curandis.cloud
    ],
    credentials: true,
  });

  // Abilita validation pipe globale
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  const port = process.env.PORT || 3000;
  const host = '0.0.0.0'; // Ascolta su tutte le interfacce di rete
  const localIp = getLocalIp();

  await app.listen(port, host);

  console.log('');
  console.log('🚀 Backend NestJS avviato con successo!');
  console.log('');
  console.log('📍 Indirizzi disponibili:');
  console.log(`   • Localhost:  http://localhost:${port}`);
  console.log(`   • LAN:        http://${localIp}:${port}`);
  console.log('');
  console.log('🔗 CORS configurato per:');
  console.log('   • http://localhost:4200 (sviluppo locale)');
  console.log('   • http://*.*.*.* :4200 (sviluppo LAN)');
  console.log('   • https://*.curandis.cloud (produzione)');
  console.log('');
  console.log('💡 Per testare: curl http://localhost:' + port);
  console.log('');
}
bootstrap();
