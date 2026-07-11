import { Injectable, Injector } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { BaseGraphQLService } from '../core/services/base-graphql.service';
import {
  SERVICE_INVOICE_PREFIXES,
  UPSERT_SERVICE_INVOICE_PREFIX,
  INVOICE_LINE_SETTINGS,
  SET_INVOICE_LINE_USE_OPERATOR_CATEGORIES,
  OPERATOR_CATEGORIES_FOR_INVOICE_CONFIG,
  UPDATE_OPERATOR_CATEGORY_INVOICE_CONFIG,
} from '../graphql/operations/service-invoice-prefix.operations';

export interface ServiceInvoicePrefix {
  id: string;
  macroCategory: string;
  prefix: string;
  /** Template descrizione riga fattura con segnaposto (null → composizione legacy). */
  template?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceLineSettings {
  id: string;
  /** true → descrizione riga per categoria operatore (sottocategorie). */
  useOperatorCategories: boolean;
  updatedAt: string;
}

export interface OperatorCategoryInvoiceConfig {
  id: string;
  macroCategory: string;
  name: string;
  isActive: boolean;
  invoiceLineDescription?: string | null;
  invoicePrefix?: string | null;
  invoiceTemplate?: string | null;
}

@Injectable({ providedIn: 'root' })
export class ServiceInvoicePrefixService extends BaseGraphQLService {
  constructor(injector: Injector) {
    super(injector);
  }

  getAll(): Observable<ServiceInvoicePrefix[]> {
    return this.query<{ serviceInvoicePrefixes: ServiceInvoicePrefix[] }>(
      SERVICE_INVOICE_PREFIXES,
    ).pipe(map(r => r?.serviceInvoicePrefixes ?? []));
  }

  upsert(macroCategory: string, prefix: string, template?: string | null): Observable<ServiceInvoicePrefix> {
    return this.mutate<{ upsertServiceInvoicePrefix: ServiceInvoicePrefix }>(
      UPSERT_SERVICE_INVOICE_PREFIX,
      { input: { macroCategory, prefix, template } },
    ).pipe(map(r => r.upsertServiceInvoicePrefix));
  }

  getSettings(): Observable<InvoiceLineSettings> {
    return this.query<{ invoiceLineSettings: InvoiceLineSettings }>(
      INVOICE_LINE_SETTINGS,
    ).pipe(map(r => r.invoiceLineSettings));
  }

  setUseOperatorCategories(useOperatorCategories: boolean): Observable<InvoiceLineSettings> {
    return this.mutate<{ setInvoiceLineUseOperatorCategories: InvoiceLineSettings }>(
      SET_INVOICE_LINE_USE_OPERATOR_CATEGORIES,
      { useOperatorCategories },
    ).pipe(map(r => r.setInvoiceLineUseOperatorCategories));
  }

  getOperatorCategoriesForConfig(): Observable<OperatorCategoryInvoiceConfig[]> {
    return this.query<{ operatorCategories: OperatorCategoryInvoiceConfig[] }>(
      OPERATOR_CATEGORIES_FOR_INVOICE_CONFIG,
    ).pipe(map(r => r?.operatorCategories ?? []));
  }

  updateOperatorCategoryConfig(
    id: string,
    invoicePrefix: string | null,
    invoiceTemplate: string | null,
  ): Observable<OperatorCategoryInvoiceConfig> {
    return this.mutate<{ updateOperatorCategory: OperatorCategoryInvoiceConfig }>(
      UPDATE_OPERATOR_CATEGORY_INVOICE_CONFIG,
      { id, invoicePrefix, invoiceTemplate },
    ).pipe(map(r => r.updateOperatorCategory));
  }
}
