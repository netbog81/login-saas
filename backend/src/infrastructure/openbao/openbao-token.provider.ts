import { Injectable, Logger } from '@nestjs/common';
import { OpenbaoBaseService } from '@curandis/openbao-core';

/**
 * Adapter che espone il token OpenBao corrente alle librerie che parlano
 * direttamente con OpenBao via fetch (@curandis/encryption-core,
 * lettura KV per @curandis/storage-core).
 *
 * Delega tutto a `OpenbaoBaseService.getCurrentAgentToken()`:
 *  - In agent mode rilegge il sink ad ogni chiamata (fresh).
 *  - In AppRole mode ritorna il client_token in memoria.
 *
 * Stesso pattern già in produzione nel registry backend.
 */
@Injectable()
export class OpenbaoTokenProvider {
  private readonly logger = new Logger(OpenbaoTokenProvider.name);

  constructor(private readonly openbao: OpenbaoBaseService) {}

  getToken(): string {
    const token = this.openbao.getCurrentAgentToken();
    if (!token) {
      this.logger.warn('OpenBao token not yet available');
      return '';
    }
    return token;
  }
}
