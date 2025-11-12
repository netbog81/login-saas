import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Abilita CORS per permettere richieste dal frontend Angular
  // Sostituisci <YOUR_VM_IP> con l'IP effettivo della tua VM
  app.enableCors({
    origin: [
      'http://localhost:4200',
      'http://localhost:4201',
      'http://*:4200', // Permette qualsiasi host sulla porta 4200
      /^http:\/\/.*:4200$/ // Regex per qualsiasi IP sulla porta 4200
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
  await app.listen(port, host);
  console.log(`🚀 Backend running on: http://0.0.0.0:${port}`);
  console.log(`🌐 Accessible from LAN at: http://<YOUR_VM_IP>:${port}`);
}
bootstrap();
