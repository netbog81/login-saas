import { Resolver, Query, Mutation, Args, ID, Int, ResolveField, Parent, registerEnumType } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { Treatment, TreatmentStatus } from '../entities/treatment.entity';
import { TreatmentService as TreatmentServiceEntity } from '../entities/treatment-service.entity';
import { TreatmentInvoiceLine } from '../entities/treatment-invoice-line.entity';
import { PatientModel } from '../../../patients/models/patient.model';
import { TreatmentService } from '../services/treatment.service';
import {
  CompleteTreatmentInput,
  CloseTreatmentInput,
  RecordPaymentInput,
  TreatmentInstrumentInput,
  UpdateTreatmentInput,
  UpdateTreatmentBySecretaryInput,
  UpdateTreatmentServiceInvoiceDescriptionInput,
  CreateTreatmentInvoiceLineInput,
  UpdateTreatmentInvoiceLineInput,
} from '../dto/treatment.input';
import {
  AuthorizationGuard,
  RequirePermissions,
} from '../../users/guards/authorization.guard';
import { AppUserService } from '../../users/services/app-user.service';
import {
  CurrentUser,
  CurrentUserContext,
} from '../../users/decorators/current-user.decorator';
import { OwnershipGuard, RequireOwnership } from '../guards/ownership.guard';
import { TenantContextService } from '@curandis/tenant-datasource';

/**
 * Ruolo del chiamante per le mutation soggette ad autorizzazione
 * per categoria operatore (es. recordTreatmentPayment).
 * TODO: rimuovere quando il ruolo sarà letto dal JWT sul server.
 */
export enum TreatmentCallerRole {
  OPERATOR = 'operator',
  SECRETARY = 'secretary',
}

registerEnumType(TreatmentCallerRole, { name: 'TreatmentCallerRole' });

@Resolver(() => Treatment)
export class TreatmentResolver {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly treatmentService: TreatmentService,
    private readonly appUserService: AppUserService,
  ){}

  /** DataSource del tenant corrente (AsyncLocalStorage). */
  private get dataSource() {
    const ds = this.tenantContext.getDataSource();
    if (!ds) throw new Error('No tenant DataSource in current request context');
    return ds;
  }

  private get treatmentServiceRepo() { return this.dataSource.getRepository(TreatmentServiceEntity); }

  /**
   * Risolve l'id `AppUser` (owner del record) dal keycloak sub nel
   * tenantContext. Ritorna undefined se la risoluzione fallisce: in tal
   * caso l'ownership non viene tracciata — i guard downstream bloccheranno
   * comunque operazioni che richiedono l'ownership.
   */
  private async resolveAppUserId(
    user: CurrentUserContext | undefined,
  ): Promise<string | undefined> {
    if (!user?.userId) return undefined;
    const appUser = await this.appUserService.findByKeycloakId(user.userId);
    return appUser?.id;
  }

  /**
   * ResolveField: Risolve treatmentServices per un trattamento
   * Caricamento separato per evitare dipendenze circolari TypeORM
   */
  @ResolveField(() => [TreatmentServiceEntity], { nullable: true })
  async treatmentServices(
    @Parent() treatment: Treatment,
  ): Promise<TreatmentServiceEntity[]> {
    return this.treatmentServiceRepo.find({
      where: { treatmentId: treatment.id },
      relations: ['service'],
      order: { orderPosition: 'ASC' },
    });
  }

  /**
   * ResolveField: shell `Patient { id }` da `patientId`. I campi del subject
   * (firstName, lastName, ecc.) vengono risolti dal PatientResolver via
   * RegistrySubjectLoader (batch verso il registry).
   */
  @ResolveField(() => PatientModel, { nullable: true })
  patient(@Parent() treatment: Treatment): PatientModel | null {
    if (!treatment.patientId) return null;
    return { id: treatment.patientId } as PatientModel;
  }

  // ==================== QUERIES ====================

  /**
   * Query: Ottiene un trattamento per ID
   */
  @Query(() => Treatment, { name: 'treatment', nullable: true })
  async getTreatment(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<Treatment | null> {
    return this.treatmentService.findById(id);
  }

  /**
   * Query: Ottiene il trattamento associato a un appuntamento
   */
  @Query(() => Treatment, { name: 'treatmentByAppointment', nullable: true })
  async getTreatmentByAppointment(
    @Args('appointmentId', { type: () => ID }) appointmentId: string,
  ): Promise<Treatment | null> {
    return this.treatmentService.findByAppointmentId(appointmentId);
  }

  /**
   * Query batch: Trattamenti per più appuntamenti in una sola query.
   */
  @Query(() => [Treatment], { name: 'treatmentsByAppointments' })
  async getTreatmentsByAppointments(
    @Args('appointmentIds', { type: () => [ID] }) appointmentIds: string[],
  ): Promise<Treatment[]> {
    return this.treatmentService.findByAppointmentIds(appointmentIds);
  }

  /**
   * Query: Trattamenti in corso/completati per un operatore
   */
  @Query(() => [Treatment], { name: 'treatmentsByOperator' })
  async getTreatmentsByOperator(
    @Args('operatorId', { type: () => ID }) operatorId: string,
    @Args('date', { nullable: true }) date?: string,
  ): Promise<Treatment[]> {
    return this.treatmentService.getActiveByOperator(operatorId, date);
  }

  /**
   * Query bulk: Trattamenti attivi per più operatori in una data.
   */
  @Query(() => [Treatment], { name: 'treatmentsByOperators' })
  async getTreatmentsByOperators(
    @Args('operatorIds', { type: () => [ID] }) operatorIds: string[],
    @Args('date', { nullable: true }) date?: string,
  ): Promise<Treatment[]> {
    return this.treatmentService.getActiveByOperators(operatorIds, date);
  }

  /**
   * Query: Trattamenti in attesa di chiusura da parte della segreteria
   */
  @Query(() => [Treatment], { name: 'treatmentsPendingClosure' })
  async getTreatmentsPendingClosure(): Promise<Treatment[]> {
    return this.treatmentService.getPendingForSecretary();
  }

  /**
   * Query: Trattamenti di un paziente
   */
  @Query(() => [Treatment], { name: 'treatmentsByPatient' })
  async getTreatmentsByPatient(
    @Args('patientId', { type: () => ID }) patientId: string,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
    @Args('offset', { type: () => Int, nullable: true }) offset?: number,
  ): Promise<Treatment[]> {
    return this.treatmentService.getByPatient(patientId, limit, offset);
  }

  /**
   * Query: Trattamenti non fatturati al paziente
   */
  @Query(() => [Treatment], { name: 'treatmentsNotInvoicedToPatient' })
  async getTreatmentsNotInvoicedToPatient(
    @Args('dateFrom', { nullable: true }) dateFrom?: string,
    @Args('dateTo', { nullable: true }) dateTo?: string,
  ): Promise<Treatment[]> {
    return this.treatmentService.getNotInvoicedToPatient(dateFrom, dateTo);
  }

  /**
   * Query: Trattamenti non fatturati dall'operatore allo studio
   */
  @Query(() => [Treatment], { name: 'treatmentsNotInvoicedByOperator' })
  async getTreatmentsNotInvoicedByOperator(
    @Args('operatorId', { type: () => ID, nullable: true }) operatorId?: string,
    @Args('dateFrom', { nullable: true }) dateFrom?: string,
    @Args('dateTo', { nullable: true }) dateTo?: string,
  ): Promise<Treatment[]> {
    return this.treatmentService.getNotInvoicedByOperator(operatorId, dateFrom, dateTo);
  }

  /**
   * Query: Ottiene tutti i trattamenti
   */
  @Query(() => [Treatment], { name: 'getAllTreatments' })
  async getAllTreatments(): Promise<Treatment[]> {
    return this.treatmentService.findAll();
  }

  /**
   * Query: Trattamenti di un percorso terapeutico
   */
  @Query(() => [Treatment], { name: 'treatmentsByTherapeuticPath' })
  async getTreatmentsByTherapeuticPath(
    @Args('therapeuticPathId', { type: () => ID }) therapeuticPathId: string,
  ): Promise<Treatment[]> {
    return this.treatmentService.getByTherapeuticPath(therapeuticPathId);
  }

  // ==================== MUTATIONS ====================

  /**
   * Mutation: Crea un trattamento da un appuntamento (quando paziente arriva)
   */
  @Mutation(() => Treatment, { name: 'createTreatment' })
  @UseGuards(AuthorizationGuard)
  @RequirePermissions('treatment_create')
  async createTreatment(
    @Args('appointmentId', { type: () => ID }) appointmentId: string,
    @Args('therapeuticPathId', { type: () => ID }) therapeuticPathId: string,
    @Args('scontoFE', { type: () => Boolean, nullable: true, defaultValue: false }) scontoFE: boolean,
  ): Promise<Treatment> {
    return this.treatmentService.createFromAppointment(
      appointmentId,
      therapeuticPathId,
      scontoFE,
    );
  }

  /**
   * Mutation: Aggiorna un trattamento in corso
   */
  @Mutation(() => Treatment, { name: 'updateTreatment' })
  @UseGuards(AuthorizationGuard, OwnershipGuard)
  @RequirePermissions('treatment_write')
  @RequireOwnership({ resource: 'treatment', idArg: 'input.id' })
  async updateTreatment(
    @Args('input') input: UpdateTreatmentInput,
  ): Promise<Treatment> {
    return this.treatmentService.update(input);
  }

  /**
   * Mutation: Operatore completa il trattamento
   */
  @Mutation(() => Treatment, { name: 'completeTreatment' })
  @UseGuards(AuthorizationGuard, OwnershipGuard)
  @RequirePermissions('treatment_write')
  @RequireOwnership({ resource: 'treatment' })
  async completeTreatment(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: CompleteTreatmentInput,
  ): Promise<Treatment> {
    return this.treatmentService.complete(id, input);
  }

  /**
   * Mutation: Segreteria chiude il trattamento
   */
  @Mutation(() => Treatment, { name: 'closeTreatment' })
  @UseGuards(AuthorizationGuard)
  @RequirePermissions('treatment_write')
  async closeTreatment(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: CloseTreatmentInput,
    @CurrentUser() user?: CurrentUserContext,
  ): Promise<Treatment> {
    const closedByUserId = await this.resolveAppUserId(user);
    return this.treatmentService.close(id, input, closedByUserId);
  }

  /**
   * Mutation: Segreteria forza la chiusura di un trattamento rimasto
   * IN_PROGRESS (operatore dimentico). Transizione singola
   * IN_PROGRESS → CLOSED con audit `forcedClosure = true`.
   * Richiede il permesso `treatment_force_close`.
   */
  @Mutation(() => Treatment, { name: 'forceCloseTreatment' })
  @UseGuards(AuthorizationGuard)
  @RequirePermissions('treatment_force_close')
  async forceCloseTreatment(
    @Args('id', { type: () => ID }) id: string,
    @Args('secretaryNotes', { type: () => String, nullable: true })
    secretaryNotes: string | undefined,
    @CurrentUser() user: CurrentUserContext,
  ): Promise<Treatment> {
    const closedByUserId = await this.resolveAppUserId(user);
    if (!closedByUserId) {
      throw new Error(
        'forceCloseTreatment: impossibile risolvere AppUser per il chiamante',
      );
    }
    return this.treatmentService.forceCloseByOperatorForgot(
      id,
      closedByUserId,
      secretaryNotes,
    );
  }

  /**
   * Mutation: Riapre un trattamento completato (riporta a IN_PROGRESS)
   */
  /**
   * Mutation legacy: dispatcher tra reopenByOperator / reopenBySecretary
   * in base allo stato attuale. Non applica ownership perché ramifica in
   * due sotto-operazioni con regole di autorizzazione diverse. I client
   * nuovi dovrebbero chiamare esplicitamente `reopenTreatmentByOperator`
   * o `reopenTreatmentBySecretary`.
   * @deprecated Usa le mutation specifiche per stato.
   */
  @Mutation(() => Treatment, { name: 'reopenTreatment', deprecationReason: 'Usa reopenTreatmentByOperator o reopenTreatmentBySecretary' })
  @UseGuards(AuthorizationGuard)
  @RequirePermissions('treatment_write')
  async reopenTreatment(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<Treatment> {
    return this.treatmentService.reopen(id);
  }

  /**
   * Mutation: operatore riapre il proprio trattamento (OPERATOR_COMPLETED
   * → IN_PROGRESS). Ownership richiesta.
   */
  @Mutation(() => Treatment, { name: 'reopenTreatmentByOperator' })
  @UseGuards(AuthorizationGuard, OwnershipGuard)
  @RequirePermissions('treatment_write')
  @RequireOwnership({ resource: 'treatment' })
  async reopenTreatmentByOperator(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<Treatment> {
    return this.treatmentService.reopenByOperator(id);
  }

  /**
   * Mutation: segreteria riapre un trattamento CHIUSO per correggere dati
   * amministrativi (CLOSED → OPERATOR_COMPLETED). Permission-based.
   */
  @Mutation(() => Treatment, { name: 'reopenTreatmentBySecretary' })
  @UseGuards(AuthorizationGuard)
  @RequirePermissions('treatment_write')
  async reopenTreatmentBySecretary(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<Treatment> {
    return this.treatmentService.reopenBySecretary(id);
  }

  /**
   * Mutation: Registra pagamento del paziente.
   *
   * `callerRole`: indica se la chiamata arriva dall'interfaccia operatore
   * o da quella della segreteria. Se 'operator', l'operatore del
   * trattamento deve avere canCollectPayment=true; se 'secretary', passa
   * sempre. Default 'secretary' per retrocompatibilità.
   */
  @Mutation(() => Treatment, { name: 'recordTreatmentPayment' })
  async recordPayment(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: RecordPaymentInput,
    @Args('callerRole', { type: () => TreatmentCallerRole, nullable: true }) callerRole?: TreatmentCallerRole,
  ): Promise<Treatment> {
    return this.treatmentService.recordPayment(id, input, callerRole ?? TreatmentCallerRole.SECRETARY);
  }

  /**
   * Mutation: Marca trattamento come fatturato al paziente
   */
  @Mutation(() => Treatment, { name: 'markTreatmentInvoicedToPatient' })
  async markInvoicedToPatient(
    @Args('id', { type: () => ID }) id: string,
    @Args('invoiceNumber', { nullable: true }) invoiceNumber?: string,
  ): Promise<Treatment> {
    return this.treatmentService.markInvoicedToPatient(id, invoiceNumber);
  }

  /**
   * Mutation: Marca trattamento come fatturato dall'operatore allo studio
   */
  @Mutation(() => Treatment, { name: 'markTreatmentInvoicedByOperator' })
  async markInvoicedByOperator(
    @Args('id', { type: () => ID }) id: string,
    @Args('invoiceNumber', { nullable: true }) invoiceNumber?: string,
  ): Promise<Treatment> {
    return this.treatmentService.markInvoicedByOperator(id, invoiceNumber);
  }

  /**
   * Mutation: Aggiorna strumenti del trattamento
   */
  @Mutation(() => Treatment, { name: 'updateTreatmentInstruments' })
  @UseGuards(AuthorizationGuard, OwnershipGuard)
  @RequirePermissions('treatment_write')
  @RequireOwnership({ resource: 'treatment' })
  async updateInstruments(
    @Args('id', { type: () => ID }) id: string,
    @Args('instruments', { type: () => [TreatmentInstrumentInput] }) instruments: TreatmentInstrumentInput[],
  ): Promise<Treatment> {
    return this.treatmentService.updateInstruments(id, instruments);
  }

  /**
   * Mutation: Elimina un singolo trattamento
   */
  @Mutation(() => Boolean, { name: 'deleteTreatment' })
  @UseGuards(AuthorizationGuard, OwnershipGuard)
  @RequirePermissions('treatment_delete_own')
  @RequireOwnership({
    resource: 'treatment',
    bypassPermission: 'treatment_delete_any',
  })
  async deleteTreatment(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user?: CurrentUserContext,
  ): Promise<boolean> {
    const deletedByUserId = await this.resolveAppUserId(user);
    return this.treatmentService.delete(id, deletedByUserId);
  }

  /**
   * Mutation: cancella un trattamento dal punto di vista billing
   * (transition billingStatus → CANCELLED).
   *
   * Diversa da `deleteTreatment` (che è soft-delete generico). Questa è
   * specifica del flusso accounting: se il treatment è già stato
   * pubblicato (SENT/PENDING) emette `treatment.cancelled.<tenant>` per
   * informare l'accounting. Per stati post-INVOICED (incluso
   * PARTIALLY_REFUNDED/REFUNDED/REISSUED) la mutation rifiuta — lo
   * storno richiede nota di credito da accounting.
   *
   * Race condition (cancello dopo che accounting ha già fatturato):
   * gestita dal consumer accounting che pubblica
   * `billable.cancellation-rejected`, il cui handler nel clinico fa
   * rollback CANCELLED → INVOICED + alert (vedi accounting-event.consumer).
   */
  @Mutation(() => Treatment, { name: 'cancelTreatment' })
  @UseGuards(AuthorizationGuard, OwnershipGuard)
  @RequirePermissions('treatment_delete_own')
  @RequireOwnership({
    resource: 'treatment',
    bypassPermission: 'treatment_delete_any',
  })
  async cancelTreatment(
    @Args('id', { type: () => ID }) id: string,
    @Args('reason', { type: () => String }) reason: string,
    @CurrentUser() user?: CurrentUserContext,
  ): Promise<Treatment> {
    const cancelledByUserId = await this.resolveAppUserId(user);
    if (!cancelledByUserId) {
      throw new Error('cancelTreatment: cancelledByUserId non risolto da CurrentUser');
    }
    return this.treatmentService.cancelTreatment(id, cancelledByUserId, reason);
  }

  /**
   * Mutation: Sessione 7 — Richiama indietro un trattamento già inviato
   * a fatturazione per consentirne la modifica. Emette
   * `treatment.recall-requested` su accounting; risposta arriva async via
   * `billable.recall-accepted` (treatment → NOT_READY) o
   * `billable.recall-rejected` (popola `lastRecallRejectionMessage`).
   *
   * Permessi: stesso scope di `cancelTreatment` (delete own/any) — è
   * un'operazione equivalente per gravità (annulla un treatment già
   * fatturato).
   */
  @Mutation(() => Treatment, { name: 'requestTreatmentRecall' })
  @UseGuards(AuthorizationGuard, OwnershipGuard)
  @RequirePermissions('treatment_delete_own')
  @RequireOwnership({
    resource: 'treatment',
    bypassPermission: 'treatment_delete_any',
  })
  async requestTreatmentRecall(
    @Args('id', { type: () => ID }) id: string,
    @Args('reason', { type: () => String, nullable: true }) reason?: string,
  ): Promise<Treatment> {
    return this.treatmentService.requestTreatmentRecall(id, reason);
  }

  /**
   * Mutation: Sessione 7 — Forza re-invio di un treatment ad accounting.
   * Disponibile solo per treatment in stato SENT con readyForBillingAt
   * > 5 min fa (vedi service method per dettagli sul vincolo smart).
   *
   * Permessi: stesso scope di `setReadyForBilling` (write own/any). È un
   * recovery operator-side per treatment stuck: deve essere fattibile dalla
   * SEGRETERIA per qualunque treatment, non solo dall'operatore proprietario.
   * Niente OwnershipGuard.
   */
  @Mutation(() => Treatment, { name: 'resendTreatmentToAccounting' })
  @UseGuards(AuthorizationGuard)
  @RequirePermissions('treatment_write')
  async resendTreatmentToAccounting(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<Treatment> {
    return this.treatmentService.resendTreatmentToAccounting(id);
  }

  /**
   * Mutation: Sessione 7 — Chiude il banner "Restituito dall'amministrazione"
   * sul treatment. Setta `returnedFromAccountingDismissedAt = NOW`.
   */
  @Mutation(() => Treatment, { name: 'dismissReturnFromAccountingBanner' })
  @UseGuards(AuthorizationGuard, OwnershipGuard)
  @RequirePermissions('treatment_update_own')
  @RequireOwnership({
    resource: 'treatment',
    bypassPermission: 'treatment_update_any',
  })
  async dismissReturnFromAccountingBanner(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<Treatment> {
    return this.treatmentService.dismissReturnFromAccountingBanner(id);
  }

  /**
   * Mutation: Elimina TUTTI i trattamenti (operazione distruttiva)
   * Returns: numero di trattamenti eliminati
   */
  @Mutation(() => Int, { name: 'deleteAllTreatments' })
  @UseGuards(AuthorizationGuard)
  @RequirePermissions('treatment_delete_any')
  async deleteAllTreatments(): Promise<number> {
    return this.treatmentService.deleteAll();
  }

  // ==================== SECRETARY WORKFLOW ====================

  /**
   * Mutation: segreteria aggiorna campi economici di un trattamento
   * (OPERATOR_COMPLETED o CLOSED). Mai campi clinici.
   */
  @Mutation(() => Treatment, { name: 'updateTreatmentBySecretary' })
  async updateBySecretary(
    @Args('input') input: UpdateTreatmentBySecretaryInput,
  ): Promise<Treatment> {
    return this.treatmentService.updateBySecretary(input);
  }

  /**
   * Mutation: marca N trattamenti come pronti (o non pronti) per essere
   * inviati al sistema di fatturazione. Step separato dall'invio reale.
   */
  /**
   * Mutation: dismiss del billing alert su un treatment (sessione 6 Step 6.7).
   *
   * Setta `billingAlertDismissedAt = now`. Idempotente: se non c'è alert
   * o è già dismissato, no-op (return treatment invariato).
   *
   * Use case tipico: operatore legge un `cancellation-rejected` warning
   * (race condition: clinico ha cancellato un treatment che accounting
   * aveva già fatturato) e clicca "Letto" nella BillingSection. Il
   * messaggio resta in DB per audit, scompare dalla UI.
   */
  @Mutation(() => Treatment, { name: 'dismissBillingAlert' })
  async dismissBillingAlert(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<Treatment> {
    return this.treatmentService.dismissBillingAlert(id);
  }

  @Mutation(() => [Treatment], { name: 'setTreatmentsReadyForBilling' })
  async setReadyForBilling(
    @Args('ids', { type: () => [ID] }) ids: string[],
    @Args('ready', { type: () => Boolean }) ready: boolean,
    /**
     * Se true (con ready=true), il payload `treatment.closed.<tenant>` esce
     * con `requestImmediateInvoice=true` → AutoIssue accounting fatturazione
     * automatica (se mapping fiscalmente configurato). UX "Fattura subito + incassa".
     */
    @Args('immediateInvoice', { type: () => Boolean, nullable: true, defaultValue: false })
    immediateInvoice?: boolean,
  ): Promise<Treatment[]> {
    return this.treatmentService.setReadyForBilling(ids, ready, immediateInvoice ?? false);
  }

  /**
   * Mutation: aggiorna la descrizione riga fattura di un TreatmentService.
   */
  @Mutation(() => TreatmentServiceEntity, { name: 'updateTreatmentServiceInvoiceDescription' })
  async updateTreatmentServiceInvoiceDescription(
    @Args('input') input: UpdateTreatmentServiceInvoiceDescriptionInput,
  ): Promise<TreatmentServiceEntity> {
    return this.treatmentService.updateTreatmentServiceInvoiceDescription(
      input.treatmentServiceId,
      input.description,
    );
  }

  // ==================== INVOICE LINES (CUSTOM) ====================

  @Query(() => [TreatmentInvoiceLine], { name: 'treatmentInvoiceLines' })
  async getInvoiceLines(
    @Args('treatmentId', { type: () => ID }) treatmentId: string,
  ): Promise<TreatmentInvoiceLine[]> {
    return this.treatmentService.getInvoiceLinesByTreatment(treatmentId);
  }

  @Mutation(() => TreatmentInvoiceLine, { name: 'createTreatmentInvoiceLine' })
  async createInvoiceLine(
    @Args('input') input: CreateTreatmentInvoiceLineInput,
    @Args('createdBy', { type: () => ID, nullable: true }) createdBy?: string,
  ): Promise<TreatmentInvoiceLine> {
    return this.treatmentService.createInvoiceLine({
      treatmentId: input.treatmentId,
      description: input.description,
      amount: input.amount,
      createdBy,
    });
  }

  @Mutation(() => TreatmentInvoiceLine, { name: 'updateTreatmentInvoiceLine' })
  async updateInvoiceLine(
    @Args('input') input: UpdateTreatmentInvoiceLineInput,
  ): Promise<TreatmentInvoiceLine> {
    return this.treatmentService.updateInvoiceLine(input);
  }

  @Mutation(() => Boolean, { name: 'deleteTreatmentInvoiceLine' })
  async deleteInvoiceLine(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.treatmentService.deleteInvoiceLine(id);
  }

  // ==================== LISTING QUERIES ====================

  /**
   * Query per la segreteria/admin: elenca tutti i trattamenti con filtri.
   * Fragments (paziente, operatore, servizi, strumenti, righe custom)
   * caricati in un solo round trip.
   */
  @Query(() => [Treatment], { name: 'treatmentsForSecretary' })
  async treatmentsForSecretary(
    @Args('patientId', { type: () => ID, nullable: true }) patientId?: string,
    @Args('operatorId', { type: () => ID, nullable: true }) operatorId?: string,
    @Args('statuses', { type: () => [TreatmentStatus], nullable: true }) statuses?: TreatmentStatus[],
    @Args('dateFrom', { nullable: true }) dateFrom?: string,
    @Args('dateTo', { nullable: true }) dateTo?: string,
    @Args('readyForBilling', { nullable: true }) readyForBilling?: boolean,
    @Args('isInvoicedToPatient', { nullable: true }) isInvoicedToPatient?: boolean,
    @Args('scontoFE', { nullable: true }) scontoFE?: boolean,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
    @Args('offset', { type: () => Int, nullable: true }) offset?: number,
  ): Promise<Treatment[]> {
    return this.treatmentService.findForListing({
      patientId,
      operatorId,
      statuses,
      dateFrom,
      dateTo,
      readyForBilling,
      isInvoicedToPatient,
      scontoFE,
      limit,
      offset,
    });
  }

  /**
   * Query per un operatore specifico: stesso shape ma filtrata.
   * Il frontend deve passare sempre operatorId; il server non ricava il
   * ruolo (TODO auth). La segreteria lato client deve usare treatmentsForSecretary.
   */
  @Query(() => [Treatment], { name: 'treatmentsForOperator' })
  async treatmentsForOperator(
    @Args('operatorId', { type: () => ID }) operatorId: string,
    @Args('statuses', { type: () => [TreatmentStatus], nullable: true }) statuses?: TreatmentStatus[],
    @Args('dateFrom', { nullable: true }) dateFrom?: string,
    @Args('dateTo', { nullable: true }) dateTo?: string,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
    @Args('offset', { type: () => Int, nullable: true }) offset?: number,
  ): Promise<Treatment[]> {
    return this.treatmentService.findForListing({
      operatorId,
      statuses,
      dateFrom,
      dateTo,
      limit,
      offset,
    });
  }
}
