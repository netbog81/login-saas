import { BadRequestException, Body, Controller, Post } from '@nestjs/common';

import { SubjectMergeService } from '../services/subject-merge.service';
import {
  MergePreview,
  MergeResult,
  SubjectMergeInput,
} from '../dto/subject-merge.dto';

/**
 * Endpoint interni S2S consumati dal registry per consolidare anagrafiche
 * duplicate: riassegnano tutti i dati clinici da un subject "loser" a un subject
 * "winner".
 *
 * Auth/tenant: identici agli endpoint data-summary. Nessun guard esplicito — la
 * protezione è il CurandisTenantContextMiddleware globale (auth-core): valida il
 * bearer token (utente O service-account), risolve il tenant da X-Tenant-Alias e
 * popola il DataSource del tenant in AsyncLocalStorage. Il registry inoltra il
 * JWT dell'admin + X-Tenant-Alias. Volutamente NON dietro un guard admin-only.
 */
@Controller('internal/subjects')
export class SubjectMergeController {
  constructor(private readonly service: SubjectMergeService) {}

  /** Anteprima (dry-run): cosa verrebbe spostato/scartato, senza modifiche. */
  @Post('merge-preview')
  preview(@Body() input: SubjectMergeInput): Promise<MergePreview> {
    this.assertDistinct(input);
    return this.service.preview(input.winnerSubjectId, input.loserSubjectId);
  }

  /** Esegue la riassegnazione in una singola transazione DB. */
  @Post('merge-execute')
  execute(@Body() input: SubjectMergeInput): Promise<MergeResult> {
    this.assertDistinct(input);
    return this.service.execute(input.winnerSubjectId, input.loserSubjectId);
  }

  /** winner e loser devono essere distinti (altrimenti 400). */
  private assertDistinct(input: SubjectMergeInput): void {
    if (input.winnerSubjectId === input.loserSubjectId) {
      throw new BadRequestException(
        'winnerSubjectId e loserSubjectId devono essere distinti',
      );
    }
  }
}
