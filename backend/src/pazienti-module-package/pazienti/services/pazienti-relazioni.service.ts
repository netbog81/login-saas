// src/pazienti/services/pazienti-relazioni.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';

// ✅ IMPORT DAGLI ENUM CONDIVISI
import {
  TipoRiferimento,
  TipoPatriaPodesta,
  StatoRelazione,
  TipoConsensoRichiesto,
  TipoTrattamentoConsenso,
  StatoConsenso,
  TipoPaziente,
} from '../enums/pazienti-enums';

// ✅ IMPORT ENTITÀ
import { Paziente } from '../entities/paziente.entity';
import { PersonaRiferimento } from '../entities/persona-riferimento.entity';
import { PazientePersonaRelazione } from '../entities/paziente-persona-relazione.entity';

export interface CreatePersonaRiferimentoDto {
  // Dati anagrafici
  nome: string;
  cognome: string;
  codiceFiscale?: string;
  dataNascita?: Date | string;
  genere?: 'M' | 'F' | 'A' | 'N'; // Stringhe invece dell'enum

  // Contatti
  telefono?: string;
  cellulare?: string;
  email?: string;
  indirizzo?: string;

  // Tipo relazione
  tipoRiferimento: TipoRiferimento;
  tipoPatriaPodesta?: TipoPatriaPodesta;

  // Permessi
  puoDareConsenso?: boolean;
  puoAccedereCartella?: boolean;
  puoRitirareReferti?: boolean;
  puoPrenotareVisite?: boolean;
  puoRicevereFatture?: boolean;

  // Date validità
  dataInizio?: Date | string;
  dataFine?: Date | string;

  // Dati legali (per tutori)
  documentoNomina?: string;
  numeroPraticaTribunale?: string;
  tribunaleCompetente?: string;
  dataNominaLegale?: Date | string;

  note?: string;
}

export interface ConsensoRequestDto {
  pazienteId: number;
  personaRiferimentoId: number;
  tipoTrattamento?: TipoTrattamentoConsenso;
  tipoConsensoRichiesto?: TipoConsensoRichiesto;
  etaMinimaConsensoAutonomo?: number;
  richiedeConsensoFinoEta?: number;
  dataScadenzaMesi?: number; // Scadenza in mesi da oggi
}

export interface ConsensoResponseDto {
  pazienteId: number;
  personaRiferimentoId: number;
  consensoDato: boolean;
  modalitaConsenso: string;
  documentoConsenso?: string;
  firmaDigitale?: string;
  note?: string;
}

@Injectable()
export class PazientiRelazioniService {
  constructor(
    @InjectRepository(Paziente)
    private readonly pazientiRepository: Repository<Paziente>,

    @InjectRepository(PersonaRiferimento)
    private readonly personeRiferimentoRepository: Repository<PersonaRiferimento>,

    @InjectRepository(PazientePersonaRelazione)
    private readonly relazioniRepository: Repository<PazientePersonaRelazione>,
  ) {}

  // ==================== GESTIONE PERSONE RIFERIMENTO ====================

  async addPersonaRiferimento(
    pazienteId: number,
    createDto: CreatePersonaRiferimentoDto,
    cretedByUserId?: number,
  ): Promise<PersonaRiferimento> {
    const paziente = await this.pazientiRepository.findOne({
      where: { id: pazienteId },
    });

    if (!paziente) {
      throw new NotFoundException('Paziente non trovato');
    }

    // Validazioni business
    await this.validatePersonaRiferimento(createDto, paziente);

    // Controllo duplicati CF
    if (createDto.codiceFiscale) {
      const existing = await this.personeRiferimentoRepository.findOne({
        where: { codiceFiscale: createDto.codiceFiscale },
      });
      if (existing) {
        throw new ConflictException('Codice fiscale già esistente');
      }
    }

    // Crea persona riferimento
    const persona = this.personeRiferimentoRepository.create({
      nome: createDto.nome,
      cognome: createDto.cognome,
      codiceFiscale: createDto.codiceFiscale,
      dataNascita: createDto.dataNascita,
      telefono: createDto.telefono,
      cellulare: createDto.cellulare,
      email: createDto.email,
      indirizzo: createDto.indirizzo,
      tipoRiferimento: createDto.tipoRiferimento,
      tipoPatriaPodesta: createDto.tipoPatriaPodesta,
      documentoNomina: createDto.documentoNomina,
      numeroPraticaTribunale: createDto.numeroPraticaTribunale,
      tribunaleCompetente: createDto.tribunaleCompetente,
      dataNominaLegale: createDto.dataNominaLegale,
      note: createDto.note,
      pazienteId,
      dataInizio: createDto.dataInizio || new Date(),
      creatoDaUtenteId: cretedByUserId,
    });

    // Imposta permessi di default basati sul tipo
    this.setPermessiDefault(persona);

    const savedPersona = await this.personeRiferimentoRepository.save(persona);

    // Se è un genitore con patria podestà, crea relazione consenso di default
    if (
      persona.tipoRiferimento === TipoRiferimento.GENITORE &&
      persona.puoDareConsenso
    ) {
      await this.createDefaultConsensoRelation(pazienteId, savedPersona.id);
    }

    return savedPersona;
  }

  async updatePersonaRiferimento(
    personaId: number,
    updateDto: Partial<CreatePersonaRiferimentoDto>,
    modifiedByUserId?: number,
  ): Promise<PersonaRiferimento> {
    const persona = await this.personeRiferimentoRepository.findOne({
      where: { id: personaId },
    });

    if (!persona) {
      throw new NotFoundException('Persona riferimento non trovata');
    }

    // Validazioni per modifiche critiche
    if (
      updateDto.tipoRiferimento &&
      updateDto.tipoRiferimento !== persona.tipoRiferimento
    ) {
      await this.validateCambioTipoRiferimento(
        persona,
        updateDto.tipoRiferimento,
      );
    }

    Object.assign(persona, updateDto);
    persona.modificatoDaUtenteId = modifiedByUserId;

    return await this.personeRiferimentoRepository.save(persona);
  }

  async removePersonaRiferimento(
    personaId: number,
    motivo: string,
    removedByUserId?: number,
  ): Promise<void> {
    const persona = await this.personeRiferimentoRepository.findOne({
      where: { id: personaId },
    });

    if (!persona) {
      throw new NotFoundException('Persona riferimento non trovata');
    }

    // Validazioni per rimozione
    await this.validateRimozionePersona(persona);

    // Termina relazione invece di eliminare (per audit)
    persona.terminaRelazione(motivo);
    persona.modificatoDaUtenteId = removedByUserId;

    await this.personeRiferimentoRepository.save(persona);

    // Revoca tutti i consensi attivi
    await this.revocaAllConsensi(persona.pazienteId, personaId, motivo);
  }

  // ==================== GESTIONE CONSENSI ====================

  async createConsensoRequest(
    requestDto: ConsensoRequestDto,
  ): Promise<PazientePersonaRelazione> {
    const { pazienteId, personaRiferimentoId } = requestDto;

    // Validazioni
    await this.validateConsensoRequest(requestDto);

    const relazione = this.relazioniRepository.create({
      ...requestDto,
      statoConsenso: StatoConsenso.RICHIESTO,
    });

    return await this.relazioniRepository.save(relazione);
  }

  async giveConsenso(
    relazioneId: number,
    responseDto: ConsensoResponseDto,
    collectedByUserId?: number,
  ): Promise<PazientePersonaRelazione> {
    const relazione = await this.relazioniRepository.findOne({
      where: { id: relazioneId },
    });

    if (!relazione) {
      throw new NotFoundException('Richiesta consenso non trovata');
    }

    // Validazioni
    await this.validateConsensoResponse(relazione, responseDto);

    // Aggiorna consenso
    if (responseDto.consensoDato) {
      relazione.giveConsenso(
        responseDto.modalitaConsenso,
        responseDto.documentoConsenso,
      );

      if (responseDto.firmaDigitale) {
        relazione.setConsensoDigitale(
          responseDto.firmaDigitale,
          responseDto.documentoConsenso!,
        );
      }
    } else {
      relazione.negaConsenso(responseDto.note || 'Consenso negato');
    }

    relazione.consensoRaccoltoDaUtenteId = collectedByUserId;

    return await this.relazioniRepository.save(relazione);
  }

  async checkConsensoForTreatment(
    pazienteId: number,
    tipoTrattamento: TipoTrattamentoConsenso,
  ): Promise<{
    consensoValido: boolean;
    consensiRichiesti: PazientePersonaRelazione[];
    consensiOttenuti: PazientePersonaRelazione[];
    motivoRifiuto?: string;
  }> {
    const paziente = await this.pazientiRepository.findOne({
      where: { id: pazienteId },
    });

    if (!paziente) {
      throw new NotFoundException('Paziente non trovato');
    }

    // Se maggiorenne, non serve consenso tutori
    if (paziente.isMaggiorenne) {
      return {
        consensoValido: true,
        consensiRichiesti: [],
        consensiOttenuti: [],
      };
    }

    // Cerca consensi esistenti per questo trattamento
    const consensiEsistenti = await this.relazioniRepository.find({
      where: [
        { pazienteId, tipoTrattamento }, // Consenso specifico
        { pazienteId, tipoTrattamento: IsNull() }, // Consenso generale
      ],
    });

    const consensiOttenuti = consensiEsistenti.filter(
      (c) => c.isConsensoValido,
    );
    const consensiRichiesti = consensiEsistenti.filter(
      (c) =>
        c.statoConsenso === StatoConsenso.RICHIESTO ||
        c.statoConsenso === StatoConsenso.PARZIALE,
    );

    // Logica validazione consenso
    const result = await this.validateConsensoCompleto(
      paziente,
      consensiOttenuti,
      tipoTrattamento,
    );

    return {
      consensoValido: result.valido,
      consensiRichiesti,
      consensiOttenuti,
      motivoRifiuto: result.motivo,
    };
  }

  async getConsensiScadenti(
    giorni: number = 30,
  ): Promise<PazientePersonaRelazione[]> {
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() + giorni);

    return await this.relazioniRepository
      .createQueryBuilder('relazione')
      .where('relazione.dataScadenzaConsenso <= :dataLimite', { dataLimite })
      .andWhere('relazione.statoConsenso = :stato', {
        stato: StatoConsenso.COMPLETO,
      })
      .andWhere('relazione.attivo = true')
      .getMany();
  }

  async rinnovaConsensiScaduti(): Promise<void> {
    const consensiScaduti = await this.relazioniRepository.find({
      where: {
        statoConsenso: StatoConsenso.COMPLETO,
        attivo: true,
      },
    });

    for (const consenso of consensiScaduti) {
      if (consenso.isConsensoScaduto) {
        consenso.markAsScaduto();
        await this.relazioniRepository.save(consenso);
      }
    }
  }

  // ==================== METODI DI RICERCA ====================

  async getPersoneRiferimentoByPaziente(
    pazienteId: number,
  ): Promise<PersonaRiferimento[]> {
    return await this.personeRiferimentoRepository.find({
      where: { pazienteId, attivo: true },
      order: { tipoRiferimento: 'ASC', dataInizio: 'DESC' },
    });
  }

  async getPersoneRiferimentoByTipo(
    pazienteId: number,
    tipo: TipoRiferimento,
  ): Promise<PersonaRiferimento[]> {
    return await this.personeRiferimentoRepository.find({
      where: {
        pazienteId,
        tipoRiferimento: tipo,
        statoRelazione: StatoRelazione.ATTIVA,
        attivo: true,
      },
    });
  }

  async findPersonaRiferimentoByCodiceFiscale(
    codiceFiscale: string,
  ): Promise<PersonaRiferimento | null> {
    return await this.personeRiferimentoRepository.findOne({
      where: { codiceFiscale },
    });
  }

  async getConsensiByPaziente(
    pazienteId: number,
  ): Promise<PazientePersonaRelazione[]> {
    return await this.relazioniRepository.find({
      where: { pazienteId },
      order: { dataConsenso: 'DESC' },
    });
  }

  async getConsensiByPersona(
    personaRiferimentoId: number,
  ): Promise<PazientePersonaRelazione[]> {
    return await this.relazioniRepository.find({
      where: { personaRiferimentoId },
      order: { dataConsenso: 'DESC' },
    });
  }

  // ==================== METODI PRIVATI DI VALIDAZIONE ====================

  private async validatePersonaRiferimento(
    createDto: CreatePersonaRiferimentoDto,
    paziente: Paziente,
  ): Promise<void> {
    // Validazione età vs tipo riferimento
    if (
      createDto.tipoRiferimento === TipoRiferimento.GENITORE &&
      paziente.isMaggiorenne
    ) {
      throw new BadRequestException(
        'Paziente maggiorenne non può avere nuovi genitori con patria podestà',
      );
    }

    // Validazione documenti legali per tutori
    if (createDto.tipoRiferimento === TipoRiferimento.TUTORE_LEGALE) {
      if (!createDto.documentoNomina || !createDto.dataNominaLegale) {
        throw new BadRequestException(
          'Tutore legale richiede documento di nomina e data',
        );
      }
    }

    // Validazione patria podestà
    if (
      createDto.tipoRiferimento === TipoRiferimento.GENITORE &&
      !createDto.tipoPatriaPodesta
    ) {
      throw new BadRequestException(
        'Genitore deve specificare tipo patria podestà',
      );
    }
  }

  private setPermessiDefault(persona: PersonaRiferimento): void {
    switch (persona.tipoRiferimento) {
      case TipoRiferimento.GENITORE:
        persona.grantPermessiGenitore();
        break;

      case TipoRiferimento.TUTORE_LEGALE:
        persona.grantPermessiTutore();
        break;

      case TipoRiferimento.ACCOMPAGNATORE:
        persona.grantPermessiAccompagnatore();
        break;

      case TipoRiferimento.CONIUGE:
        persona.puoDareConsenso = false; // Solo per maggiorenni
        persona.puoAccedereCartella = true;
        persona.puoRitirareReferti = true;
        persona.puoPrenotareVisite = true;
        persona.puoRicevereFatture = true;
        break;

      default:
        // Permessi minimi per altri tipi
        persona.puoEssereContattato = true;
        break;
    }
  }

  private async createDefaultConsensoRelation(
    pazienteId: number,
    personaRiferimentoId: number,
  ): Promise<void> {
    const defaultRelazione = this.relazioniRepository.create({
      pazienteId,
      personaRiferimentoId,
      // tipoTrattamento rimane undefined per consenso generale
      tipoConsensoRichiesto: TipoConsensoRichiesto.SINGOLO_GENITORE,
      statoConsenso: StatoConsenso.NON_RICHIESTO,
    });

    await this.relazioniRepository.save(defaultRelazione);
  }

  private async validateCambioTipoRiferimento(
    persona: PersonaRiferimento,
    nuovoTipo: TipoRiferimento,
  ): Promise<void> {
    // Non permettere cambio da genitore a altro se ci sono consensi attivi
    if (
      persona.tipoRiferimento === TipoRiferimento.GENITORE &&
      nuovoTipo !== TipoRiferimento.GENITORE
    ) {
      const consensiAttivi = await this.relazioniRepository.count({
        where: {
          personaRiferimentoId: persona.id,
          statoConsenso: StatoConsenso.COMPLETO,
        },
      });

      if (consensiAttivi > 0) {
        throw new BadRequestException(
          'Impossibile cambiare tipo: esistono consensi attivi',
        );
      }
    }
  }

  private async validateRimozionePersona(
    persona: PersonaRiferimento,
  ): Promise<void> {
    // Verifica se è l'unico genitore/tutore
    if (
      persona.tipoRiferimento === TipoRiferimento.GENITORE ||
      persona.isTutoreLegale
    ) {
      const altriTutori = await this.personeRiferimentoRepository
        .createQueryBuilder('persona')
        .where('persona.pazienteId = :pazienteId', {
          pazienteId: persona.pazienteId,
        })
        .andWhere('persona.id != :personaId', { personaId: persona.id })
        .andWhere('persona.statoRelazione = :stato', {
          stato: StatoRelazione.ATTIVA,
        })
        .andWhere('persona.puoDareConsenso = true')
        .getCount();

      const paziente = await this.pazientiRepository.findOne({
        where: { id: persona.pazienteId },
      });

      if (paziente?.isMinorenne && altriTutori === 0) {
        throw new BadRequestException(
          'Impossibile rimuovere unico tutore di paziente minorenne',
        );
      }
    }
  }

  private async validateConsensoRequest(
    requestDto: ConsensoRequestDto,
  ): Promise<void> {
    const paziente = await this.pazientiRepository.findOne({
      where: { id: requestDto.pazienteId },
    });
    const persona = await this.personeRiferimentoRepository.findOne({
      where: { id: requestDto.personaRiferimentoId },
    });

    if (!paziente) throw new NotFoundException('Paziente non trovato');
    if (!persona)
      throw new NotFoundException('Persona riferimento non trovata');
    if (!persona.isRelazioneAttiva)
      throw new BadRequestException('Relazione non attiva');
    if (!persona.puoDareConsenso)
      throw new BadRequestException('Persona non autorizzata a dare consenso');

    // Verifica se esiste già una richiesta attiva
    const existing = await this.relazioniRepository.findOne({
      where: {
        pazienteId: requestDto.pazienteId,
        personaRiferimentoId: requestDto.personaRiferimentoId,
        tipoTrattamento: requestDto.tipoTrattamento || IsNull(),
        statoConsenso: StatoConsenso.RICHIESTO,
      },
    });

    if (existing) {
      throw new ConflictException('Richiesta consenso già esistente');
    }
  }

  private async validateConsensoResponse(
    relazione: PazientePersonaRelazione,
    responseDto: ConsensoResponseDto,
  ): Promise<void> {
    if (relazione.statoConsenso !== StatoConsenso.RICHIESTO) {
      throw new BadRequestException('Consenso non in stato richiesto');
    }

    const persona = await this.personeRiferimentoRepository.findOne({
      where: { id: relazione.personaRiferimentoId },
    });

    if (!persona?.isRelazioneAttiva) {
      throw new BadRequestException('Relazione persona non più attiva');
    }

    if (responseDto.consensoDato && !responseDto.modalitaConsenso) {
      throw new BadRequestException(
        'Modalità consenso richiesta se consenso dato',
      );
    }

    if (
      responseDto.modalitaConsenso === 'digitale' &&
      !responseDto.firmaDigitale
    ) {
      throw new BadRequestException(
        'Firma digitale richiesta per consenso digitale',
      );
    }
  }

  private async validateConsensoCompleto(
    paziente: Paziente,
    consensiOttenuti: PazientePersonaRelazione[],
    tipoTrattamento: TipoTrattamentoConsenso,
  ): Promise<{ valido: boolean; motivo?: string }> {
    if (consensiOttenuti.length === 0) {
      return { valido: false, motivo: 'Nessun consenso ottenuto' };
    }

    // Verifica se richiede consenso congiunto
    const richiedeCongiunto = consensiOttenuti.some((c) =>
      c.needsConsensoCongiunto(),
    );

    if (richiedeCongiunto) {
      const genitori = await this.getPersoneRiferimentoByTipo(
        paziente.id,
        TipoRiferimento.GENITORE,
      );
      const consensiGenitori = consensiOttenuti.filter((c) =>
        genitori.some((g) => g.id === c.personaRiferimentoId),
      );

      if (consensiGenitori.length < 2) {
        return {
          valido: false,
          motivo: 'Richiesto consenso di entrambi i genitori',
        };
      }
    }

    // Verifica validità specifiche per tipo trattamento
    const consensiValidiPerTipo = consensiOttenuti.filter((c) =>
      c.isValidForTreatment(tipoTrattamento),
    );

    if (consensiValidiPerTipo.length === 0) {
      return {
        valido: false,
        motivo: 'Nessun consenso valido per questo tipo di trattamento',
      };
    }

    return { valido: true };
  }

  private async revocaAllConsensi(
    pazienteId: number,
    personaRiferimentoId: number,
    motivo: string,
  ): Promise<void> {
    await this.relazioniRepository
      .createQueryBuilder()
      .update(PazientePersonaRelazione)
      .set({
        statoConsenso: StatoConsenso.NEGATO,
        motivoRevoca: motivo,
        attivo: false,
      })
      .where('pazienteId = :pazienteId', { pazienteId })
      .andWhere('personaRiferimentoId = :personaRiferimentoId', {
        personaRiferimentoId,
      })
      .andWhere('statoConsenso = :stato', { stato: StatoConsenso.COMPLETO })
      .execute();
  }

  // ==================== METODI UTILITY ====================

  async getStatisticheConsensi(pazienteId: number): Promise<{
    totaleConsensi: number;
    consensiAttivi: number;
    consensiScaduti: number;
    consensiNegati: number;
    prossimeScadenze: PazientePersonaRelazione[];
  }> {
    const tutti = await this.getConsensiByPaziente(pazienteId);

    return {
      totaleConsensi: tutti.length,
      consensiAttivi: tutti.filter(
        (c) => c.statoConsenso === StatoConsenso.COMPLETO,
      ).length,
      consensiScaduti: tutti.filter(
        (c) => c.statoConsenso === StatoConsenso.SCADUTO,
      ).length,
      consensiNegati: tutti.filter(
        (c) => c.statoConsenso === StatoConsenso.NEGATO,
      ).length,
      prossimeScadenze: tutti.filter((c) => c.requiresRinnovo).slice(0, 5),
    };
  }

  async generateConsensoReport(pazienteId: number): Promise<string> {
    const paziente = await this.pazientiRepository.findOne({
      where: { id: pazienteId },
    });

    if (!paziente) throw new NotFoundException('Paziente non trovato');

    const consensi = await this.getConsensiByPaziente(pazienteId);
    const stats = await this.getStatisticheConsensi(pazienteId);

    let report = `REPORT CONSENSI - ${paziente.nomeCompleto}\n`;
    report += `Data generazione: ${new Date().toLocaleString('it-IT')}\n\n`;
    report += `STATISTICHE:\n`;
    report += `- Totale consensi: ${stats.totaleConsensi}\n`;
    report += `- Attivi: ${stats.consensiAttivi}\n`;
    report += `- Scaduti: ${stats.consensiScaduti}\n`;
    report += `- Negati: ${stats.consensiNegati}\n\n`;

    report += `DETTAGLIO CONSENSI:\n`;
    for (const consenso of consensi) {
      report += `${consenso.toAuditString()}\n`;
    }

    return report;
  }
}
