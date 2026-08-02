import { Injectable, Injector } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { BaseGraphQLService } from '../../../../core/services/base-graphql.service';
import {
  RECYCLE_BIN_QUERY,
  RECYCLE_BIN_SETTINGS_QUERY,
  RESTORE_FROM_RECYCLE_BIN,
  PURGE_FROM_RECYCLE_BIN,
  EMPTY_RECYCLE_BIN,
  UPDATE_RECYCLE_BIN_SETTINGS,
} from '../../../../graphql/operations/recycle-bin.operations';

export type RecycleBinEntityType =
  | 'therapeutic_path'
  | 'treatment'
  | 'patient_evaluation'
  | 'patient_document';

export interface RecycleBinItem {
  id: string;
  entityType: RecycleBinEntityType;
  title: string;
  subtitle?: string | null;
  deletedAt: string;
  deletedByUserId?: string | null;
  deletedByName?: string | null;
  ownerUserId?: string | null;
  ownerName?: string | null;
  scheduledPurgeAt?: string | null;
  childrenCount?: number | null;
}

export interface RecycleBinSettings {
  id: string;
  retentionDays: number | null;
  updatedAt: string;
  updatedByUserId?: string | null;
}

export interface RecycleBinFilter {
  entityTypes?: RecycleBinEntityType[];
  ownerUserId?: string;
  search?: string;
}

@Injectable({ providedIn: 'root' })
export class RecycleBinService extends BaseGraphQLService {
  constructor(injector: Injector) {
    super(injector);
  }

  list(filter: RecycleBinFilter = {}): Observable<RecycleBinItem[]> {
    return this.query<{ recycleBin: RecycleBinItem[] }>(
      RECYCLE_BIN_QUERY,
      { filter },
    ).pipe(map(r => r.recycleBin));
  }

  getSettings(): Observable<RecycleBinSettings> {
    return this.query<{ recycleBinSettings: RecycleBinSettings }>(
      RECYCLE_BIN_SETTINGS_QUERY,
    ).pipe(map(r => r.recycleBinSettings));
  }

  restore(
    entityType: RecycleBinEntityType,
    id: string,
  ): Observable<boolean> {
    return this.mutate<{ restoreFromRecycleBin: boolean }>(
      RESTORE_FROM_RECYCLE_BIN,
      { entityType, id },
    ).pipe(map(r => r.restoreFromRecycleBin));
  }

  purge(
    entityType: RecycleBinEntityType,
    id: string,
  ): Observable<boolean> {
    return this.mutate<{ purgeFromRecycleBin: boolean }>(
      PURGE_FROM_RECYCLE_BIN,
      { entityType, id },
    ).pipe(map(r => r.purgeFromRecycleBin));
  }

  /**
   * @param force - se true, svuota tutto il cestino ignorando la retention.
   *   Default: false (applica la retention configurata).
   */
  empty(force = false): Observable<number> {
    return this.mutate<{ emptyRecycleBin: number }>(
      EMPTY_RECYCLE_BIN,
      { force },
    ).pipe(map(r => r.emptyRecycleBin));
  }

  updateSettings(retentionDays: number | null): Observable<RecycleBinSettings> {
    return this.mutate<{ updateRecycleBinSettings: RecycleBinSettings }>(
      UPDATE_RECYCLE_BIN_SETTINGS,
      { retentionDays },
    ).pipe(map(r => r.updateRecycleBinSettings));
  }
}
