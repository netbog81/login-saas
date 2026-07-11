import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Req,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { CurandisTenantContext } from '@curandis/auth-core';

import { TreatmentService } from '../services/treatment.service';
import {
  AccountingApiClient,
  AccountingRequestContext,
} from '../../accounting-api/accounting-api.client';

/**
 * Estrae il raw JWT dall'header Authorization ("Bearer <token>").
 * Coerente con extractRawToken usato per il context GraphQL.
 */
function extractRawToken(req: Request): string {
  const auth = req.headers.authorization || '';
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  return '';
}

/**
 * PARTE 3 — Proxy per la stampa del PDF della fattura di un trattamento.
 *
 * Il PDF è generato on-demand SOLO da accounting (PDFKit in-process). Il clinico
 * conosce solo `accountingDocumentId` (popolato da billable.invoiced). Questo
 * endpoint inoltra ad accounting `GET /sales-documents/:docId/pdf` propagando il
 * JWT dell'operatore e ristreamma il binario.
 *
 * L'auth è garantita dal CurandisTenantContextMiddleware (auth-core), già attivo
 * globalmente: se manca il tenant context la request non arriva qui autenticata.
 */
@Controller('treatments')
export class TreatmentPdfController {
  constructor(
    private readonly treatmentService: TreatmentService,
    private readonly accountingApi: AccountingApiClient,
  ) {}

  @Get(':id/invoice-pdf')
  async getInvoicePdf(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const treatment = await this.treatmentService.findById(id);
    if (!treatment) {
      throw new NotFoundException(`Trattamento ${id} non trovato`);
    }
    if (!treatment.accountingDocumentId) {
      throw new BadRequestException(
        'Nessuna fattura disponibile per questo trattamento: ' +
          'il documento fiscale non è ancora stato emesso da accounting.',
      );
    }

    const accountingCtx = this.buildAccountingCtx(req);
    const { data, contentType } =
      await this.accountingApi.fetchSalesDocumentPdf(
        treatment.accountingDocumentId,
        accountingCtx,
      );

    const filename = `fattura-${treatment.patientInvoiceNumber ?? treatment.accountingDocumentId}.pdf`;
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${filename.replace(/[^\w.\-]/g, '_')}"`,
    );
    res.send(data);
  }

  /**
   * PARTE 2 — Metodi di pagamento accounting disponibili per il dialog incasso
   * di un trattamento NON-scontoFE. (Per i trattamenti sconto FE il dialog usa
   * i metodi clinici: contanti / voucher_fe.)
   */
  @Get(':id/payment-methods')
  async getPaymentMethods(@Param('id') id: string, @Req() req: Request): Promise<unknown[]> {
    await this.requireTreatment(id);
    return this.accountingApi.fetchPaymentMethods(this.buildAccountingCtx(req));
  }

  /** PARTE 4 — Voucher accounting (tipo 1/2) utilizzabili dal paziente del trattamento. */
  @Get(':id/vouchers')
  async getVouchers(@Param('id') id: string, @Req() req: Request): Promise<unknown[]> {
    const treatment = await this.requireTreatment(id);
    if (!treatment.patientId) return [];
    const ctx = this.buildAccountingCtx(req);
    const partyId = await this.accountingApi.resolvePartyIdBySubject(treatment.patientId, ctx);
    if (!partyId) return [];
    return this.accountingApi.fetchUsableVouchers(partyId, ctx);
  }

  /** PARTE 4 — Fatture del paziente (per emettere un voucher TIPO_2 legato a una fattura). */
  @Get(':id/patient-invoices')
  async getPatientInvoices(@Param('id') id: string, @Req() req: Request): Promise<unknown[]> {
    const treatment = await this.requireTreatment(id);
    if (!treatment.patientId) return [];
    const ctx = this.buildAccountingCtx(req);
    const partyId = await this.accountingApi.resolvePartyIdBySubject(treatment.patientId, ctx);
    if (!partyId) return [];
    return this.accountingApi.fetchPatientInvoices(partyId, ctx);
  }

  private async requireTreatment(id: string) {
    const treatment = await this.treatmentService.findById(id);
    if (!treatment) {
      throw new NotFoundException(`Trattamento ${id} non trovato`);
    }
    return treatment;
  }

  private buildAccountingCtx(req: Request): AccountingRequestContext {
    const ctx = (
      req as Request & { tenantContext?: CurandisTenantContext }
    ).tenantContext;
    if (!ctx?.tenantAlias) {
      throw new BadRequestException('Contesto tenant mancante.');
    }
    return {
      tenantAlias: ctx.tenantAlias,
      rawToken: extractRawToken(req),
      orgId: ctx.orgId ?? null,
      requestId: ctx.requestId,
    };
  }
}
