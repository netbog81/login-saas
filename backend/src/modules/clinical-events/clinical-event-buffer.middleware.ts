import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

import { ClinicalEventBuffer } from './clinical-event-buffer.service';

/**
 * Wrappa ogni request HTTP in `eventBuffer.runInScope(...)`, così tutti i
 * service business invocati durante la request possono fare
 * `eventBuffer.add(...)` senza preoccuparsi di setup ALS.
 *
 * Per entry-point non-HTTP (smoke script, consumer accounting → clinico,
 * cron job), wrappare manualmente in `runInScope()` — il `add()` esplode
 * se chiamato fuori scope, così il bug è rumoroso.
 */
@Injectable()
export class ClinicalEventBufferMiddleware implements NestMiddleware {
  constructor(private readonly buffer: ClinicalEventBuffer) {}

  use(_req: Request, _res: Response, next: NextFunction): void {
    // runInScope ritorna Promise<T>; per Express middleware delegando a
    // next() basta invocarlo dentro lo scope. Non await: Express gestisce
    // l'async lifecycle dei suoi handler.
    this.buffer.runInScope(async () => {
      next();
    });
  }
}
