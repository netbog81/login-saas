import { Injectable, Injector } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { BaseGraphQLService } from '../core/services/base-graphql.service';
import {
  SERVICE_INVOICE_PREFIXES,
  UPSERT_SERVICE_INVOICE_PREFIX,
} from '../graphql/operations/service-invoice-prefix.operations';

export interface ServiceInvoicePrefix {
  id: string;
  macroCategory: string;
  prefix: string;
  createdAt: string;
  updatedAt: string;
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

  upsert(macroCategory: string, prefix: string): Observable<ServiceInvoicePrefix> {
    return this.mutate<{ upsertServiceInvoicePrefix: ServiceInvoicePrefix }>(
      UPSERT_SERVICE_INVOICE_PREFIX,
      { input: { macroCategory, prefix } },
    ).pipe(map(r => r.upsertServiceInvoicePrefix));
  }
}
