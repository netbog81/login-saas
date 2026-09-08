import { Resolver, Query, Mutation, Args, ID, ObjectType, Field, Int } from '@nestjs/graphql';
import { UseGuards, Logger } from '@nestjs/common';
import { TenantContextService } from '@curandis/tenant-datasource';
import { PatientCalendarFeedService } from '../services/patient-calendar-feed.service';
import {
  PatientCalendarFeed,
  PatientCalendarFeedRevokedBy,
} from '../entities/patient-calendar-feed.entity';
import {
  AuthorizationGuard,
  RequirePermissions,
} from '../../users/guards/authorization.guard';
import { RegistryClient } from '../../registry/registry.client';

/**
 * Stato della sottoscrizione di un paziente, come lo vede la segreteria.
 *
 * Il token NON compare: esce solo dentro l'URL che si manda al paziente. Farlo
 * viaggiare come campo di una query significherebbe ritrovarselo nella cache
 * Apollo del browser e nei log del frontend.
 */
@ObjectType()
export class PatientCalendarFeedStatus {
  @Field(() => ID)
  patientId: string;

  /** Nessuna sottoscrizione mai creata per questo paziente. */
  @Field()
  exists: boolean;

  @Field()
  active: boolean;

  /** Quando è partita la mail col link. */
  @Field({ nullable: true })
  emailSentAt?: Date;

  @Field({ nullable: true })
  emailSentTo?: string;

  /**
   * Quando un'app di calendario ha scaricato il feed per la prima volta: è
   * l'unico dato che dice che il paziente l'ha DAVVERO nel telefono. Null con
   * `emailSentAt` valorizzato significa "link mandato, mai usato" — magari è
   * finito nello spam.
   */
  @Field({ nullable: true })
  subscribedAt?: Date;

  @Field({ nullable: true })
  lastAccessAt?: Date;

  @Field({ nullable: true })
  revokedAt?: Date;

  /** `patient` (dal link nella mail), `staff` o `system` (revoca in blocco). */
  @Field({ nullable: true })
  revokedBy?: string;
}

/** Riga del prospetto in amministrazione: come sopra, più il nome. */
@ObjectType()
export class PatientCalendarFeedRow extends PatientCalendarFeedStatus {
  /** Risolto dal registry al volo: il clinico non conserva le anagrafiche. */
  @Field({ nullable: true })
  patientName?: string;

  @Field()
  createdAt: Date;
}

@Resolver()
export class PatientCalendarFeedResolver {
  private readonly logger = new Logger(PatientCalendarFeedResolver.name);

  constructor(
    private readonly feedService: PatientCalendarFeedService,
    private readonly tenantContext: TenantContextService,
    private readonly registryClient: RegistryClient,
  ) {}

  // ==================== SCHEDA PAZIENTE ====================

  @Query(() => PatientCalendarFeedStatus, { name: 'patientCalendarFeed' })
  @UseGuards(AuthorizationGuard)
  @RequirePermissions('patient_read')
  async status(
    @Args('patientId', { type: () => ID }) patientId: string,
  ): Promise<PatientCalendarFeedStatus> {
    const feed = await this.feedService.findByPatient(patientId);
    return this.toStatus(patientId, feed);
  }

  /**
   * Manda (o rimanda) al paziente la mail col link del calendario.
   *
   * Rimandare NON rigenera il token: chi l'aveva già sottoscritto continua a
   * vedere lo stesso calendario, e chi non l'aveva fatto riceve un link che
   * funziona. Rigenerare romperebbe la sottoscrizione di chi l'ha già fatta,
   * che è esattamente chi non ha bisogno del rinvio.
   */
  @Mutation(() => Boolean, { name: 'sendPatientCalendarFeedLink' })
  @UseGuards(AuthorizationGuard)
  @RequirePermissions('patient_write')
  async sendLink(
    @Args('patientId', { type: () => ID }) patientId: string,
    @Args('email', { nullable: true }) email?: string,
  ): Promise<boolean> {
    // Il nome lo risolve il servizio, nella stessa lettura da cui prende
    // l'indirizzo: qui non serve una seconda chiamata al registry.
    await this.feedService.sendInviteEmail(patientId, { email: email?.trim() || undefined });
    return true;
  }

  @Mutation(() => Boolean, { name: 'revokePatientCalendarFeed' })
  @UseGuards(AuthorizationGuard)
  @RequirePermissions('patient_write')
  async revoke(
    @Args('patientId', { type: () => ID }) patientId: string,
  ): Promise<boolean> {
    await this.feedService.revoke(patientId, PatientCalendarFeedRevokedBy.STAFF);
    return true;
  }

  // ==================== AMMINISTRAZIONE ====================

  /**
   * Tutte le sottoscrizioni con il loro stato: mandate, attive davvero,
   * revocate e da chi. Risponde alla domanda che conta — quanti pazienti
   * stanno usando la funzione, non a quanti abbiamo mandato la mail.
   */
  @Query(() => [PatientCalendarFeedRow], { name: 'patientCalendarFeeds' })
  @UseGuards(AuthorizationGuard)
  @RequirePermissions('settings_manage')
  async all(): Promise<PatientCalendarFeedRow[]> {
    const feeds = await this.feedService.findAll();
    const names = await this.resolveNames(feeds.map((f) => f.patientId));

    return feeds.map((feed) => ({
      ...this.toStatus(feed.patientId, feed),
      patientName: names.get(feed.patientId),
      createdAt: feed.createdAt,
    }));
  }

  @Mutation(() => Int, { name: 'revokeAllPatientCalendarFeeds' })
  @UseGuards(AuthorizationGuard)
  @RequirePermissions('settings_manage')
  async revokeAll(): Promise<number> {
    return this.feedService.revokeAll();
  }

  @Mutation(() => Int, { name: 'revokeStalePatientCalendarFeeds' })
  @UseGuards(AuthorizationGuard)
  @RequirePermissions('settings_manage')
  async revokeStale(): Promise<number> {
    return this.feedService.revokeWithoutFutureAppointments();
  }

  // ==================== SUPPORTO ====================

  private toStatus(
    patientId: string,
    feed: PatientCalendarFeed | null,
  ): PatientCalendarFeedStatus {
    if (!feed) {
      return { patientId, exists: false, active: false };
    }
    return {
      patientId,
      exists: true,
      active: feed.enabled,
      emailSentAt: feed.emailSentAt,
      emailSentTo: feed.emailSentTo,
      subscribedAt: feed.firstAccessAt,
      lastAccessAt: feed.lastAccessAt,
      revokedAt: feed.revokedAt,
      revokedBy: feed.revokedBy,
    };
  }

  /**
   * Nomi dei pazienti dal registry, in blocco.
   *
   * Best-effort: se il registry non risponde il prospetto esce comunque, con
   * gli id al posto dei nomi. Meglio un elenco senza nomi che nessun elenco.
   */
  private async resolveNames(patientIds: string[]): Promise<Map<string, string>> {
    const names = new Map<string, string>();
    const unique = Array.from(new Set(patientIds));
    if (unique.length === 0) return names;

    const tenantAlias = this.tenantContext.getTenantAlias();
    if (!tenantAlias) return names;

    try {
      const subjects = await this.registryClient.bulkSubjectsAsService(unique, tenantAlias);
      for (const subject of subjects) {
        if (!subject) continue;
        names.set(subject.id, `${subject.firstName ?? ''} ${subject.lastName ?? ''}`.trim());
      }
    } catch (err) {
      this.logger.warn(`Lettura nomi dal registry fallita: ${(err as Error).message}`);
    }

    return names;
  }

}
