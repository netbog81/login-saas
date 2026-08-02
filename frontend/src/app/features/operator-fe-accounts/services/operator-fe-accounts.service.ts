import { Injectable, Injector } from '@angular/core';
import { Observable, map } from 'rxjs';

import { BaseGraphQLService } from '../../../core/services/base-graphql.service';
import {
  FeOperator,
  GenerateFeSettlementsInput,
  OperatorFeAccountSettings,
  OperatorFeAnalysis,
  OperatorFeSettlement,
  PatchFeSettlementInput,
} from '../models/operator-fe-accounts.model';
import {
  BULK_DELETE_OPERATOR_FE_SETTLEMENTS,
  GENERATE_OPERATOR_FE_SETTLEMENTS,
  GET_OPERATOR_FE_ACCOUNT_SETTINGS,
  GET_OPERATOR_FE_ANALYSIS,
  GET_OPERATOR_FE_SETTLEMENT,
  GET_OPERATOR_FE_SETTLEMENTS,
  GET_OPERATORS_FOR_FE_ACCOUNTS,
  PATCH_OPERATOR_FE_SETTLEMENT,
  UPDATE_OPERATOR_FE_ACCOUNT_SETTINGS,
} from '../graphql/operator-fe-accounts.operations';

/**
 * CONTI FE — Layer 3 (business + GraphQL). Mirror del service REST dei
 * Conti operatori dell'accounting, su GraphQL clinico.
 */
@Injectable({ providedIn: 'root' })
export class OperatorFeAccountsService extends BaseGraphQLService {
  constructor(injector: Injector) {
    super(injector);
  }

  operators(): Observable<FeOperator[]> {
    return this.query<{ operators: FeOperator[] }>(
      GET_OPERATORS_FOR_FE_ACCOUNTS,
    ).pipe(map((r) => r.operators));
  }

  analysis(
    from: string,
    to: string,
    operatorAppUserIds?: string[],
  ): Observable<OperatorFeAnalysis[]> {
    return this.query<{ operatorFeAnalysis: OperatorFeAnalysis[] }>(
      GET_OPERATOR_FE_ANALYSIS,
      {
        from,
        to,
        operatorAppUserIds: operatorAppUserIds?.length
          ? operatorAppUserIds
          : undefined,
      },
    ).pipe(map((r) => r.operatorFeAnalysis));
  }

  settlements(operatorAppUserId?: string): Observable<OperatorFeSettlement[]> {
    return this.query<{ operatorFeSettlements: OperatorFeSettlement[] }>(
      GET_OPERATOR_FE_SETTLEMENTS,
      { operatorAppUserId: operatorAppUserId || undefined },
    ).pipe(map((r) => r.operatorFeSettlements));
  }

  settlementById(id: string): Observable<OperatorFeSettlement | null> {
    return this.query<{ operatorFeSettlement: OperatorFeSettlement | null }>(
      GET_OPERATOR_FE_SETTLEMENT,
      { id },
    ).pipe(map((r) => r.operatorFeSettlement));
  }

  settings(): Observable<OperatorFeAccountSettings> {
    return this.query<{ operatorFeAccountSettings: OperatorFeAccountSettings }>(
      GET_OPERATOR_FE_ACCOUNT_SETTINGS,
    ).pipe(map((r) => r.operatorFeAccountSettings));
  }

  updateSettings(
    input: OperatorFeAccountSettings,
  ): Observable<OperatorFeAccountSettings> {
    return this.mutate<{
      updateOperatorFeAccountSettings: OperatorFeAccountSettings;
    }>(UPDATE_OPERATOR_FE_ACCOUNT_SETTINGS, { input }).pipe(
      map((r) => r.updateOperatorFeAccountSettings),
    );
  }

  generate(
    input: GenerateFeSettlementsInput,
  ): Observable<OperatorFeSettlement[]> {
    return this.mutate<{
      generateOperatorFeSettlements: OperatorFeSettlement[];
    }>(GENERATE_OPERATOR_FE_SETTLEMENTS, { input }).pipe(
      map((r) => r.generateOperatorFeSettlements),
    );
  }

  patchSettlement(
    id: string,
    input: PatchFeSettlementInput,
  ): Observable<OperatorFeSettlement> {
    return this.mutate<{ patchOperatorFeSettlement: OperatorFeSettlement }>(
      PATCH_OPERATOR_FE_SETTLEMENT,
      { id, input },
    ).pipe(map((r) => r.patchOperatorFeSettlement));
  }

  bulkDeleteSettlements(
    ids: string[],
  ): Observable<{ deleted: number; skippedPaid: number }> {
    return this.mutate<{
      bulkDeleteOperatorFeSettlements: { deleted: number; skippedPaid: number };
    }>(BULK_DELETE_OPERATOR_FE_SETTLEMENTS, { ids }).pipe(
      map((r) => r.bulkDeleteOperatorFeSettlements),
    );
  }
}
