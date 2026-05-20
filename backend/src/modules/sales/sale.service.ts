import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { randomUUID } from 'crypto';
import Decimal from 'decimal.js';

import { Product } from '../availability/entities/product.entity';
import { Site } from '../availability/entities/site.entity';
import { AppUser } from '../users/entities/app-user.entity';
import { ClinicalEventBuffer } from '../clinical-events/clinical-event-buffer.service';
import { flushBufferedEvents } from '../clinical-events/clinical-event-buffer.helpers';
import {
  SaleCompletedPayload,
  SaleLineProduct,
  TreatmentPayment,
} from '../clinical-events/clinical-events.types';
import { TenantSchemaContextService } from '../../database/tenant-schema-context.service';
import {
  RecordProductSaleInput,
  SaleCompletedResult,
} from './sale.types';

/**
 * Vendita rapida prodotti standalone (spec §26).
 *
 * Caso d'uso: paziente acquista crema/integratore in cassa. Niente Treatment,
 * niente operatore esecutore. Pubblica `sale.completed.<tenant>` verso
 * accounting tramite `ex.clinical.events`.
 *
 * NIENTE entità `Sale` persistita lato clinico per MVP: il record
 * authoritative vive lato accounting come `BillableEvent` (saleId è
 * propagato come business key). Future evoluzioni (es. storico vendite
 * con resi, ricevute interne) richiederanno entità dedicata + tabella
 * `sales` (vedi roadmap post-MVP).
 *
 * Pattern publish-after-commit: tecnicamente NON c'è una transaction DB
 * qui (nulla viene scritto nel clinico — solo letture validative).
 * Comunque usiamo lo stesso `eventBuffer.add()` + `flushBufferedEvents()`
 * per coerenza col resto dei publish point: in caso di throw del
 * resolver/guard PRIMA dell'add, il buffer resta vuoto; in caso di throw
 * DOPO l'add ma PRIMA del flush, ALS dropperà il buffer alla fine
 * della request.
 */
@Injectable()
export class SaleService {
  private readonly logger = new Logger(SaleService.name);

  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(Site)
    private readonly siteRepo: Repository<Site>,
    @InjectRepository(AppUser)
    private readonly appUserRepo: Repository<AppUser>,
    private readonly eventBuffer: ClinicalEventBuffer,
    private readonly eventEmitter: EventEmitter2,
    private readonly tenantContext: TenantSchemaContextService,
  ) {}

  /**
   * Registra una vendita rapida prodotto + pubblica `sale.completed.<tenant>`.
   *
   * @param input dati vendita (subject pagante, subject beneficiario, righe prodotto, payment)
   * @param soldByAppUserId AppUser.id della segreteria che esegue la vendita (per audit + payload)
   * @returns SaleCompletedResult { saleId, publishedAt, totalAmount }
   */
  async recordProductSale(
    input: RecordProductSaleInput,
    soldByAppUserId: string,
  ): Promise<SaleCompletedResult> {
    const tenantAlias = this.tenantContext.getTenantAlias();
    if (!tenantAlias) {
      throw new Error(
        'recordProductSale chiamato fuori da contesto tenant. ' +
          'Wrappare in TenantSchemaContextService.run + eventBuffer.runInScope.',
      );
    }
    const correlationId = this.tenantContext.getContext()?.requestId;

    if (!input.lines || input.lines.length === 0) {
      throw new BadRequestException('La vendita deve contenere almeno una riga prodotto.');
    }

    // Risoluzione site: esplicito → fallback prima sede attiva.
    const siteId = await this.resolveSiteId(input.siteId);

    // Carica i prodotti referenziati in batch (no N+1).
    const productIds = Array.from(new Set(input.lines.map((l) => l.productId)));
    const products = await this.productRepo.find({
      where: { id: In(productIds) },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    for (const id of productIds) {
      const p = productMap.get(id);
      if (!p) {
        throw new NotFoundException(`Prodotto ${id} non trovato.`);
      }
      if (!p.isActive) {
        throw new BadRequestException(
          `Prodotto ${id} (${p.productCode}) non è più attivo: non vendibile.`,
        );
      }
    }

    // Costruzione lines con calcolo prezzi.
    const saleLines: SaleLineProduct[] = [];
    let total = new Decimal(0);
    for (const line of input.lines) {
      const product = productMap.get(line.productId)!;
      const unitPrice = new Decimal(
        line.unitPriceOverride !== undefined
          ? line.unitPriceOverride
          : product.defaultPrice,
      );
      if (unitPrice.isNegative()) {
        throw new BadRequestException(
          `Prezzo unitario non può essere negativo per prodotto ${product.productCode}.`,
        );
      }
      const quantity = new Decimal(line.quantity);
      const lineTotal = unitPrice.mul(quantity);
      total = total.plus(lineTotal);

      saleLines.push({
        lineId: randomUUID(),
        itemType: 'PRODUCT',
        productId: product.id,
        productCode: product.productCode,
        productName: product.name,
        quantity: quantity.toFixed(2),
        unitPrice: unitPrice.toFixed(2),
        totalPrice: lineTotal.toFixed(2),
      });
    }

    const totalAmount = total.toFixed(2);

    // Risolvi il keycloakSub del soldBy (consistente con altri payload).
    const soldByKeycloakSub = await this.resolveKeycloakSub(soldByAppUserId);

    // Costruzione payload payment (opzionale): segui lo stesso shape del
    // TreatmentPayment riusato nella spec.
    const payment: TreatmentPayment | undefined = input.isPaid
      ? {
          isPaid: true,
          paidAt: new Date().toISOString(),
          paymentMethod: input.paymentMethod ?? null,
          amount: totalAmount,
          collectedByUserId: soldByKeycloakSub,
        }
      : undefined;

    const saleId = randomUUID();
    const now = new Date();
    const executionDate = this.formatDateOnly(now);

    const payload: SaleCompletedPayload = {
      saleId,
      saleType: 'PRODUCT',
      siteId,
      executionDate,
      soldByUserId: soldByKeycloakSub,
      purchaserSubjectId: input.purchaserSubjectId,
      beneficiarySubjectId: input.beneficiarySubjectId,
      lines: saleLines,
      totalAmount,
      payment,
      requestImmediateInvoice: input.requestImmediateInvoice ?? true,
      notes: input.notes ?? null,
    };

    this.eventBuffer.add({
      eventType: 'sale.completed',
      payload,
      tenantAlias,
      correlationId,
    });

    // Niente transaction DB: flush immediato. Coerente con pattern degli
    // altri publish point (flush dopo l'unità di lavoro che ha
    // popolato il buffer).
    flushBufferedEvents(this.eventBuffer, this.eventEmitter);

    this.logger.log(
      `Sale rapida pubblicata: saleId=${saleId} totalAmount=${totalAmount} ` +
        `lines=${saleLines.length} purchaser=${input.purchaserSubjectId}`,
    );

    return {
      saleId,
      publishedAt: now,
      totalAmount: total.toNumber(),
    };
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private async resolveSiteId(explicitSiteId?: string): Promise<string> {
    if (explicitSiteId) {
      const site = await this.siteRepo.findOne({ where: { id: explicitSiteId } });
      if (!site) {
        throw new NotFoundException(`Sede ${explicitSiteId} non trovata.`);
      }
      if (!site.isActive) {
        throw new BadRequestException(`Sede ${explicitSiteId} non attiva.`);
      }
      return site.id;
    }
    const defaultSite = await this.siteRepo.findOne({
      where: { isActive: true },
      order: { createdAt: 'ASC' },
    });
    if (!defaultSite) {
      throw new BadRequestException(
        'Nessuna sede attiva configurata. Contattare amministratore.',
      );
    }
    return defaultSite.id;
  }

  private async resolveKeycloakSub(appUserId: string): Promise<string | null> {
    const user = await this.appUserRepo.findOne({
      where: { id: appUserId },
      select: { id: true, keycloakId: true },
    });
    return user?.keycloakId ?? null;
  }

  private formatDateOnly(d: Date): string {
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
}
