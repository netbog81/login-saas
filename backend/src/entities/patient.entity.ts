import { Appointment } from './appointment.entity';
import { GraphQLJSONObject } from 'graphql-type-json';                                                                                                                                                                                                                                                                                                                                                                                
// src/pazienti/entities/paziente.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';

// ✅ IMPORT DAGLI ENUM CONDIVISI
import {
  Genere,
  StatoCivile,
  TipoPaziente,
  StatoAnagrafica,
  StatoPrivacy,
  TipoRiferimento,
} from '../patients/enums/pazienti-enums';

// ✅ IMPORT CORRETTO - solo per typing, non per decorators
import type { PersonaRiferimento } from '../patients/entities/persona-riferimento.entity';

@Entity('patients')
@Index(['codiceFiscale'], { unique: true })
@Index(['email'], { unique: true, where: 'email IS NOT NULL' })
@Index(['telefono'])
@Index(['dataNascita'])
export class Patient {
  @PrimaryGeneratedColumn()
  id: number;

  // ==================== DATI ANAGRAFICI ====================

  @Column({ length: 50 })
  nome: string;

  @Column({ length: 50 })
  cognome: string;

  @Column({ name: 'codice_fiscale', length: 16, nullable: true })
  codiceFiscale?: string;

  @Column({ name: 'data_nascita', type: 'date', nullable: true })
  dataNascita?: Date;

  @Column({ name: 'comune_nascita', length: 100, nullable: true })
  comuneNascita?: string;

  @Column({
    name: 'nazione_nascita',
    length: 50,
    nullable: true,
    default: 'Italia',
  })
  nazioneNascita?: string;

  @Column({ name: 'luogo_nascita_estero', length: 100, nullable: true })
  luogoNascitaEstero?: string;

  @Column({
    type: 'enum',
    enum: Genere,
    default: Genere.NON_SPECIFICATO,
  })
  genere: Genere;

  @Column({
    name: 'stato_civile',
    type: 'enum',
    enum: StatoCivile,
    nullable: true,
  })
  statoCivile?: StatoCivile;

  // ==================== CONTATTI (CORREZIONE CRITICA) ====================

  @Column({ length: 100, nullable: true })
  indirizzo?: string;

  @Column({ length: 20, nullable: true })
  cap?: string;

  @Column({ length: 50, nullable: true })
  citta?: string;

  @Column({ length: 5, nullable: true })
  provincia?: string;

  @Column({ length: 20, nullable: true })
  telefono?: string;

  @Column({ length: 20, nullable: true })
  fax?: string;

  @Column({ length: 20, nullable: true })
  cellulare?: string;

  @Column({ length: 100, nullable: true })
  email?: string;

  @Column({ length: 100, nullable: true })
  pec?: string;

  @Column({ length: 10, nullable: true })
  codiceSdi?: string;

  @Column({ length: 100, nullable: true })
  nazioneResidenza?: string;

  // ==================== DATI SANITARI ====================

  @Column({
    name: 'tipo_paziente',
    type: 'enum',
    enum: TipoPaziente,
    default: TipoPaziente.ADULTO_AUTONOMO,
  })
  tipoPaziente: TipoPaziente;

  @Column({ name: 'medico_base', length: 100, nullable: true })
  medicoBase?: string;

  @Column({ name: 'gruppo_sanguigno', length: 5, nullable: true })
  gruppoSanguigno?: string;

  @Column({ type: 'text', nullable: true })
  allergie?: string;

  @Column({ name: 'farmaci_uso', type: 'text', nullable: true })
  farmaciInUso?: string;

  @Column({ name: 'patologie_croniche', type: 'text', nullable: true })
  patologieCroniche?: string;

  // ==================== STATO ANAGRAFICA E PRIVACY ====================

  @Column({
    name: 'stato_anagrafica',
    type: 'enum',
    enum: StatoAnagrafica,
    default: StatoAnagrafica.BOZZA,
  })
  statoAnagrafica: StatoAnagrafica;

  @Column({
    name: 'stato_privacy',
    type: 'enum',
    enum: StatoPrivacy,
    default: StatoPrivacy.NON_ACQUISITA,
  })
  statoPrivacy: StatoPrivacy;

  @Column({ name: 'consenso_privacy', default: false })
  consensoPrivacy: boolean;

  @Column({ name: 'data_consenso_privacy', type: 'timestamp', nullable: true })
  dataConsensoPrivacy?: Date;

  @Column({ name: 'consenso_marketing', default: false })
  consensoMarketing: boolean;

  @Column({ name: 'consenso_ricerca_medica', default: false })
  consensoRicercaMedica: boolean;

  @Column({ name: 'modalita_consenso_per_trattamento', default: false })
  modalitaConsensoPerTrattamento: boolean;

  @Column({ name: 'consenso_comunicazione_terzi', default: false })
  consensoComunicazioneTerzi: boolean;

  // ==================== DATI AMMINISTRATIVI ====================

  @Column({ name: 'codice_paziente', length: 20, nullable: true, unique: true })
  codicePaziente?: string;

  @Column({ default: true })
  attivo: boolean;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ name: 'note_amministrative', type: 'text', nullable: true })
  noteAmministrative?: string;

  // ==================== CONVENZIONI (predisposto per futuro) ====================

  @Column({ name: 'convenzione_id', nullable: true })
  convenzioneId?: number;

  // ==================== GDPR COMPLIANCE ====================

  @Column({
    name: 'data_ultima_modifica_privacy',
    type: 'timestamp',
    nullable: true,
  })
  dataUltimaModificaPrivacy?: Date;

  @Column({ name: 'richiesta_cancellazione', default: false })
  richiestaCancellazione: boolean;

  @Column({
    name: 'data_richiesta_cancellazione',
    type: 'timestamp',
    nullable: true,
  })
  dataRichiestaCancellazione?: Date;

  @Column({ name: 'data_anonimizzazione', type: 'timestamp', nullable: true })
  dataAnonimizzazione?: Date;

  @Column({ name: 'conservazione_fino', type: 'date', nullable: true })
  conservazioneFino?: Date;

  // ==================== TRACKING FIELDS (from agendatest) ====================

  /**
   * Contatore disdette per anno solare
   * Formato: { "2025": 3, "2024": 1 }
   */
  @Column('jsonb', { default: {} })
  cancellationsByYear: Record<string, number>;

  /**
   * Contatore no-show per anno solare
   * Formato: { "2025": 2, "2024": 0 }
   */
  @Column('jsonb', { default: {} })
  noShowsByYear: Record<string, number>;

  // ==================== RELAZIONI ====================

  // ✅ LAZY LOADING per evitare dipendenze circolari
  @OneToMany('PersonaRiferimento', 'paziente', {
    cascade: true,
    eager: false,
    lazy: true,
  })
  personeRiferimento: Promise<PersonaRiferimento[]>;

  @OneToMany('PersonaRiferimento', 'coniugePaziente', {
    cascade: false,
    eager: false,
    lazy: true,
  })
  relazioniComeConiuge: Promise<PersonaRiferimento[]>;

  // ✅ RELAZIONI CON APPOINTMENTS (from agendatest)
  @OneToMany('Appointment', 'patient', {
    cascade: false,
    eager: false,
    lazy: true,
  })
  appointments: Promise<any[]>; // Type will be resolved in target project

  @OneToMany('AvailabilityAppointment', 'patient', {
    cascade: false,
    eager: false,
    lazy: true,
  })
  availabilityAppointments: Promise<any[]>; // Type will be resolved in target project

  // ==================== TIMESTAMP ====================

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // ==================== COMPUTED PROPERTIES ====================

  get nomeCompleto(): string {
    return `${this.nome} ${this.cognome}`;
  }

  get eta(): number {
    if (!this.dataNascita) return 0;

    const oggi = new Date();
    const nascita = new Date(this.dataNascita);
    let eta = oggi.getFullYear() - nascita.getFullYear();
    const diffMesi = oggi.getMonth() - nascita.getMonth();

    if (
      diffMesi < 0 ||
      (diffMesi === 0 && oggi.getDate() < nascita.getDate())
    ) {
      eta--;
    }

    return eta;
  }

  get isMinorenne(): boolean {
    return this.dataNascita ? this.eta < 18 : false;
  }

  get isMaggiorenne(): boolean {
    return this.dataNascita ? this.eta >= 18 : false;
  }

  get hasContattoTelefonico(): boolean {
    return !!(this.telefono || this.cellulare);
  }

  get hasEmailContact(): boolean {
    return !!(this.email || this.pec);
  }

  get isDatiFatturazioneCompleti(): boolean {
    return !!(
      this.codiceFiscale &&
      this.indirizzo &&
      this.cap &&
      this.citta &&
      this.hasContattoTelefonico &&
      // Per fatturazione elettronica serve almeno uno tra: PEC, Codice SDI, o email
      (this.pec || this.codiceSdi || this.email)
    );
  }

  get isDatiFatturazioneElettronica(): boolean {
    return !!(this.pec || this.codiceSdi);
  }

  get luogoNascitaCompleto(): string {
    if (this.luogoNascitaEstero) {
      return `${this.luogoNascitaEstero} (${this.nazioneNascita || 'Estero'})`;
    }
    return `${this.comuneNascita || ''} (${this.nazioneNascita || 'Italia'})`;
  }

  get indirizzoCompleto(): string {
    const parts = [
      this.indirizzo,
      this.cap,
      this.citta,
      this.provincia,
      this.nazioneResidenza !== 'Italia' ? this.nazioneResidenza : '',
    ].filter(Boolean);

    return parts.join(', ');
  }

  get isAnagraficaMinima(): boolean {
    return !!(this.nome && this.cognome && this.hasContattoTelefonico);
  }

  get canCreateAppuntamento(): boolean {
    return this.isAnagraficaMinima;
  }

  get canProceedToVisita(): boolean {
    return (
      this.statoPrivacy !== StatoPrivacy.NON_ACQUISITA &&
      this.statoAnagrafica !== StatoAnagrafica.BOZZA
    );
  }

  get canEmitFattura(): boolean {
    return (
      this.isDatiFatturazioneCompleti &&
      this.statoAnagrafica === StatoAnagrafica.COMPLETA
    );
  }

  get isPrivacyCompleta(): boolean {
    return (
      this.statoPrivacy !== StatoPrivacy.NON_ACQUISITA &&
      this.consensoPrivacy
    );
  }

  get hasAllConsensi(): boolean {
    return (
      this.consensoPrivacy &&
      this.consensoMarketing &&
      this.consensoRicercaMedica
    );
  }

  get requiresConsensoDiEntrambiGenitori(): boolean {
    // Logic per determinare se serve consenso di entrambi i genitori
    // Sarà configurabile per tipo trattamento
    return this.isMinorenne;
  }

  get isEligibleForAnonimizzazione(): boolean {
    if (!this.conservazioneFino) return false;
    return new Date() > this.conservazioneFino;
  }

  // ✅ METODI ASYNC per lazy loading
  async getPersoneRiferimentoAttive(): Promise<PersonaRiferimento[]> {
    const persone = await this.personeRiferimento;
    return persone?.filter((p) => p.isRelazioneAttiva) || [];
  }

  async getGenitori(): Promise<PersonaRiferimento[]> {
    const personeAttive = await this.getPersoneRiferimentoAttive();
    return personeAttive.filter(
      (p) => p.tipoRiferimento === TipoRiferimento.GENITORE,
    );
  }

  async getTutoriLegali(): Promise<PersonaRiferimento[]> {
    const personeAttive = await this.getPersoneRiferimentoAttive();
    return personeAttive.filter((p) => p.isTutoreLegale);
  }

  async getAccompagnatori(): Promise<PersonaRiferimento[]> {
    const personeAttive = await this.getPersoneRiferimentoAttive();
    return personeAttive.filter(
      (p) => p.tipoRiferimento === TipoRiferimento.ACCOMPAGNATORE,
    );
  }

  async hasGenitori(): Promise<boolean> {
    const genitori = await this.getGenitori();
    return genitori.length > 0;
  }

  async hasTutoreLegale(): Promise<boolean> {
    const tutori = await this.getTutoriLegali();
    return tutori.length > 0;
  }

  async getPersoneAutorizzateConsenso(): Promise<PersonaRiferimento[]> {
    const personeAttive = await this.getPersoneRiferimentoAttive();
    return personeAttive.filter((p) => p.isValidForConsenso());
  }

  async requiresConsensoEntrambiGenitori(): Promise<boolean> {
    if (!this.isMinorenne) return false;

    const genitori = await this.getGenitori();
    if (genitori.length < 2) return false;

    return genitori.some((g) => g.requiresConsensoCongiunto);
  }

  async canProceedWithSingleParentConsent(): Promise<boolean> {
    if (!this.isMinorenne) return true;

    const genitori = await this.getGenitori();
    return genitori.some((g) => g.canGiveConsensoAutonomo);
  }

  // ==================== METHODS ====================

  updateConservazioneDate(): void {
    // Calcola data conservazione (10 anni dall'ultimo trattamento)
    const dataLimite = new Date();
    dataLimite.setFullYear(dataLimite.getFullYear() + 10);
    this.conservazioneFino = dataLimite;
  }

  revokeConsensoPrincipal(): void {
    this.consensoPrivacy = false;
    this.dataUltimaModificaPrivacy = new Date();
  }

  requestCancellazione(): void {
    this.richiestaCancellazione = true;
    this.dataRichiestaCancellazione = new Date();
  }

  // ==================== WORKFLOW METHODS ====================

  promoteToAnagraficaParziale(): void {
    if (this.statoAnagrafica === StatoAnagrafica.BOZZA) {
      this.statoAnagrafica = StatoAnagrafica.PARZIALE;
    }
  }

  promoteToAnagraficaCompleta(): void {
    if (
      this.isDatiFatturazioneCompleti &&
      this.statoPrivacy !== StatoPrivacy.NON_ACQUISITA
    ) {
      this.statoAnagrafica = StatoAnagrafica.COMPLETA;
    }
  }

  setPrivacyCartacea(): void {
    this.statoPrivacy = StatoPrivacy.CARTACEA;
    this.consensoPrivacy = true;
    this.dataConsensoPrivacy = new Date();
    this.dataUltimaModificaPrivacy = new Date();
  }

  setPrivacyDigitale(): void {
    this.statoPrivacy = StatoPrivacy.DIGITALE;
    this.consensoPrivacy = true;
    this.dataConsensoPrivacy = new Date();
    this.dataUltimaModificaPrivacy = new Date();
  }

  requiresDataVerification(): void {
    this.statoAnagrafica = StatoAnagrafica.DA_VERIFICARE;
  }

  anonimizza(): void {
    // Mantiene solo dati essenziali per ricerca medica
    this.nome = 'ANONIMO';
    this.cognome = 'ANONIMO';
    this.codiceFiscale = `ANON${this.id.toString().padStart(12, '0')}`;
    this.email = undefined;
    this.pec = undefined;
    this.telefono = undefined;
    this.cellulare = undefined;
    this.fax = undefined;
    this.indirizzo = 'ANONIMIZZATO';
    this.codiceSdi = undefined;
    this.dataAnonimizzazione = new Date();
  }

  async getPersoneByTipo(tipo: TipoRiferimento): Promise<PersonaRiferimento[]> {
    const personeAttive = await this.getPersoneRiferimentoAttive();
    return personeAttive.filter((p) => p.tipoRiferimento === tipo);
  }

  async getPersoneConPermesso(
    permesso: keyof PersonaRiferimento,
  ): Promise<PersonaRiferimento[]> {
    const personeAttive = await this.getPersoneRiferimentoAttive();
    return personeAttive.filter((p) => p[permesso] === true);
  }

  async hasValidConsensoFor(tipoTrattamento?: string): Promise<boolean> {
    if (this.isMaggiorenne) return true;

    const personeAutorizzate = await this.getPersoneAutorizzateConsenso();
    if (personeAutorizzate.length === 0) return false;

    // Se richiede consenso congiunto, verifica che ci siano entrambi i genitori
    if (await this.requiresConsensoEntrambiGenitori()) {
      const genitoriConConsenso = (await this.getGenitori()).filter((g) =>
        g.isValidForConsenso(),
      );
      return genitoriConConsenso.length >= 2;
    }

    // Altrimenti basta una persona autorizzata
    return personeAutorizzate.length > 0;
  }

  async getContactPersonForEmergency(): Promise<PersonaRiferimento | null> {
    // Priorità: Genitore -> Tutore -> Coniuge -> Altro
    const priorityOrder = [
      TipoRiferimento.GENITORE,
      TipoRiferimento.TUTORE_LEGALE,
      TipoRiferimento.CONIUGE,
      TipoRiferimento.FIGLIO_MAGGIORENNE,
      TipoRiferimento.ACCOMPAGNATORE,
    ];

    for (const tipo of priorityOrder) {
      const persone = (await this.getPersoneByTipo(tipo)).filter(
        (p) => p.puoEssereContattato && p.hasContattoTelefonico,
      );

      if (persone.length > 0) {
        return persone[0]; // Prende il primo disponibile
      }
    }

    return null;
  }

  async getPersoneForFatturazione(): Promise<PersonaRiferimento[]> {
    const personeAttive = await this.getPersoneRiferimentoAttive();
    return personeAttive.filter((p) => p.puoRicevereFatture);
  }

  addPersonaRiferimento(
    persona: Partial<PersonaRiferimento>,
  ): PersonaRiferimento {
    // Questo metodo sarà implementato nel service
    // Qui solo la signature per completezza
    throw new Error('Method should be implemented in service layer');
  }

  removePersonaRiferimento(personaId: number, motivo: string): void {
    // Questo metodo sarà implementato nel service
    throw new Error('Method should be implemented in service layer');
  }
}
