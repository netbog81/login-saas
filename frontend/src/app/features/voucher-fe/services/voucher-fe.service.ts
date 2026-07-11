import { Injectable, Injector } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { BaseGraphQLService } from '../../../core/services/base-graphql.service';
import { VoucherFe } from '../models/voucher-fe.model';
import {
  VOUCHERS_FE_BY_PATIENT_MANAGE,
  ALL_VOUCHERS_FE_MANAGE,
  ISSUE_VOUCHER_FE_MANAGE,
  UPDATE_VOUCHER_FE_AMOUNT_MANAGE,
  SUSPEND_VOUCHER_FE_MANAGE,
  REACTIVATE_VOUCHER_FE_MANAGE,
  CANCEL_VOUCHER_FE_MANAGE,
} from '../graphql/voucher-fe.operations';

/**
 * Servizio della gestione Voucher FE (elenco per paziente, emissione,
 * modifica importo, sospensione/riattivazione/annullamento, statistiche).
 */
@Injectable({ providedIn: 'root' })
export class VoucherFeService extends BaseGraphQLService {
  constructor(injector: Injector) {
    super(injector);
  }

  vouchersByPatient(patientId: string): Observable<VoucherFe[]> {
    return this.query<{ vouchersFeByPatient: VoucherFe[] }>(
      VOUCHERS_FE_BY_PATIENT_MANAGE,
      { patientId },
    ).pipe(map((r) => r.vouchersFeByPatient ?? []));
  }

  allVouchers(from?: string, to?: string): Observable<VoucherFe[]> {
    return this.query<{ allVouchersFe: VoucherFe[] }>(
      ALL_VOUCHERS_FE_MANAGE,
      { from: from ?? null, to: to ?? null },
    ).pipe(map((r) => r.allVouchersFe ?? []));
  }

  issue(
    patientId: string,
    initialAmount: number,
    expiryDate?: string,
    notes?: string,
  ): Observable<VoucherFe> {
    return this.mutate<{ issueVoucherFe: VoucherFe }>(ISSUE_VOUCHER_FE_MANAGE, {
      patientId,
      initialAmount,
      expiryDate: expiryDate ?? null,
      notes: notes ?? null,
    }).pipe(map((r) => r.issueVoucherFe));
  }

  updateAmount(voucherFeId: string, amount: number): Observable<VoucherFe> {
    return this.mutate<{ updateVoucherFeAmount: VoucherFe }>(
      UPDATE_VOUCHER_FE_AMOUNT_MANAGE,
      { voucherFeId, amount },
    ).pipe(map((r) => r.updateVoucherFeAmount));
  }

  suspend(voucherFeId: string): Observable<VoucherFe> {
    return this.mutate<{ suspendVoucherFe: VoucherFe }>(
      SUSPEND_VOUCHER_FE_MANAGE,
      { voucherFeId },
    ).pipe(map((r) => r.suspendVoucherFe));
  }

  reactivate(voucherFeId: string): Observable<VoucherFe> {
    return this.mutate<{ reactivateVoucherFe: VoucherFe }>(
      REACTIVATE_VOUCHER_FE_MANAGE,
      { voucherFeId },
    ).pipe(map((r) => r.reactivateVoucherFe));
  }

  cancel(voucherFeId: string): Observable<VoucherFe> {
    return this.mutate<{ cancelVoucherFe: VoucherFe }>(
      CANCEL_VOUCHER_FE_MANAGE,
      { voucherFeId },
    ).pipe(map((r) => r.cancelVoucherFe));
  }
}
