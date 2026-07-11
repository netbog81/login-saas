import { Injectable, Logger } from '@nestjs/common';
import Decimal from 'decimal.js';
import { EntityManager } from 'typeorm';

import { Service as ServiceEntity } from '../../availability/entities/service.entity';
import { Product } from '../../availability/entities/product.entity';
import { ServiceSubcategory } from '../../availability/entities/service-subcategory.entity';
import { ServiceInvoicePrefix } from '../../availability/entities/service-invoice-prefix.entity';
import { OperatorMacroCategory } from '../../availability/entities/operator-macro-category.enum';
import { ServiceInvoicePrefixService } from '../../availability/services/service-invoice-prefix.service';
import {
  ProductDeletedPayload,
  ProductUpsertedPayload,
  ServiceDeletedPayload,
  ServiceUpsertedPayload,
} from '../clinical-events.types';

/**
 * Mapper Service / Product → payload `service.*.<tenant>` / `product.*.<tenant>`.
 *
 * Mappa completa banale (no relations da seguire), ma centralizzata qui per:
 *  - normalizzare numeric → string "N.NN" via decimal.js (consistente col TreatmentEventMapper)
 *  - garantire che il bootstrap script (Step 5) e gli hook real-time
 *    (Step 7.6) producano payload identici per gli stessi dati.
 *
 * NOTA Step 5: lo script `sync:services` costruisce il payload inline
 * (storia precedente al mapper centralizzato). Per evitare drift, sarà
 * refactorato in un commit successivo per usare anch'esso questo mapper.
 * Annotato per Step 8 CLAUDE.md.
 */
@Injectable()
export class CatalogEventMapper {
  private readonly logger = new Logger(CatalogEventMapper.name);

  /**
   * 2026-07-07 — Variante async che arricchisce il payload con
   * `invoiceLineDescriptionDefault` (descrizione riga fattura a livello di
   * SOLO servizio, prefill modificabile lato accounting). Carica dal
   * `manager` (tenant corrente) la config macro-categoria e, se serve,
   * la sottocategoria del service.
   */
  async mapServiceUpsertedWithDefaults(
    service: ServiceEntity,
    manager: EntityManager,
  ): Promise<ServiceUpsertedPayload> {
    return {
      ...this.mapServiceUpserted(service),
      invoiceLineDescriptionDefault:
        await this.buildServiceLevelInvoiceDescription(service, manager),
    };
  }

  mapServiceUpserted(service: ServiceEntity): ServiceUpsertedPayload {
    return {
      serviceId: service.id,
      serviceCode: service.serviceCode,
      name: service.name,
      description: service.description ?? null,
      defaultPrice: this.toDecimalString(service.defaultPrice),
      discountFE: this.toDecimalStringOrNull(service.discountFE),
      serviceFee: this.toDecimalStringOrNull(service.serviceFee),
      studioExtra: this.toDecimalStringOrNull(service.studioExtra),
      serviceFeeFE: this.toDecimalStringOrNull(service.serviceFeeFE),
      studioExtraFE: this.toDecimalStringOrNull(service.studioExtraFE),
      macroCategory: service.macroCategory ?? null,
      isActive: service.isActive,
    };
  }

  mapServiceDeleted(serviceId: string, deletedAt: Date): ServiceDeletedPayload {
    return {
      serviceId,
      deletedAt: deletedAt.toISOString(),
    };
  }

  mapProductUpserted(product: Product): ProductUpsertedPayload {
    return {
      productId: product.id,
      productCode: product.productCode,
      name: product.name,
      description: product.description ?? null,
      defaultPrice: this.toDecimalString(product.defaultPrice),
      category: product.category ?? null,
      isActive: product.isActive,
    };
  }

  mapProductDeleted(productId: string, deletedAt: Date): ProductDeletedPayload {
    return {
      productId,
      deletedAt: deletedAt.toISOString(),
    };
  }

  /**
   * Descrizione riga fattura DEFAULT a livello di solo servizio.
   *
   * Stessa config di macro-categoria usata dal TreatmentEventMapper
   * (`service_invoice_prefixes` + resolveConfig), ma SENZA contesto
   * operatore: `useOperatorCategories` è forzato a false (nessuna categoria
   * operatore da cui pescare) e i segnaposto {data}, {operatore}, {albo},
   * {strumenti}, {descrizione_fattura_categoria} restano vuoti — il renderer
   * ripulisce i separatori orfani.
   *
   * Best-effort: qualsiasi errore qui NON deve bloccare l'upsert del
   * catalogo → ritorna null e logga un warn.
   */
  private async buildServiceLevelInvoiceDescription(
    service: ServiceEntity,
    manager: EntityManager,
  ): Promise<string | null> {
    try {
      const category =
        (service.macroCategory as OperatorMacroCategory | null | undefined) ??
        OperatorMacroCategory.OTHER;

      const macroSaved = await manager
        .getRepository(ServiceInvoicePrefix)
        .findOne({ where: { macroCategory: category } });

      // Sottocategoria: usa la relation se già caricata, altrimenti lookup.
      let subcategory: ServiceSubcategory | null = service.subcategory ?? null;
      if (!subcategory && service.subcategoryId) {
        subcategory = await manager
          .getRepository(ServiceSubcategory)
          .findOne({ where: { id: service.subcategoryId } });
      }

      const config = ServiceInvoicePrefixService.resolveConfig({
        useOperatorCategories: false, // service-level: niente contesto operatore
        operatorCategory: null,
        macroCategory: category,
        macroSaved: macroSaved ?? null,
      });

      const description = ServiceInvoicePrefixService.composeAuto(config, {
        prefisso: config.prefix,
        data: '',
        codiceServizio: service.serviceCode ?? '',
        nomeServizio: service.name ?? '',
        descrizioneServizio: service.description ?? '',
        descrizioneFatturaSottocategoria: subcategory?.invoiceLineDescription ?? '',
        operatore: '',
        albo: '',
        descrizioneFatturaCategoria: '',
        strumenti: '',
      });

      const trimmed = description.trim();
      return trimmed.length > 0 ? trimmed : null;
    } catch (err) {
      this.logger.warn(
        `buildServiceLevelInvoiceDescription fallita per service=${service.id}: ` +
          `${(err as Error).message} — invio payload con default null`,
      );
      return null;
    }
  }

  private toDecimalString(v: number | string): string {
    return new Decimal(v).toFixed(2);
  }

  private toDecimalStringOrNull(v: number | string | null | undefined): string | null {
    return v === null || v === undefined ? null : new Decimal(v).toFixed(2);
  }
}
