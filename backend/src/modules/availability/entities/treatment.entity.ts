                                                                                                                                                                        import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToOne, OneToMany, JoinColumn, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, Index } from 'typeorm';
import { ObjectType, Field, ID, Int, Float } from '@nestjs/graphql';
import { AvailabilityAppointment } from './availability-appointment.entity';
import { Operator } from './operator.entity';
import { Service } from './service.entity';
import { Site } from './site.entity';
import { TreatmentInstrument } from './treatment-instrument.entity';
import { TreatmentService } from './treatment-service.entity';
import { TreatmentInvoiceLine } from './treatment-invoice-line.entity';
import { TherapeuticPath } from './therapeutic-path.entity';
import { TreatmentStatus, PaymentMethod } from './treatment-enums';
import { TreatmentBillingStatus } from './treatment-billing-status.enum';

// Re-export enums for backward compatibility
export { TreatmentStatus, PaymentMethod } from './treatment-enums';

// ==================== ENTITY ====================

@ObjectType('Treatment')
@Entity('treatments')
@Index('IDX_treatments_operator', ['operatorId'])
@Index('IDX_treatments_patient', ['patientId'])
@Index('IDX_treatments_status', ['status'])
@Index('IDX_treatments_started_at', ['startedAt'])
@Index('IDX_treatments_therapeutic_path', ['therapeuticPathId'])
export class Treatment {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ==================== RELATIONS ====================

  // Nullable dal 2026-07-04 (migration 1798): la cancellazione fisica di un
  // appuntamento NON deve mai eliminare il trattamento collegato (la FK era
  // ON DELETE CASCADE e ha cancellato in silenzio trattamenti già fatturati).
  // Ora la FK è ON DELETE SET NULL e il trattamento sopravvive orfano.
  @Field(() => ID, { nullable: true })
  @Column('uuid', { nullable: true })
  @Index('IDX_treatments_appointment')
  appointmentId: string | null;

  @Field(() => ID)
  @Column('uuid')
  operatorId: string;

  @Field(() => ID, { nullable: true })
  @Column('uuid', { nullable: true })
  patientId?: string;

  /**
   * @deprecated Usa treatmentServices invece. Mantenuto per retrocompatibilità.
   */
  @Field(() => ID, { nullable: true, deprecationReason: 'Usa treatmentServices invece' })
  @Column('uuid', { nullable: true })
  serviceId?: string;

  @Field(() => ID)
  @Column('uuid')
  therapeuticPathId: string;

  /**
   * Sede operativa in cui il trattamento è stato eseguito. Obbligatorio:
   * accounting numera le fatture per (organizationId, siteId, year). La
   * migration backfilla il campo con la sede "Studio principale" creata
   * automaticamente per il tenant.
   */
  @Field(() => ID)
  @Column('uuid')
  siteId: string;

  // ==================== FLAGS ====================

  @Field()
  @Column({ default: false })
  scontoFE: boolean;

  // ==================== STATUS ====================

  @Field(() => TreatmentStatus)
  @Column({
    type: 'enum',
    enum: TreatmentStatus,
    default: TreatmentStatus.IN_PROGRESS
  })
  status: TreatmentStatus;

  @Field()
  @Column({ default: false })
  isTest: boolean;

  // ==================== TIMESTAMPS ====================

  @Field()
  @Column('timestamp', { default: () => 'CURRENT_TIMESTAMP' })
  startedAt: Date;

  @Field({ nullable: true })
  @Column('timestamp', { nullable: true })
  completedAt?: Date;

  @Field({ nullable: true })
  @Column('timestamp', { nullable: true })
  closedAt?: Date;

  // ==================== NOTES ====================

  @Field({ nullable: true })
  @Column('text', { nullable: true })
  clinicalNotes?: string;

  @Field({ nullable: true })
  @Column('text', { nullable: true })
  secretaryNotes?: string;

  @Field({ nullable: true })
  @Column('text', { nullable: true })
  operatorNotes?: string;

  @Field({ nullable: true })
  @Column('text', { nullable: true })
  patientNotes?: string;

  // ==================== CLINICAL DATA ====================

  @Field(() => Int, { nullable: true })
  @Column('int', { nullable: true })
  painLevel?: number;

  @Field(() => Int, { nullable: true })
  @Column('int', { nullable: true })
  painBefore?: number;

  @Field(() => Int, { nullable: true })
  @Column('int', { nullable: true })
  painAfter?: number;

  @Field({ nullable: true })
  @Column({ default: false })
  rescheduleRequested: boolean;

  @Field({ nullable: true })
  @Column({ length: 20, nullable: true })
  reschedulingType?: string;  // 'none' | 'days' | 'range'

  @Field(() => Int, { nullable: true })
  @Column('int', { nullable: true })
  suggestInDays?: number;

  @Field(() => String, { nullable: true, description: 'Data inizio intervallo riprogrammazione (YYYY-MM-DD)' })
  @Column('date', { nullable: true })
  suggestDateRangeStart?: Date;

  @Field(() => String, { nullable: true, description: 'Data fine intervallo riprogrammazione (YYYY-MM-DD)' })
  @Column('date', { nullable: true })
  suggestDateRangeEnd?: Date;

  @Field({ nullable: true })
  @Column('text', { nullable: true })
  reschedulingNotes?: string;

  // ==================== PAYMENT ====================

  @Field(() => Float)
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  price: number;

  /**
   * Totale REALE della fattura calcolato e confermato da accounting (marca da
   * bollo INCLUSA). Popolato dal consumer `billable.invoiced` con
   * `payload.totalAmount`. NULL finché il treatment non è stato fatturato.
   *
   * Il clinico NON calcola il bollo: lo riceve qui da accounting e lo mostra.
   * La UI usa `accountingTotalAmount ?? price` come totale da incassare. Sul
   * totale CONFERMATO si registra poi il pagamento ("Incassa").
   */
  @Field(() => Float, { nullable: true })
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  accountingTotalAmount?: number;

  /**
   * 2026-07-08 — Fatture multi-trattamento. Quota di QUESTO treatment nel
   * documento (somma delle sue righe, netto+IVA, SENZA bollo), come fatturata
   * da accounting — può differire da `price` se accounting ha modificato le
   * righe (quantità, importi). NULL se il producer accounting è vecchio o il
   * treatment non è fatturato. Invariante come accountingTotalAmount:
   * non-null ⟺ documento accounting corrente.
   */
  @Field(() => Float, { nullable: true })
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  accountingTreatmentLinesAmount?: number;

  /**
   * 2026-09-04 — Quota della prestazione già coperta da un voucher "anticipo
   * fattura": fatturata e incassata con l'anticipo, quindi FUORI dal
   * documento corrente.
   *
   * Serve a distinguere due numeri che prima si sovrapponevano:
   *  - `accountingTotalAmount` = quanto totalizza il documento corrente, cioè
   *    quanto resta da incassare;
   *  - questa colonna = quanto era già stato pagato con l'anticipo.
   * Il valore della prestazione è la loro somma. Senza, una seduta da 55 €
   * con 35 coperti compariva in elenco come "20 €".
   *
   * NULL = nessun anticipo, oppure producer accounting precedente.
   */
  @Field(() => Float, { nullable: true })
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  accountingAdvanceCoveredAmount?: number;

  /**
   * Quanti treatment clinici distinti copre il documento corrente (1 =
   * fattura singola). > 1 ⇒ la UI mostra l'icona "fattura cumulativa" e
   * l'incasso avviene a saldo intero documento su tutti i treatment insieme.
   */
  @Field(() => Int, { nullable: true })
  @Column({ type: 'int', nullable: true })
  accountingDocumentTreatmentCount?: number;

  @Field()
  @Column({ default: false })
  @Index('IDX_treatments_is_paid', { where: '"isPaid" = false' })
  isPaid: boolean;

  @Field(() => PaymentMethod, { nullable: true })
  @Column({
    type: 'enum',
    enum: PaymentMethod,
    nullable: true
  })
  paymentMethod?: PaymentMethod;

  @Field({ nullable: true })
  @Column('timestamp', { nullable: true })
  paidAt?: Date;

  @Field(() => ID, { nullable: true })
  @Column('uuid', { nullable: true })
  collectedBy?: string;

  /**
   * UUID dell'incasso "vincitore" (first-write-wins). NULL = mai incassato.
   * È la chiave logica di idempotenza condivisa: la registrazione del
   * pagamento (clinico o accounting) avviene solo se isPaid passa da false a
   * true (UPDATE ... WHERE isPaid=false), e questo paymentId identifica
   * univocamente l'incasso vincente. Echeggiato nel payload degli eventi.
   */
  @Field(() => ID, { nullable: true })
  @Column('uuid', { name: 'paymentId', nullable: true })
  paymentId?: string;

  /**
   * Sorgente che ha registrato per prima l'incasso: 'clinical' | 'accounting'.
   * Solo audit/UI: il vincitore first-write-wins è determinato dalla guardia
   * atomica su isPaid, questo campo traccia chi ha vinto.
   */
  @Field({ nullable: true })
  @Column({ name: 'paymentRecordedSource', length: 20, nullable: true })
  paymentRecordedSource?: string;

  /**
   * 2026-09-04 — Come è stato pagato, in una riga leggibile.
   *
   * `paymentMethod` è un enum di cinque valori e non basta: un incasso
   * coperto da un voucher "anticipo fattura" ci finiva dentro come "altro",
   * e a video restava un pagamento senza nome. Qui viene fuori il nome vero
   * della cosa usata, che per i buoni lo conosce solo la contabilità e ce lo
   * manda nell'evento.
   *
   * Calcolato, non salvato: le righe di tender sono la fonte, il metodo il
   * ripiego.
   */
  @Field({ nullable: true })
  get paymentMethodLabel(): string | null {
    const lines = this.paymentTenderLines ?? [];
    const labelled = lines.filter((l) => !!l.label);
    if (labelled.length > 0) {
      return labelled.map((l) => l.label).join(' + ');
    }
    return this.paymentMethod ?? null;
  }

  /**
   * AppUser che ha REGISTRATO l'operazione a sistema, sempre risolto dal JWT.
   * Distinto da `collectedBy`, che dice a chi l'incasso è ATTRIBUITO: quando
   * la segreteria spunta "incassato dall'operatore" i due differiscono, ed è
   * l'unico modo per sapere chi ha materialmente fatto l'operazione.
   * Vedi migration 1831000000000.
   */
  @Field(() => ID, { nullable: true })
  @Column('uuid', { name: 'paymentRecordedByUserId', nullable: true })
  paymentRecordedByUserId?: string;

  /**
   * Ruolo con cui è stato registrato l'incasso: 'operator' | 'secretary'.
   * Snapshot al momento dell'incasso (derivato server-side dai ruoli
   * Keycloak): i ruoli cambiano nel tempo e chi è insieme operatore e
   * amministratore sarebbe altrimenti indistinguibile nelle statistiche.
   */
  @Field({ nullable: true })
  @Column({ name: 'paymentCollectorRole', length: 20, nullable: true })
  paymentCollectorRole?: string;

  /**
   * 2026-09-03 — Come è stato composto l'incasso: le righe di tender così
   * come sono arrivate (metodo, buono FE, buono della contabilità), ciascuna
   * col suo importo.
   *
   * `paymentMethod` tiene una stringa sola e non basta per un incasso misto,
   * né dice QUALE buono è stato usato. Serve soprattutto quando l'incasso è
   * registrato prima dell'invio a fatturazione: in quel caso il pagamento
   * viaggia dentro `treatment.closed`, e senza queste righe la contabilità
   * non saprebbe che c'è un voucher da scalare.
   *
   * Snapshot, non entità: si scrive all'incasso e si rilegge intero.
   */
  @Column('jsonb', { name: 'paymentTenderLines', nullable: true })
  // NB: non esposto in GraphQL (jsonb libero). Per la UI c'è
  // `paymentMethodLabel`, che ne ricava una riga leggibile.

  paymentTenderLines?: Array<{
    kind: string;
    paymentMethodId?: string | null;
    voucherId?: string | null;
    voucherFeId?: string | null;
    amount: string;
    /**
     * 2026-09-04 — Etichetta leggibile della riga (es. "Voucher anticipo
     * fattura n. 11"). La scrive chi conosce il nome della cosa usata: la
     * contabilità per i buoni di anticipo, che il clinico non ha in anagrafe.
     * Colonna jsonb: campo additivo, le righe storiche semplicemente non
     * ce l'hanno.
     */
    label?: string | null;
  }> | null;

  // ==================== PATIENT INVOICE ====================

  @Field()
  @Column({ default: false })
  @Index('IDX_treatments_invoiced_patient', { where: '"isInvoicedToPatient" = false' })
  isInvoicedToPatient: boolean;

  @Field({ nullable: true })
  @Column('timestamp', { nullable: true })
  invoicedToPatientAt?: Date;

  @Field({ nullable: true })
  @Column({ length: 100, nullable: true })
  patientInvoiceNumber?: string;

  // ==================== READY FOR BILLING ====================

  /**
   * Flag "pronto per essere inviato al sistema di fatturazione".
   * Settato dalla segreteria dopo verifica delle righe/importi.
   * Richiede status = CLOSED e scontoFE = false.
   * Separato da `isInvoicedToPatient` che indica l'invio effettivo.
   */
  @Field()
  @Column({ default: false })
  readyForBilling: boolean;

  @Field({ nullable: true })
  @Column('timestamp', { nullable: true })
  readyForBillingAt?: Date;

  // ==================== OPERATOR INVOICE ====================

  @Field()
  @Column({ default: false })
  @Index('IDX_treatments_invoiced_operator', { where: '"isInvoicedByOperator" = false' })
  isInvoicedByOperator: boolean;

  @Field({ nullable: true })
  @Column('timestamp', { nullable: true })
  invoicedByOperatorAt?: Date;

  @Field({ nullable: true })
  @Column({ length: 100, nullable: true })
  operatorInvoiceNumber?: string;

  // ==================== AUDIT ====================

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;

  @Field({ nullable: true })
  @DeleteDateColumn()
  deletedAt?: Date;

  @Field(() => ID, { nullable: true })
  @Column('uuid', { nullable: true })
  deletedByUserId?: string;

  // ==================== AUDIT CHIUSURA ====================

  /**
   * AppUser che ha chiuso il trattamento (transizione → CLOSED).
   * Tipicamente segreteria; può essere anche admin in casi di override.
   * L'ownership "operativa" non è qui: deriva da `operatorId →
   * Operator.appUserId`.
   */
  @Field(() => ID, { nullable: true })
  @Column('uuid', { nullable: true })
  closedByUserId?: string;

  /**
   * True se la segreteria ha forzato la chiusura dell'operatore
   * (operatore dimentico di completare): in tal caso closedByUserId è la
   * segreteria ma il trattamento salta dallo stato IN_PROGRESS direttamente
   * al CLOSED tramite procedura dedicata.
   */
  @Field()
  @Column({ default: false })
  forcedClosure: boolean;

  // ==================== BILLING STATUS (clinico ↔ accounting) ====================

  /**
   * Stato del trattamento nel ciclo di fatturazione clinico ↔ accounting.
   * Aggiornato sia da azioni locali (closeTreatment, setReadyForBilling,
   * cancelTreatment) sia dal consumer di `ex.accounting.events`.
   * Vedi `TreatmentBillingStatus` per la state machine completa.
   */
  @Field(() => TreatmentBillingStatus)
  @Column({
    name: 'billingStatus',
    type: 'enum',
    enum: TreatmentBillingStatus,
    enumName: 'treatment_billing_status_enum',
    default: TreatmentBillingStatus.NOT_READY,
  })
  @Index('IDX_treatments_billing_status')
  billingStatus: TreatmentBillingStatus;

  // ==================== ACCOUNTING SNAPSHOT ====================

  /** ID del BillableEvent corrispondente lato accounting (popolato da billable.received). */
  @Field(() => ID, { nullable: true })
  @Column('uuid', { name: 'accountingBillableEventId', nullable: true })
  accountingBillableEventId?: string;

  /**
   * ID del SalesDocument (fattura) lato accounting, popolato da billable.invoiced.
   * Serve a recuperare on-demand il PDF stampabile via il proxy clinico
   * (GET /treatments/:id/invoice-pdf → accounting GET /sales-documents/:id/pdf).
   * Distinto da accountingInvoiceUrl (campo legacy mai popolato da accounting).
   */
  @Field(() => ID, { nullable: true })
  @Column('uuid', { name: 'accountingDocumentId', nullable: true })
  accountingDocumentId?: string;

  /** URL al PDF del documento fiscale (popolato da billable.invoiced). */
  @Field({ nullable: true })
  @Column('text', { name: 'accountingInvoiceUrl', nullable: true })
  accountingInvoiceUrl?: string;

  /**
   * 2026-09-03 — Numero della fattura ESTERNA (gestionale precedente) su cui
   * la prestazione risulta fatturata. Valorizzato al posto di
   * `accountingDocumentId` quando la prestazione è stata coperta da un
   * voucher "anticipo fattura" che fa riferimento a un documento non
   * presente in Curandis.
   *
   * Il trattamento è fatturato a tutti gli effetti — cambia solo che non c'è
   * un PDF da scaricare, e la UI lo dichiara invece di lasciare un bottone
   * che fallirebbe.
   */
  @Field({ nullable: true })
  @Column({ name: 'accountingExternalRefNumber', length: 50, nullable: true })
  accountingExternalRefNumber?: string;

  /** Data del documento esterno. Nullable: di certe fatture vecchie si sa solo il numero. */
  @Field({ nullable: true })
  @Column('date', { name: 'accountingExternalRefDate', nullable: true })
  accountingExternalRefDate?: string;

  /** Timestamp di emissione del documento fiscale. */
  @Field({ nullable: true })
  @Column('timestamptz', { name: 'accountingInvoiceIssuedAt', nullable: true })
  accountingInvoiceIssuedAt?: Date;

  /** Tipo documento accounting: INVOICE | PROFORMA | CREDIT_NOTE. */
  @Field({ nullable: true })
  @Column({ name: 'accountingDocumentType', length: 30, nullable: true })
  accountingDocumentType?: string;

  /** Numero della nota di credito (popolato da billable.refunded / partially-refunded). */
  @Field({ nullable: true })
  @Column({ name: 'accountingCreditNoteNumber', length: 50, nullable: true })
  accountingCreditNoteNumber?: string;

  /** Timestamp emissione nota di credito. */
  @Field({ nullable: true })
  @Column('timestamptz', { name: 'accountingCreditNoteIssuedAt', nullable: true })
  accountingCreditNoteIssuedAt?: Date;

  /** Causale del rimborso/storno (free text dall'operatore accounting). */
  @Field({ nullable: true })
  @Column('text', { name: 'accountingRefundReason', nullable: true })
  accountingRefundReason?: string;

  /**
   * Numero di amend (treatment.amended.<tenant>) emessi per questo treatment.
   * Inizializzato a 0; ogni amend incrementa atomicamente via
   * `UPDATE treatments SET amendmentRevision = amendmentRevision + 1 ... RETURNING`.
   * Il primo amend ha revision = 1.
   */
  @Field(() => Int)
  @Column({ name: 'amendmentRevision', type: 'int', default: 0 })
  amendmentRevision: number;

  // ==================== BILLING ALERT (cancellation-rejected) ====================

  /**
   * Messaggio alert mostrato al clinico quando arriva
   * `billable.cancellation-rejected` (race condition: clinico ha cancellato
   * un trattamento che accounting aveva già fatturato). Visibile in UI come
   * badge finché non viene dismissato dall'operatore.
   */
  @Field({ nullable: true })
  @Column('text', { name: 'billingAlertMessage', nullable: true })
  billingAlertMessage?: string;

  @Field({ nullable: true })
  @Column('timestamptz', { name: 'billingAlertAt', nullable: true })
  billingAlertAt?: Date;

  @Field({ nullable: true })
  @Column('timestamptz', { name: 'billingAlertDismissedAt', nullable: true })
  billingAlertDismissedAt?: Date;

  // ==================== BILLING HOLD — invoice-blocked (2026-06-30) ====================
  //
  // Motivo per cui l'auto-emissione fattura è BLOCCATA lato accounting (causa
  // risolvibile: indirizzo paziente mancante, P.IVA mancante, mapping pending).
  // Popolato dal consumer `billable.invoice-blocked`. Distinto da
  // `billingAlertMessage` (race cancellation-rejected, dismissibile): il blocco
  // NON è dismissibile, sparisce solo quando la fattura viene emessa
  // (azzerato in `handleBillableInvoiced`). Mostrato come banner con il motivo
  // reale + pulsante "Verifica risoluzione e riprova".

  /** Codice motivo blocco (MISSING_ADDRESS, MISSING_VAT, MAPPING_PENDING, ...). NULL = nessun blocco. */
  @Field({ nullable: true })
  @Column({ name: 'billingHoldReasonCode', length: 40, nullable: true })
  billingHoldReasonCode?: string;

  /** Messaggio human-friendly del blocco (da mostrare all'operatore). */
  @Field({ nullable: true })
  @Column('text', { name: 'billingHoldReason', nullable: true })
  billingHoldReason?: string;

  /** Timestamp dell'ultimo blocco registrato. */
  @Field({ nullable: true })
  @Column('timestamptz', { name: 'billingHoldReasonAt', nullable: true })
  billingHoldReasonAt?: Date;

  // ==================== RECALL / RETURN-TO-CLINICAL (sessione 7) ====================

  /**
   * EventId del `treatment.recall-requested` in volo (UUID v4). Popolato
   * quando l'operatore clicca "Richiama indietro"; usato dal consumer per
   * correlare `billable.recall-accepted/rejected` arrivati dopo. Null sia
   * prima della richiesta che dopo la risposta accept/reject.
   */
  @Field({ nullable: true })
  @Column({ name: 'recallRequestId', length: 36, nullable: true })
  recallRequestId?: string;

  /** Timestamp del recall in volo. Usato dalla UI per il timeout (~30s) dello spinner. */
  @Field({ nullable: true })
  @Column('timestamptz', { name: 'recallRequestedAt', nullable: true })
  recallRequestedAt?: Date;

  /**
   * Messaggio user-friendly dell'ultimo `billable.recall-rejected` (italiano,
   * arriva già formattato da accounting). Mostrato in UI come banner finché
   * non c'è un nuovo recall request.
   */
  @Field({ nullable: true })
  @Column('text', { name: 'lastRecallRejectionMessage', nullable: true })
  lastRecallRejectionMessage?: string;

  @Field({ nullable: true })
  @Column('timestamptz', { name: 'lastRecallRejectionAt', nullable: true })
  lastRecallRejectionAt?: Date;

  /**
   * Motivo della restituzione one-way da operatore accounting
   * (`billable.returned-to-clinical`). Visibile come banner persistente
   * finché non dismissato.
   */
  @Field({ nullable: true })
  @Column('text', { name: 'returnedFromAccountingReason', nullable: true })
  returnedFromAccountingReason?: string;

  @Field({ nullable: true })
  @Column('timestamptz', { name: 'returnedFromAccountingAt', nullable: true })
  returnedFromAccountingAt?: Date;

  /** Email operatore accounting che ha restituito (audit, per UI). */
  @Field({ nullable: true })
  @Column({ name: 'returnedFromAccountingByEmail', length: 255, nullable: true })
  returnedFromAccountingByEmail?: string;

  @Field({ nullable: true })
  @Column('timestamptz', { name: 'returnedFromAccountingDismissedAt', nullable: true })
  returnedFromAccountingDismissedAt?: Date;

  // ==================== CANCELLATION AUDIT (sessione 6 Step 7.4) ====================

  /**
   * Timestamp della transition `billingStatus → CANCELLED` via mutation
   * `cancelTreatment`. Distinto da `deletedAt` (soft-delete generico):
   * un treatment CANCELLED resta visibile in lista col badge.
   */
  @Field({ nullable: true })
  @Column('timestamptz', { name: 'cancelledAt', nullable: true })
  cancelledAt?: Date;

  /** AppUser locale che ha eseguito `cancelTreatment`. */
  @Field(() => ID, { nullable: true })
  @Column('uuid', { name: 'cancelledByUserId', nullable: true })
  cancelledByUserId?: string;

  /** Motivo della cancellation (free-text, mostrato in UI + propagato nel payload `treatment.cancelled`). */
  @Field({ nullable: true })
  @Column('text', { name: 'cancellationReason', nullable: true })
  cancellationReason?: string;

  // ==================== RELATIONS ====================

  // NULLABLE in GraphQL per lo stesso motivo di `operator` (vedi sotto):
  // se l'appointment collegato è soft-deleted (deletedAt) o è stato
  // cancellato fisicamente (FK SET NULL, migration 1798), il leftJoin lo
  // esclude → appointment = null e con campo non-nullable GraphQL faceva
  // fallire l'INTERA lista trattamenti. Il frontend gestisce null
  // mostrando un fallback su data/ora.
  @Field(() => AvailabilityAppointment, { nullable: true })
  @OneToOne(() => AvailabilityAppointment, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'appointmentId' })
  appointment: AvailabilityAppointment | null;

  // NULLABLE in GraphQL: se l'operatore del trattamento è stato soft-deleted
  // (operators.deletedAt), TypeORM lo esclude dal join → operator = null. Con
  // il campo non-nullable, GraphQL faceva fallire l'INTERA query "Cannot return
  // null for non-nullable field Treatment.operator" (es. lista con "tutti gli
  // operatori" che includeva un trattamento di un operatore rimosso). Il
  // frontend gestisce null mostrando "Operatore rimosso".
  @Field(() => Operator, { nullable: true })
  @ManyToOne(() => Operator, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'operatorId' })
  operator: Operator;

  // patientId è il subjectId del registry (FK logica, niente FK fisica
  // né relazione TypeORM). Il campo GraphQL `patient` viene esposto via
  // field resolver in TreatmentResolver usando il SubjectLoader.

  @Field(() => Service, { nullable: true })
  @ManyToOne(() => Service, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'serviceId' })
  service?: Service;

  @Field(() => [TreatmentInstrument], { nullable: true })
  @OneToMany(() => TreatmentInstrument, instrument => instrument.treatment)
  instruments?: TreatmentInstrument[];

  @Field(() => TherapeuticPath)
  @ManyToOne(() => TherapeuticPath, path => path.treatments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'therapeuticPathId' })
  therapeuticPath: TherapeuticPath;

  @Field(() => Site)
  @ManyToOne(() => Site, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'siteId' })
  site: Site;

  // ==================== MULTIPLE SERVICES ====================

  /**
   * Servizi eseguiti nel trattamento.
   *
   * NOTA: I servizi del trattamento possono essere DIVERSI da quelli
   * dell'appuntamento originale. L'operatore può modificarli quando
   * arriva il paziente.
   */
  @Field(() => [TreatmentService], { nullable: true })
  @OneToMany(() => TreatmentService, treatmentService => treatmentService.treatment)
  treatmentServices?: TreatmentService[];

  /**
   * Righe di fatturazione custom inserite dalla segreteria.
   * Si aggiungono alle righe derivate dai servizi eseguiti (treatmentServices).
   */
  @Field(() => [TreatmentInvoiceLine], { nullable: true })
  @OneToMany(() => TreatmentInvoiceLine, line => line.treatment)
  invoiceLines?: TreatmentInvoiceLine[];
}
