import { Injectable, Injector } from '@angular/core';
import { Observable, map } from 'rxjs';
import { BaseGraphQLService } from '../core/services/base-graphql.service';
import { WaitingListEntry, WaitingListStatus, CreateWaitingListEntryInput, UpdateWaitingListEntryInput } from '../models/waiting-list.model';
import { GET_WAITING_LIST_ENTRIES } from '../graphql/operations/waiting-list.queries';
import {
  CREATE_WAITING_LIST_ENTRY,
  UPDATE_WAITING_LIST_ENTRY,
  DELETE_WAITING_LIST_ENTRY,
  REORDER_WAITING_LIST,
} from '../graphql/operations/waiting-list.mutations';

@Injectable({
  providedIn: 'root',
})
export class WaitingListService extends BaseGraphQLService {
  constructor(injector: Injector) {
    super(injector);
  }

  getEntries(status?: WaitingListStatus): Observable<WaitingListEntry[]> {
    return this.query<{ waitingListEntries: WaitingListEntry[] }>(
      GET_WAITING_LIST_ENTRIES,
      status ? { status } : undefined
    ).pipe(map((result) => result.waitingListEntries || []));
  }

  createEntry(input: CreateWaitingListEntryInput): Observable<WaitingListEntry> {
    return this.mutate<{ createWaitingListEntry: WaitingListEntry }>(
      CREATE_WAITING_LIST_ENTRY,
      { input },
      [{ query: GET_WAITING_LIST_ENTRIES }]
    ).pipe(map((result) => result.createWaitingListEntry));
  }

  updateEntry(id: string, input: UpdateWaitingListEntryInput): Observable<WaitingListEntry> {
    return this.mutate<{ updateWaitingListEntry: WaitingListEntry }>(
      UPDATE_WAITING_LIST_ENTRY,
      { id, input }
    ).pipe(map((result) => result.updateWaitingListEntry));
  }

  deleteEntry(id: string): Observable<boolean> {
    return this.mutate<{ deleteWaitingListEntry: boolean }>(
      DELETE_WAITING_LIST_ENTRY,
      { id },
      [{ query: GET_WAITING_LIST_ENTRIES }]
    ).pipe(map((result) => result.deleteWaitingListEntry));
  }

  reorderEntries(entries: { id: string; position: number }[]): Observable<WaitingListEntry[]> {
    return this.mutate<{ reorderWaitingList: WaitingListEntry[] }>(
      REORDER_WAITING_LIST,
      { input: { entries } }
    ).pipe(map((result) => result.reorderWaitingList));
  }
}
