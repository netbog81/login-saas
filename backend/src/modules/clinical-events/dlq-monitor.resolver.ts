import { Field, ObjectType, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';

import { DlqMonitorService, DlqStatus } from './dlq-monitor.service';
import {
  AuthorizationGuard,
  RequirePermissions,
} from '../users/guards/authorization.guard';

// ============================================================================
// GraphQL types
// ============================================================================

@ObjectType({ description: 'Stato di una singola coda DLQ monitorata.' })
class DlqQueueStatusGql {
  @Field()
  name!: string;

  @Field()
  messageCount!: number;

  @Field()
  reachable!: boolean;

  @Field({ nullable: true })
  errorMessage?: string;
}

@ObjectType({
  description:
    'Snapshot stato delle DLQ accounting↔clinico per widget admin. ' +
    'healthy=true significa zero messaggi pending e tutte le code raggiungibili.',
})
class DlqStatusGql {
  @Field()
  healthy!: boolean;

  @Field()
  totalMessages!: number;

  @Field(() => [DlqQueueStatusGql])
  queues!: DlqQueueStatusGql[];

  @Field()
  checkedAt!: Date;
}

// ============================================================================
// Resolver
// ============================================================================

/**
 * Sessione 7 — Espone `dlqStatus` per widget admin frontend.
 * Permesso: `settings_manage` (admin). Niente dati sensibili — solo
 * contatori — ma manteniamo guard per non esporre info infrastruttura
 * a utenti non-admin.
 */
@Resolver()
export class DlqMonitorResolver {
  constructor(private readonly dlqMonitor: DlqMonitorService) {}

  @Query(() => DlqStatusGql, { name: 'dlqStatus' })
  @UseGuards(AuthorizationGuard)
  @RequirePermissions('settings_manage')
  async dlqStatus(): Promise<DlqStatus> {
    return this.dlqMonitor.getStatus();
  }
}
