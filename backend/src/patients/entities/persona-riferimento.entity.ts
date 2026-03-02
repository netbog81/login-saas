// src/pazienti/entities/persona-riferimento.entity.ts
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';

// ✅ IMPORT DAGLI ENUM CONDIVISI
import {
  Genere,
  StatoCivile,
  TipoRiferimento,
  TipoPatriaPodesta,
  StatoRelazione,
} from '../enums/pazienti-enums';

// ✅ IMPORT TYPE per evitare dipendenze circolari
import type { Patient } from '../../entities/patient.entity';

@Entity('persone_riferimento')
@Index(['codiceFiscale'], { unique: true, where: 'codice_fiscale IS NOT NULL' })
@Index(['email'], { where: 'email IS NOT NULL' })
@Index(['pazienteId', 'tipoRiferimento'])
@Index(['dataInizio', 'dataFine'])
export class PersonaRiferimento {
  @PrimaryColumn({ type: 'uuid', default: () => "public.uuid_generate_v4()" })
  id: string;

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

  @Column({ length: 100, nullable: true })
  nazioneResidenza?: string;

  // ✅ FIX CRITICO: Rimuovi "| null" dai tipi TypeScript
  @Column({ length: 20, nullable: true })
  telefono?: string;

  @Column({ length: 20, nullable: true })
  cellulare?: string;

  @Column({ length: 20, nullable: true })
  fax?: string;

  @Column({ length: 100, nullable: true })
  email?: string;

  @Column({ length: 100, nullable: true })
  pec?: string;

  // ==================== TIPO RELAZIONE ====================

  @Column({
    name: 'tipo_riferimento',
    type: 'enum',
    enum: TipoRiferimento,
  })
  tipoRiferimento: TipoRiferimento;

  @Column({
    name: 'tipo_patria_podesta',
    type: 'enum',
    enum: TipoPatriaPodesta,
    nullable: true,
  })
  tipoPatriaPodesta?: TipoPatriaPodesta;

  @Column({
    name: 'stato_relazione',
    type: 'enum',
    enum: StatoRelazione,
    default: StatoRelazione.ATTIVA,
  })
  statoRelazione: StatoRelazione;

  // ==================== VALIDITÀ TEMPORALE ====================

  @Column({ name: 'data_inizio', type: 'date' })
  dataInizio: Date;

  @Column({ name: 'data_fine', type: 'date', nullable: true })
  dataFine?: Date;

  @Column({ name: 'motivo_fine', length: 255, nullable: true })
  motivoFine?: string;

  // ==================== PERMESSI E AUTORIZZAZIONI ====================

  @Column({ name: 'puo_dare_consenso', default: false })
  puoDareConsenso: boolean;

  @Column({ name: 'puo_accedere_cartella', default: false })
  puoAccedereCartella: boolean;

  @Column({ name: 'puo_ritirare_referti', default: false })
  puoRitirareReferti: boolean;

  @Column({ name: 'puo_prenotare_visite', default: false })
  puoPrenotareVisite: boolean;

  @Column({ name: 'puo_ricevere_fatture', default: false })
  puoRicevereFatture: boolean;

  @Column({ name: 'puo_essere_contattato', default: true })
  puoEssereContattato: boolean;

  // ==================== DATI LEGALI ====================

  @Column({ name: 'documento_nomina', length: 255, nullable: true })
  documentoNomina?: string; // Sentenza tribunale, atto notarile, etc.

  @Column({ name: 'numero_pratica_tribunale', length: 50, nullable: true })
  numeroPraticaTribunale?: string;

  @Column({ name: 'tribunale_competente', length: 100, nullable: true })
  tribunaleCompetente?: string;

  @Column({ name: 'data_nomina_legale', type: 'date', nullable: true })
  dataNominaLegale?: Date;

  // ==================== NOTE E OSSERVAZIONI ====================

  @Column({ type: 'text', nullable: true })
  note?: string;

  @Column({ name: 'note_legali', type: 'text', nullable: true })
  noteLegali?: string;

  @Column({ name: 'istruzioni_speciali', type: 'text', nullable: true })
  istruzioniSpeciali?: string;

  // ==================== RELAZIONI ====================

  @Column({ name: 'paziente_id', type: 'uuid' })
  pazienteId: string;

  // ✅ LAZY LOADING per evitare dipendenze circolari
  @ManyToOne('Patient', { onDelete: 'CASCADE', lazy: true })
  @JoinColumn({ name: 'paziente_id' })
  paziente: Promise<Patient>;

  // Relazione autoreferenziale per gestire coniugi che sono entrambi pazienti
  @Column({ name: 'coniuge_paziente_id', type: 'uuid', nullable: true })
  coniugePazienteId?: string;

  @ManyToOne('Patient', { nullable: true, lazy: true })
  @JoinColumn({ name: 'coniuge_paziente_id' })
  coniugePaziente?: Promise<Patient>;

  // ==================== DATI AMMINISTRATIVI ====================

  @Column({ default: true })
  attivo: boolean;

  @Column({ name: 'creato_da_utente_id', type: 'uuid', nullable: true })
  creatoDaUtenteId?: string;

  @Column({ name: 'modificato_da_utente_id', type: 'uuid', nullable: true })
  modificatoDaUtenteId?: string;

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

  get isRelazioneAttiva(): boolean {
    if (this.statoRelazione !== StatoRelazione.ATTIVA) return false;
    if (this.dataFine && new Date() > this.dataFine) return false;
    return true;
  }

  get isGenitoreConPatriaPodesta(): boolean {
    return (
      this.tipoRiferimento === TipoRiferimento.GENITORE &&
      this.tipoPatriaPodesta !== null &&
      this.isRelazioneAttiva
    );
  }

  get isTutoreLegale(): boolean {
    return (
      (this.tipoRiferimento === TipoRiferimento.TUTORE_LEGALE ||
        this.tipoPatriaPodesta === TipoPatriaPodesta.TUTORE_NOMINATO) &&
      this.isRelazioneAttiva
    );
  }

  get canGiveConsensoAutonomo(): boolean {
    return (
      this.isRelazioneAttiva &&
      this.puoDareConsenso &&
      (this.tipoPatriaPodesta === TipoPatriaPodesta.GENITORE_SINGOLO ||
        this.tipoPatriaPodesta === TipoPatriaPodesta.SOLO_PADRE ||
        this.tipoPatriaPodesta === TipoPatriaPodesta.SOLO_MADRE ||
        this.tipoPatriaPodesta === TipoPatriaPodesta.TUTORE_NOMINATO)
    );
  }

  get requiresConsensoCongiunto(): boolean {
    return (
      this.isRelazioneAttiva &&
      (this.tipoPatriaPodesta === TipoPatriaPodesta.ENTRAMBI_GENITORI ||
        this.tipoPatriaPodesta === TipoPatriaPodesta.GENITORI_SEPARATI ||
        this.tipoPatriaPodesta === TipoPatriaPodesta.AFFIDAMENTO_CONGIUNTO)
    );
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

  get luogoNascitaCompleto(): string {
    if (this.luogoNascitaEstero) {
      return `${this.luogoNascitaEstero} (${this.nazioneNascita || 'Estero'})`;
    }
    return `${this.comuneNascita || ''} (${this.nazioneNascita || 'Italia'})`;
  }

  // ==================== METHODS ====================

  sospendRelazione(motivo: string): void {
    this.statoRelazione = StatoRelazione.SOSPESA;
    this.motivoFine = motivo;
  }

  riattivaRelazione(): void {
    if (this.statoRelazione === StatoRelazione.SOSPESA) {
      this.statoRelazione = StatoRelazione.ATTIVA;
      this.motivoFine = undefined;
    }
  }

  terminaRelazione(motivo: string, dataFine?: Date): void {
    this.statoRelazione = StatoRelazione.SCADUTA;
    this.dataFine = dataFine || new Date();
    this.motivoFine = motivo;
    this.attivo = false;
  }

  revocaRelazione(motivo: string): void {
    this.statoRelazione = StatoRelazione.REVOCATA;
    this.dataFine = new Date();
    this.motivoFine = motivo;
    this.attivo = false;

    // Revoca tutti i permessi
    this.puoDareConsenso = false;
    this.puoAccedereCartella = false;
    this.puoRitirareReferti = false;
    this.puoPrenotareVisite = false;
    this.puoRicevereFatture = false;
  }

  // ==================== PERMESSI METHODS ====================

  grantPermessiCompleti(): void {
    if (this.isRelazioneAttiva) {
      this.puoDareConsenso = true;
      this.puoAccedereCartella = true;
      this.puoRitirareReferti = true;
      this.puoPrenotareVisite = true;
      this.puoRicevereFatture = true;
      this.puoEssereContattato = true;
    }
  }

  grantPermessiGenitore(): void {
    if (
      this.tipoRiferimento === TipoRiferimento.GENITORE &&
      this.isRelazioneAttiva
    ) {
      this.grantPermessiCompleti();
    }
  }

  grantPermessiTutore(): void {
    if (this.isTutoreLegale) {
      this.grantPermessiCompleti();
    }
  }

  grantPermessiAccompagnatore(): void {
    if (
      this.tipoRiferimento === TipoRiferimento.ACCOMPAGNATORE &&
      this.isRelazioneAttiva
    ) {
      this.puoDareConsenso = false; // Accompagnatore non può dare consenso
      this.puoAccedereCartella = false;
      this.puoRitirareReferti = true;
      this.puoPrenotareVisite = true;
      this.puoRicevereFatture = false;
      this.puoEssereContattato = true;
    }
  }

  revokeAllPermessi(): void {
    this.puoDareConsenso = false;
    this.puoAccedereCartella = false;
    this.puoRitirareReferti = false;
    this.puoPrenotareVisite = false;
    this.puoRicevereFatture = false;
    this.puoEssereContattato = false;
  }

  // ==================== VALIDATION METHODS ====================

  validatePatriaPodesta(): boolean {
    if (this.tipoRiferimento === TipoRiferimento.GENITORE) {
      return this.tipoPatriaPodesta !== null;
    }
    return true;
  }

  validateDocumentiLegali(): boolean {
    if (
      this.tipoRiferimento === TipoRiferimento.TUTORE_LEGALE ||
      this.tipoPatriaPodesta === TipoPatriaPodesta.TUTORE_NOMINATO
    ) {
      return !!(this.documentoNomina && this.dataNominaLegale);
    }
    return true;
  }

  validateDataValidita(): boolean {
    if (this.dataFine) {
      return this.dataInizio <= this.dataFine;
    }
    return true;
  }

  isValidForConsenso(): boolean {
    return (
      this.isRelazioneAttiva &&
      this.puoDareConsenso &&
      this.validatePatriaPodesta() &&
      this.validateDocumentiLegali()
    );
  }

  // ==================== GDPR METHODS ====================

  anonimizza(): void {
    this.nome = 'ANONIMO';
    this.cognome = 'RIFERIMENTO';
    this.codiceFiscale = undefined;
    this.email = undefined;
    this.pec = undefined;
    this.telefono = undefined;
    this.cellulare = undefined;
    this.fax = undefined;
    this.indirizzo = 'ANONIMIZZATO';
    this.note = undefined;
    this.noteLegali = 'DATI ANONIMIZZATI';
  }
}
