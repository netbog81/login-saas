// src/pazienti/entities/paziente-persona-relazione.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';

// ✅ IMPORT DAGLI ENUM CONDIVISI
import {
  TipoConsensoRichiesto,
  TipoTrattamentoConsenso,
  StatoConsenso,
} from '../enums/pazienti-enums';

// ✅ IMPORT TYPE per evitare dipendenze circolari
import type { Paziente } from './paziente.entity';
import type { PersonaRiferimento } from './persona-riferimento.entity';

@Entity('paziente_persona_relazioni')
@Index(['pazienteId', 'personaRiferimentoId'], { unique: true })
@Index(['tipoTrattamento', 'statoConsenso'])
@Index(['dataConsenso'])
@Unique(['pazienteId', 'personaRiferimentoId', 'tipoTrattamento'])
export class PazientePersonaRelazione {
  @PrimaryGeneratedColumn()
  id: number;

  // ==================== RELAZIONI PRINCIPALI ====================

  @Column({ name: 'paziente_id' })
  pazienteId: number;

  // ✅ LAZY LOADING per evitare dipendenze circolari
  @ManyToOne('Paziente', { onDelete: 'CASCADE', lazy: true })
  @JoinColumn({ name: 'paziente_id' })
  paziente: Promise<Paziente>;

  @Column({ name: 'persona_riferimento_id' })
  personaRiferimentoId: number;

  @ManyToOne('PersonaRiferimento', { onDelete: 'CASCADE', lazy: true })
  @JoinColumn({ name: 'persona_riferimento_id' })
  personaRiferimento: Promise<PersonaRiferimento>;

  // ==================== CONFIGURAZIONE CONSENSO ====================

  @Column({
    name: 'tipo_trattamento',
    type: 'enum',
    enum: TipoTrattamentoConsenso,
    nullable: true, // null = consenso generale per tutti i trattamenti
  })
  tipoTrattamento?: TipoTrattamentoConsenso;

  @Column({
    name: 'tipo_consenso_richiesto',
    type: 'enum',
    enum: TipoConsensoRichiesto,
    default: TipoConsensoRichiesto.SINGOLO_GENITORE,
  })
  tipoConsensoRichiesto: TipoConsensoRichiesto;

  @Column({
    name: 'stato_consenso',
    type: 'enum',
    enum: StatoConsenso,
    default: StatoConsenso.NON_RICHIESTO,
  })
  statoConsenso: StatoConsenso;

  // ==================== DATI CONSENSO ====================

  @Column({ name: 'consenso_dato', default: false })
  consensoDato: boolean;

  @Column({ name: 'data_consenso', type: 'timestamp', nullable: true })
  dataConsenso?: Date;

  @Column({ name: 'data_scadenza_consenso', type: 'timestamp', nullable: true })
  dataScadenzaConsenso?: Date;

  @Column({ name: 'modalita_consenso', length: 50, nullable: true })
  modalitaConsenso?: string; // 'cartaceo', 'digitale', 'verbale', 'telefono'

  @Column({ name: 'documento_consenso', length: 255, nullable: true })
  documentoConsenso?: string; // Path al documento firmato

  @Column({ name: 'firma_digitale', type: 'text', nullable: true })
  firmaDigitale?: string; // Hash della firma digitale

  // ==================== CONFIGURAZIONE ETA-SPECIFICA ====================

  @Column({ name: 'eta_minima_consenso_autonomo', nullable: true })
  etaMinimaConsensoAutonomo?: number; // Per questo tipo di trattamento

  @Column({ name: 'richiede_consenso_fino_eta', nullable: true })
  richiedeConsensoFinoEta?: number; // Es. psicologia fino a 16 anni

  @Column({ name: 'allow_consenso_minore', default: false })
  allowConsensoMinore: boolean; // Il minore può dare consenso autonomo

  // ==================== NOTE E MOTIVAZIONI (FIX TIPI) ====================

  @Column({ type: 'text', nullable: true })
  note?: string;

  // ✅ FIX CRITICO: Rimuovi "| null" dai tipi TypeScript
  @Column({ name: 'motivo_negazione', type: 'text', nullable: true })
  motivoNegazione?: string;

  @Column({ name: 'motivo_revoca', type: 'text', nullable: true })
  motivoRevoca?: string;

  // ==================== DATI AMMINISTRATIVI ====================

  @Column({ name: 'creato_da_utente_id', nullable: true })
  creatoDaUtenteId?: number;

  @Column({ name: 'consenso_raccolto_da_utente_id', nullable: true })
  consensoRaccoltoDaUtenteId?: number;

  @Column({ default: true })
  attivo: boolean;

  // ==================== TIMESTAMP ====================

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // ==================== COMPUTED PROPERTIES ====================

  get isConsensoValido(): boolean {
    if (!this.consensoDato) return false;
    if (this.statoConsenso === StatoConsenso.NEGATO) return false;
    if (this.statoConsenso === StatoConsenso.SCADUTO) return false;

    // Verifica scadenza
    if (this.dataScadenzaConsenso && new Date() > this.dataScadenzaConsenso) {
      return false;
    }

    return true;
  }

  get isConsensoScaduto(): boolean {
    return this.dataScadenzaConsenso
      ? new Date() > this.dataScadenzaConsenso
      : false;
  }

  get giorniRimanentiConsenso(): number | null {
    if (!this.dataScadenzaConsenso) return null;

    const diff = this.dataScadenzaConsenso.getTime() - new Date().getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  get requiresRinnovo(): boolean {
    const giorni = this.giorniRimanentiConsenso;
    return giorni !== null && giorni <= 30; // Rinnovo se scade entro 30 giorni
  }

  get isEmergenza(): boolean {
    return this.tipoTrattamento === TipoTrattamentoConsenso.EMERGENZA;
  }

  get isTrattamentoInvasivo(): boolean {
    return [
      TipoTrattamentoConsenso.TRATTAMENTO_INVASIVO,
      TipoTrattamentoConsenso.CHIRURGIA_MINORE,
      TipoTrattamentoConsenso.CHIRURGIA_MAGGIORE,
      TipoTrattamentoConsenso.ANESTESIA,
      TipoTrattamentoConsenso.SPERIMENTAZIONE,
    ].includes(this.tipoTrattamento!);
  }

  // ==================== METHODS (FIX CRITICO) ====================

  giveConsenso(modalita: string = 'cartaceo', documento?: string): void {
    this.consensoDato = true;
    this.dataConsenso = new Date();
    this.modalitaConsenso = modalita;
    this.documentoConsenso = documento;
    this.statoConsenso = StatoConsenso.COMPLETO;
    // ✅ FIX: Usa undefined invece di null
    this.motivoNegazione = undefined;
  }

  negaConsenso(motivo: string): void {
    this.consensoDato = false;
    this.statoConsenso = StatoConsenso.NEGATO;
    this.motivoNegazione = motivo;
    this.dataConsenso = new Date(); // Registra quando è stato negato
  }

  revocaConsenso(motivo: string): void {
    this.consensoDato = false;
    this.statoConsenso = StatoConsenso.NEGATO;
    this.motivoRevoca = motivo;
    this.dataConsenso = new Date(); // Aggiorna data revoca
  }

  setScadenzaConsenso(mesi: number = 12): void {
    const scadenza = new Date();
    scadenza.setMonth(scadenza.getMonth() + mesi);
    this.dataScadenzaConsenso = scadenza;
  }

  rinnovaConsenso(modalita: string = 'cartaceo', documento?: string): void {
    this.giveConsenso(modalita, documento);
    this.setScadenzaConsenso();
  }

  setConsensoDigitale(firma: string, documento: string): void {
    this.firmaDigitale = firma;
    this.giveConsenso('digitale', documento);
  }

  markAsScaduto(): void {
    this.statoConsenso = StatoConsenso.SCADUTO;
  }

  // ==================== VALIDATION METHODS ====================

  canGiveConsensoForAge(eta: number): boolean {
    if (
      this.etaMinimaConsensoAutonomo &&
      eta < this.etaMinimaConsensoAutonomo
    ) {
      return false;
    }

    if (this.richiedeConsensoFinoEta && eta >= this.richiedeConsensoFinoEta) {
      return true; // Non serve più consenso tutore
    }

    return this.allowConsensoMinore || eta >= 18;
  }

  isValidForTreatment(tipoTrattamento: TipoTrattamentoConsenso): boolean {
    // Consenso generale vale per tutti i trattamenti
    if (!this.tipoTrattamento) return this.isConsensoValido;

    // Consenso specifico deve matchare
    return this.tipoTrattamento === tipoTrattamento && this.isConsensoValido;
  }

  needsConsensoCongiunto(): boolean {
    return (
      this.tipoConsensoRichiesto === TipoConsensoRichiesto.ENTRAMBI_GENITORI
    );
  }

  isConsensoSufficiente(
    altriConsensi: PazientePersonaRelazione[] = [],
  ): boolean {
    if (!this.isConsensoValido) return false;

    switch (this.tipoConsensoRichiesto) {
      case TipoConsensoRichiesto.SINGOLO_GENITORE:
      case TipoConsensoRichiesto.SOLO_TUTORE:
      case TipoConsensoRichiesto.QUALSIASI_AUTORIZZATO:
        return true;

      case TipoConsensoRichiesto.ENTRAMBI_GENITORI:
        // Verifica che ci sia almeno un altro consenso valido da un genitore
        const altriConsensiValidi = altriConsensi.filter(
          (c) =>
            c.isConsensoValido &&
            c.personaRiferimentoId !== this.personaRiferimentoId,
        );
        return altriConsensiValidi.length > 0;

      default:
        return false;
    }
  }

  // ==================== AUDIT METHODS ====================

  getConsensoHistory(): string {
    const history: string[] = [];

    if (this.dataConsenso) {
      const azione = this.consensoDato ? 'CONSENSO_DATO' : 'CONSENSO_NEGATO';
      history.push(`${this.dataConsenso.toISOString()}: ${azione}`);
    }

    if (this.motivoRevoca) {
      history.push(`REVOCA: ${this.motivoRevoca}`);
    }

    return history.join('; ');
  }

  toAuditString(): string {
    return (
      `Paziente:${this.pazienteId} - Persona:${this.personaRiferimentoId} - ` +
      `Trattamento:${this.tipoTrattamento || 'GENERALE'} - ` +
      `Stato:${this.statoConsenso} - Data:${this.dataConsenso?.toISOString()}`
    );
  }
}
