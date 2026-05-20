import { Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';

import { Service as ServiceEntity } from '../../availability/entities/service.entity';
import { Product } from '../../availability/entities/product.entity';
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
  mapServiceUpserted(service: ServiceEntity): ServiceUpsertedPayload {
    return {
      serviceId: service.id,
      serviceCode: service.serviceCode,
      name: service.name,
      description: service.description ?? null,
      defaultPrice: this.toDecimalString(service.defaultPrice),
      discountFE:
        service.discountFE !== null && service.discountFE !== undefined
          ? this.toDecimalString(service.discountFE)
          : null,
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

  private toDecimalString(v: number | string): string {
    return new Decimal(v).toFixed(2);
  }
}
