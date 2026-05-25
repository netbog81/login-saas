import { Injectable, Injector } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { gql } from '@apollo/client/core';

import { BaseGraphQLService } from '../../../../core/services/base-graphql.service';

export interface DlqQueueStatus {
  name: string;
  messageCount: number;
  reachable: boolean;
  errorMessage?: string | null;
}

export interface DlqStatus {
  healthy: boolean;
  totalMessages: number;
  queues: DlqQueueStatus[];
  checkedAt: string;
}

const DLQ_STATUS_QUERY = gql`
  query DlqStatus {
    dlqStatus {
      healthy
      totalMessages
      queues {
        name
        messageCount
        reachable
        errorMessage
      }
      checkedAt
    }
  }
`;

@Injectable({ providedIn: 'root' })
export class DlqMonitorClientService extends BaseGraphQLService {
  constructor(injector: Injector) {
    super(injector);
  }

  getStatus(): Observable<DlqStatus> {
    return this.query<{ dlqStatus: DlqStatus }>(DLQ_STATUS_QUERY).pipe(
      map((r) => r.dlqStatus),
    );
  }
}
