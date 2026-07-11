import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';

import { SubjectDataSummaryService } from '../services/subject-data-summary.service';
import {
  SubjectDataSummary,
  SubjectDataSummaryBulkInput,
} from '../dto/subject-data-summary.dto';

/**
 * Endpoint interni S2S consumati dal registry per sapere quanti dati clinici
 * referenziano un subject (paziente) prima di un hard-delete.
 *
 * Auth: nessun guard esplicito. Come per tutti gli endpoint autenticati del
 * clinico (es. /api/me, /appointments), la protezione è il
 * CurandisTenantContextMiddleware globale (auth-core), applicato a tutte le
 * rotte tranne health/events/webhooks. Valida il bearer token (utente O
 * service-account in whitelist), risolve il tenant da X-Tenant-Alias/subdomain
 * e popola il DataSource del tenant in AsyncLocalStorage. Un service token
 * valido del registry + header X-Tenant-Alias passa esattamente come una
 * request utente. Volutamente NON dietro un guard admin-only.
 */
@Controller('internal/subjects')
export class SubjectDataSummaryController {
  constructor(private readonly service: SubjectDataSummaryService) {}

  /** Riepilogo per un singolo subject. */
  @Get(':subjectId/data-summary')
  getOne(
    @Param('subjectId', new ParseUUIDPipe()) subjectId: string,
  ): Promise<SubjectDataSummary> {
    return this.service.getSummary(subjectId);
  }

  /**
   * Riepilogo per più subject (max 500). Ritorna un elemento per ogni id
   * richiesto, nello stesso ordine, incluse le voci con hasData=false così il
   * caller può mappare per subjectId.
   */
  @Post('data-summary')
  getBulk(
    @Body() input: SubjectDataSummaryBulkInput,
  ): Promise<SubjectDataSummary[]> {
    return this.service.getSummaries(input.subjectIds);
  }
}
