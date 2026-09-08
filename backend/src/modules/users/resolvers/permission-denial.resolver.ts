import {
  Resolver, Query, Args, Int, ID, ObjectType, Field,
} from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { PermissionDenial } from '../entities/permission-denial.entity';
import { PermissionDenialService } from '../services/permission-denial.service';
import { AuthorizationGuard, RequirePermissions } from '../guards/authorization.guard';

/** Dove ha sbattuto: una singola operazione e quante volte. */
@ObjectType()
export class PermissionDenialOperation {
  @Field()
  operation: string;

  @Field(() => Int)
  count: number;
}

/**
 * Un utente contro un permesso: quante volte, l'ultima volta, e da dove.
 *
 * Aggregato e non elenco piatto perché la domanda vera non è «quali richieste
 * sono state rifiutate» ma «chi non riesce a fare cosa»: 17 righe uguali di
 * fila sono una persona bloccata, non diciassette problemi.
 */
@ObjectType()
export class PermissionDenialSummary {
  @Field(() => ID, { nullable: true })
  appUserId?: string;

  @Field({ nullable: true })
  keycloakId?: string;

  @Field({ nullable: true })
  email?: string;

  @Field()
  permission: string;

  /** `missing_permission` oppure `user_not_found`. */
  @Field()
  reason: string;

  @Field(() => Int)
  count: number;

  @Field()
  lastOccurredAt: Date;

  @Field(() => [PermissionDenialOperation])
  operations: PermissionDenialOperation[];
}

/**
 * Lo storico degli accessi negati.
 *
 * Sotto `user_manage`: dice chi ha provato a fare cosa, ed è materiale da
 * amministrazione, non da bacheca.
 */
@Resolver()
export class PermissionDenialResolver {
  constructor(private readonly denials: PermissionDenialService) {}

  @Query(() => [PermissionDenialSummary], { name: 'permissionDenialSummary' })
  @UseGuards(AuthorizationGuard)
  @RequirePermissions('user_manage')
  async summary(
    @Args('days', { type: () => Int, defaultValue: 7 }) days: number,
  ): Promise<PermissionDenialSummary[]> {
    return this.denials.summary(this.clampDays(days));
  }

  @Query(() => [PermissionDenial], { name: 'permissionDenials' })
  @UseGuards(AuthorizationGuard)
  @RequirePermissions('user_manage')
  async recent(
    @Args('days', { type: () => Int, defaultValue: 7 }) days: number,
    @Args('limit', { type: () => Int, defaultValue: 200 }) limit: number,
  ): Promise<PermissionDenial[]> {
    return this.denials.recent(this.clampDays(days), Math.min(Math.max(limit, 1), 1000));
  }

  /** Oltre la retention non c'è niente da leggere: chiedere 3650 giorni è un refuso. */
  private clampDays(days: number): number {
    return Math.min(Math.max(days, 1), 90);
  }
}
