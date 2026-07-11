import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';

import { AccountingApiConfig } from './accounting-api.config';
import { AccountingApiClient } from './accounting-api.client';
import { AccountingApiProxyController } from './accounting-api.proxy.controller';

/**
 * Modulo per le chiamate HTTP sincrone verso accounting (PDF, lookup,
 * SSE streams). Esporta il client per i moduli consumer (es. availability).
 * Fornisce anche un proxy controller per /api/v1/accounting/* (SSE streams,
 * e altre richieste che non hanno un wrapper TypedRPC).
 */
@Module({
  imports: [HttpModule, ConfigModule],
  controllers: [AccountingApiProxyController],
  providers: [AccountingApiConfig, AccountingApiClient],
  exports: [AccountingApiClient, AccountingApiConfig],
})
export class AccountingApiModule {}
