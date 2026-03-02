// src/pazienti/pazienti.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  Like,
  In,
  MoreThan,
  LessThanOrEqual,
  IsNull,
} from 'typeorm';
import { Patient } from '../../entities/patient.entity';
import { PersonaRiferimento } from '../entities/persona-riferimento.entity';
import { PazientePersonaRelazione } from '../entities/paziente-persona-relazione.entity';

// ✅ IMPORT DAGLI ENUM CONDIVISI
import {
  StatoAnagrafica,
  StatoPrivacy,
  TipoPaziente,
} from '../enums/pazienti-enums';

import {
  CreatePazienteDto,
  UpdatePazienteDto,
  PazienteResponseDto,
  SearchPazientiDto,
  SetPrivacyDto,
  UpdateConsensiDto,
  WorkflowStateDto,
  GdprRequestDto,
} from '../dto';

@Injectable()
export class PazientiService {
  constructor(
    @InjectRepository(Patient)
    private readonly pazientiRepository: Repository<Patient>,

    @InjectRepository(PersonaRiferimento)
    private readonly personeRiferimentoRepository: Repository<PersonaRiferimento>,

    @InjectRepository(PazientePersonaRelazione)
    private readonly relazioniRepository: Repository<PazientePersonaRelazione>,
  ) {}

  // ==================== CRUD BASE ====================

  // ==================== METODO FINDALL CORRETTO ====================
  async findAll(searchDto?: SearchPazientiDto): Promise<Patient[]> {
    console.log('🔍 FindAll CON FILTRI chiamato:', searchDto);
    console.log(
      '🔍 soloMinorenni value:',
      searchDto?.soloMinorenni,
      'type:',
      typeof searchDto?.soloMinorenni,
    );

    try {
      const queryBuilder =
        this.pazientiRepository.createQueryBuilder('paziente');

      // ✅ FILTRO BASE OBBLIGATORIO: Solo pazienti attivi
      queryBuilder.where('paziente.attivo = :attivo', { attivo: true });

      // ✅ FILTRI OPZIONALI: Solo se effettivamente presenti e validi
      if (searchDto?.search && searchDto.search.trim().length > 0) {
        console.log(`🔍 Applicando filtro search: "${searchDto.search}"`);
        queryBuilder.andWhere(
          "(LOWER(paziente.nome) LIKE LOWER(:search) OR LOWER(paziente.cognome) LIKE LOWER(:search) OR LOWER(CONCAT(paziente.nome, ' ', paziente.cognome)) LIKE LOWER(:search))",
          { search: `%${searchDto.search.trim()}%` },
        );
      }

      // 🔧 FIX: Verifica che il valore sia una stringa valida e non vuota
      if (
        searchDto?.statoAnagrafica &&
        typeof searchDto.statoAnagrafica === 'string' &&
        searchDto.statoAnagrafica.trim().length > 0
      ) {
        console.log(
          `🔍 Applicando filtro statoAnagrafica: "${searchDto.statoAnagrafica}"`,
        );
        queryBuilder.andWhere('paziente.statoAnagrafica = :statoAnagrafica', {
          statoAnagrafica: searchDto.statoAnagrafica,
        });
      }

      // 🔧 FIX: Stessa verifica per statoPrivacy
      if (
        searchDto?.statoPrivacy &&
        typeof searchDto.statoPrivacy === 'string' &&
        searchDto.statoPrivacy.trim().length > 0
      ) {
        console.log(
          `🔍 Applicando filtro statoPrivacy: "${searchDto.statoPrivacy}"`,
        );
        queryBuilder.andWhere('paziente.statoPrivacy = :statoPrivacy', {
          statoPrivacy: searchDto.statoPrivacy,
        });
      }

      // 🚨 FIX CRITICO: Controlla esplicitamente solo se è esattamente true
      if (searchDto?.soloMinorenni === true) {
        console.log('🔍 Applicando filtro solo minorenni');
        const dataLimite = new Date();
        dataLimite.setFullYear(dataLimite.getFullYear() - 18);
        queryBuilder.andWhere('paziente.dataNascita > :dataLimite', {
          dataLimite,
        });
      } else {
        console.log(
          `🔍 NO filtro minorenni - soloMinorenni = ${searchDto?.soloMinorenni} (${typeof searchDto?.soloMinorenni})`,
        );
      }

      // ✅ PAGINAZIONE SICURA con default sensati
      const limit =
        searchDto?.limit && searchDto.limit > 0
          ? Math.min(searchDto.limit, 100)
          : 50;
      const offset =
        searchDto?.offset && searchDto.offset >= 0 ? searchDto.offset : 0;

      queryBuilder
        .orderBy('paziente.cognome', 'ASC')
        .addOrderBy('paziente.nome', 'ASC')
        .limit(limit)
        .offset(offset);

      // ✅ DEBUG AVANZATO
      const sql = queryBuilder.getSql();
      const parameters = queryBuilder.getParameters();
      console.log('🔍 Query SQL generata:', sql);
      console.log('🔍 Parametri query:', parameters);

      // ✅ ESECUZIONE QUERY
      const pazienti = await queryBuilder.getMany();
      console.log(`🔍 Query eseguita - Trovati ${pazienti.length} pazienti`);

      // 🔧 FIX: Diagnosi migliorata se non trova niente
      if (pazienti.length === 0) {
        const totalCount = await this.pazientiRepository.count();
        const activeCount = await this.pazientiRepository.count({
          where: { attivo: true },
        });

        console.log(`⚠️ Nessun paziente trovato con questi filtri`);
        console.log(`📊 Debug DB: Totali=${totalCount}, Attivi=${activeCount}`);

        // Se non ci sono pazienti attivi ma ci sono pazienti totali
        if (totalCount > 0 && activeCount === 0) {
          console.log(
            `🚨 PROBLEMA: Ci sono ${totalCount} pazienti nel DB ma nessuno è attivo!`,
          );
        }

        // Se ci sono pazienti attivi ma la query non li trova
        if (activeCount > 0) {
          console.log(
            `🚨 PROBLEMA: Ci sono ${activeCount} pazienti attivi ma i filtri li escludono`,
          );
          console.log('🔍 Filtri applicati:', {
            search: searchDto?.search,
            statoAnagrafica: searchDto?.statoAnagrafica,
            statoPrivacy: searchDto?.statoPrivacy,
            soloMinorenni: searchDto?.soloMinorenni,
            soloMinorenniType: typeof searchDto?.soloMinorenni,
          });
        }

        return [];
      }

      console.log(
        `✅ FindAll completato: ${pazienti.length} pazienti restituiti`,
      );
      return pazienti;
    } catch (error) {
      console.error('❌ ERRORE CRITICO in findAll:', error);
      console.error('❌ Stack:', error.stack);
      throw new BadRequestException(
        `Errore nel recuperare la lista pazienti: ${error.message}`,
      );
    }
  }
  // ==================== METODO ALTERNATIVO: SENZA QUERY BUILDER ====================

  // ==================== METODO FINDALLSIMPLE MIGLIORATO ====================
  async findAllSimple(
    searchDto?: SearchPazientiDto,
  ): Promise<PazienteResponseDto[]> {
    console.log('🔍 FindAllSimple chiamato (senza QueryBuilder):', searchDto);

    try {
      // ✅ APPROCCIO SEMPLICE: find() con where conditions
      const whereConditions: any = { attivo: true };

      // 🔧 Aggiungi filtri solo se presenti e validi
      if (
        searchDto?.statoAnagrafica &&
        typeof searchDto.statoAnagrafica === 'string' &&
        searchDto.statoAnagrafica.trim().length > 0
      ) {
        whereConditions.statoAnagrafica = searchDto.statoAnagrafica;
        console.log(`🔍 Filtro statoAnagrafica: ${searchDto.statoAnagrafica}`);
      }

      if (
        searchDto?.statoPrivacy &&
        typeof searchDto.statoPrivacy === 'string' &&
        searchDto.statoPrivacy.trim().length > 0
      ) {
        whereConditions.statoPrivacy = searchDto.statoPrivacy;
        console.log(`🔍 Filtro statoPrivacy: ${searchDto.statoPrivacy}`);
      }

      // 🚨 FIX CRITICO: Controlla esplicitamente che sia esattamente true
      if (searchDto?.soloMinorenni === true) {
        const dataLimite = new Date();
        dataLimite.setFullYear(dataLimite.getFullYear() - 18);
        whereConditions.dataNascita = MoreThan(dataLimite);
        console.log(
          `🔍 Filtro solo minorenni: nati dopo ${dataLimite.toISOString().split('T')[0]}`,
        );
      } else {
        console.log(
          `🔍 NO filtro minorenni - soloMinorenni = ${searchDto?.soloMinorenni}`,
        );
      }

      const findOptions = {
        where: whereConditions,
        order: { cognome: 'ASC', nome: 'ASC' } as any,
        take: Math.min(searchDto?.limit || 50, 100),
        skip: Math.max(searchDto?.offset || 0, 0),
      };

      console.log('🔍 Query find() con opzioni:', findOptions);
      console.log('🔍 WHERE conditions applicate:', whereConditions);

      const pazienti = await this.pazientiRepository.find(findOptions);

      console.log(
        `🔍 Query semplice eseguita - Trovati ${pazienti.length} pazienti`,
      );

      // 🔧 Debug se non trova niente
      if (pazienti.length === 0) {
        const totalCount = await this.pazientiRepository.count();
        const activeCount = await this.pazientiRepository.count({
          where: { attivo: true },
        });

        console.log(`⚠️ Nessun paziente trovato`);
        console.log(`📊 Debug DB: Totali=${totalCount}, Attivi=${activeCount}`);
        console.log(`🔍 Condizioni WHERE applicate:`, whereConditions);

        return [];
      }

      // ✅ MAPPING CON LOG DETTAGLIATO
      console.log('🔄 Inizio mapping pazienti...');
      const result = pazienti.map((p, index) => {
        try {
          console.log(
            `   🔄 Mappando paziente ID ${p.id}: ${p.nome} ${p.cognome}`,
          );
          const mapped = this.mapToResponseDto(p);
          console.log(
            `   ✅ [${index + 1}] ${p.nome} ${p.cognome} mappato correttamente`,
          );
          return mapped;
        } catch (error) {
          console.error(`   ❌ Errore mapping paziente ${p.id}:`, error);
          throw error;
        }
      });

      console.log(
        `✅ FindAllSimple completato: ${result.length} pazienti restituiti`,
      );
      return result;
    } catch (error) {
      console.error('❌ Errore in findAllSimple:', error);
      console.error('❌ Stack:', error.stack);
      throw new BadRequestException(
        `Errore nel recuperare la lista pazienti: ${error.message}`,
      );
    }
  }
  ////////////////////////////////////   inizio findTutti

  async findTutti(): Promise<PazienteResponseDto[]> {
    console.log('🔍 FindTutti chiamato - cerco TUTTI i pazienti senza filtri');

    try {
      // ✅ QUERY SEMPLICE: trova tutti i pazienti ordinati
      const pazienti = await this.pazientiRepository.find({
        order: {
          cognome: 'ASC',
          nome: 'ASC',
        },
        take: 100, // Limite sicurezza per non sovraccaricare
      });

      console.log(
        `🔍 Query eseguita: SELECT * FROM pazienti ORDER BY cognome, nome LIMIT 100`,
      );
      console.log(
        `🔍 Trovati ${pazienti.length} pazienti nel DB (inclusi non attivi)`,
      );

      if (pazienti.length === 0) {
        console.log(
          '⚠️ FIND TUTTI: Database completamente vuoto - nessun paziente presente',
        );
        return [];
      }

      // ✅ MAPPA RISULTATI con log dettagliato
      const result = pazienti.map((p, index) => {
        console.log(
          `🔍 [${index + 1}] Mapping paziente: ${p.nome} ${p.cognome} (ID: ${p.id}, Attivo: ${p.attivo})`,
        );

        try {
          const mapped = this.mapToResponseDto(p);
          console.log(`   ✅ Mapping OK per ${p.nome} ${p.cognome}`);
          return mapped;
        } catch (mappingError) {
          console.error(
            `   ❌ Errore mapping per ${p.nome} ${p.cognome}:`,
            mappingError,
          );
          throw mappingError;
        }
      });

      console.log(
        `✅ FindTutti completato: restituiti ${result.length} pazienti`,
      );
      return result;
    } catch (error) {
      console.error('❌ Errore in findTutti:', error);
      throw new BadRequestException(
        `Errore nel recuperare la lista pazienti: ${error.message}`,
      );
    }
  }

  // ✅ METODI DI SUPPORTO PER DEBUG
  async countAll(): Promise<number> {
    try {
      const count = await this.pazientiRepository.count();
      console.log(`📊 Conteggio totale pazienti: ${count}`);
      return count;
    } catch (error) {
      console.error('❌ Errore nel conteggio pazienti:', error);
      return 0;
    }
  }

  async countAttivi(): Promise<number> {
    try {
      const count = await this.pazientiRepository.count({
        where: { attivo: true },
      });
      console.log(`📊 Conteggio pazienti attivi: ${count}`);
      return count;
    } catch (error) {
      console.error('❌ Errore nel conteggio pazienti attivi:', error);
      return 0;
    }
  }

  ////////////////////////////////////   fine findTutti
  async findOne(id: string): Promise<Patient> {
    // ✅ CORREZIONE CRITICA: Rimuovi relations per evitare lazy loading conflicts
    const paziente = await this.pazientiRepository.findOne({
      where: { id },
      // ❌ NON includere relations: ['personeRiferimento'] con lazy loading
    });

    if (!paziente) {
      throw new NotFoundException(`Paziente con ID ${id} non trovato`);
    }

    return paziente;
  }

  async findOneWithDetails(id: string): Promise<PazienteResponseDto> {
    const paziente = await this.findOne(id);
    return this.mapToResponseDto(paziente);
  }

  async create(createDto: CreatePazienteDto): Promise<Patient> {
    // Validazioni business
    await this.validatePazienteData(createDto);

    // Controllo duplicati CF
    if (createDto.codiceFiscale) {
      const existing = await this.pazientiRepository.findOne({
        where: { codiceFiscale: createDto.codiceFiscale },
      });
      if (existing) {
        throw new ConflictException(
          'Paziente con questo codice fiscale già esistente',
        );
      }
    }

    // Converti date string in Date objects e sanitizza stringhe vuote
    // PostgreSQL tratta '' come valore non-NULL, causando violazioni di unicità
    const pazienteData = {
      ...createDto,
      dataNascita: createDto.dataNascita
        ? new Date(createDto.dataNascita)
        : undefined,
      nazioneNascita: createDto.nazioneNascita || 'Italia',
      nazioneResidenza: createDto.nazioneResidenza || 'Italia',
      // Sanitizza campi con vincoli unique: stringhe vuote -> undefined
      email: createDto.email?.trim() || undefined,
      codiceFiscale: createDto.codiceFiscale?.trim() || undefined,
      // Sanitizza altri campi opzionali per coerenza
      telefono: createDto.telefono?.trim() || undefined,
      cellulare: createDto.cellulare?.trim() || undefined,
      pec: createDto.pec?.trim() || undefined,
      fax: createDto.fax?.trim() || undefined,
      notes: createDto.notes?.trim() || undefined,
    };

    const paziente = this.pazientiRepository.create(pazienteData);

    // Determina tipo paziente automaticamente
    if (paziente.dataNascita) {
      paziente.tipoPaziente = paziente.isMinorenne
        ? TipoPaziente.MINORENNE
        : TipoPaziente.ADULTO_AUTONOMO;
    }

    // Genera codice paziente se non fornito
    if (!paziente.codicePaziente) {
      paziente.codicePaziente = await this.generateCodicePaziente();
    }

    // Imposta date conservazione GDPR
    paziente.updateConservazioneDate();

    return await this.pazientiRepository.save(paziente);
  }

  async update(id: string, updateDto: UpdatePazienteDto): Promise<Patient> {
    const paziente = await this.findOne(id);

    // Validazioni per modifiche critiche
    if (
      updateDto.codiceFiscale &&
      updateDto.codiceFiscale !== paziente.codiceFiscale
    ) {
      const existing = await this.pazientiRepository.findOne({
        where: { codiceFiscale: updateDto.codiceFiscale },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException(
          'Codice fiscale già utilizzato da altro paziente',
        );
      }
    }

    // Converti date string in Date objects
    const updateData = {
      ...updateDto,
      dataNascita: updateDto.dataNascita
        ? new Date(updateDto.dataNascita)
        : undefined,
    };

    Object.assign(paziente, updateData);

    // Ricalcola tipo paziente se è cambiata la data di nascita
    if (updateDto.dataNascita && paziente.dataNascita) {
      paziente.tipoPaziente = paziente.isMinorenne
        ? TipoPaziente.MINORENNE
        : TipoPaziente.ADULTO_AUTONOMO;
    }

    return await this.pazientiRepository.save(paziente);
  }

  async remove(id: string): Promise<void> {
    const paziente = await this.findOne(id);

    // Verifica se ha relazioni attive
    const relazioniAttive = await this.personeRiferimentoRepository.count({
      where: { pazienteId: id, attivo: true },
    });

    if (relazioniAttive > 0) {
      throw new BadRequestException(
        'Impossibile eliminare paziente con persone di riferimento attive',
      );
    }

    // Soft delete - segna come non attivo
    paziente.attivo = false;
    await this.pazientiRepository.save(paziente);
  }

  // ==================== WORKFLOW STATI ====================

  async updateWorkflowState(
    id: string,
    workflowDto: WorkflowStateDto,
  ): Promise<Patient> {
    const paziente = await this.findOne(id);

    switch (workflowDto.azione) {
      case 'promote_parziale':
        if (paziente.statoAnagrafica === StatoAnagrafica.BOZZA) {
          paziente.promoteToAnagraficaParziale();
        } else {
          throw new BadRequestException('Paziente non in stato BOZZA');
        }
        break;

      case 'promote_completa':
        if (!paziente.isDatiFatturazioneCompleti) {
          throw new BadRequestException('Dati fatturazione incompleti');
        }
        if (paziente.statoPrivacy === StatoPrivacy.NON_ACQUISITA) {
          throw new BadRequestException('Privacy non acquisita');
        }
        paziente.promoteToAnagraficaCompleta();
        break;

      case 'mark_verification':
        paziente.requiresDataVerification();
        break;

      default:
        throw new BadRequestException('Azione workflow non valida');
    }

    if (workflowDto.note) {
      paziente.noteAmministrative =
        (paziente.noteAmministrative || '') +
        `\n${new Date().toISOString()}: ${workflowDto.note}`;
    }

    return await this.pazientiRepository.save(paziente);
  }

  // ==================== PRIVACY E GDPR ====================

  async setPrivacy(id: string, privacyDto: SetPrivacyDto): Promise<Patient> {
    const paziente = await this.findOne(id);

    if (privacyDto.tipoPrivacy === 'cartacea') {
      paziente.setPrivacyCartacea();
    } else if (privacyDto.tipoPrivacy === 'digitale') {
      paziente.setPrivacyDigitale();
    }

    if (privacyDto.note) {
      paziente.noteAmministrative =
        (paziente.noteAmministrative || '') +
        `\nPrivacy ${privacyDto.tipoPrivacy}: ${privacyDto.note}`;
    }

    // Auto-promozione a PARZIALE se era in BOZZA
    if (paziente.statoAnagrafica === StatoAnagrafica.BOZZA) {
      paziente.promoteToAnagraficaParziale();
    }

    return await this.pazientiRepository.save(paziente);
  }

  async updateConsensi(
    id: string,
    consensiDto: UpdateConsensiDto,
  ): Promise<Patient> {
    const paziente = await this.findOne(id);

    if (consensiDto.consensoMarketing !== undefined) {
      paziente.consensoMarketing = consensiDto.consensoMarketing;
    }

    if (consensiDto.consensoRicercaMedica !== undefined) {
      paziente.consensoRicercaMedica = consensiDto.consensoRicercaMedica;
    }

    if (consensiDto.modalitaConsensoPerTrattamento !== undefined) {
      paziente.modalitaConsensoPerTrattamento =
        consensiDto.modalitaConsensoPerTrattamento;
    }

    paziente.dataUltimaModificaPrivacy = new Date();

    return await this.pazientiRepository.save(paziente);
  }

  async handleGdprRequest(id: string, gdprDto: GdprRequestDto): Promise<any> {
    const paziente = await this.findOne(id);

    switch (gdprDto.tipoRichiesta) {
      case 'export_data':
        return this.exportPazienteData(paziente);

      case 'request_deletion':
        paziente.requestCancellazione();
        if (gdprDto.motivazione) {
          paziente.noteAmministrative =
            (paziente.noteAmministrative || '') +
            `\nRichiesta cancellazione: ${gdprDto.motivazione}`;
        }
        await this.pazientiRepository.save(paziente);
        return { message: 'Richiesta cancellazione registrata' };

      case 'revoke_consent':
        paziente.revokeConsensoPrincipal();
        if (gdprDto.motivazione) {
          paziente.noteAmministrative =
            (paziente.noteAmministrative || '') +
            `\nRevoca consenso: ${gdprDto.motivazione}`;
        }
        await this.pazientiRepository.save(paziente);
        return { message: 'Consenso revocato' };

      default:
        throw new BadRequestException('Tipo richiesta GDPR non valida');
    }
  }

  // ==================== RICERCA AVANZATA ====================

  /**
   * Ricerca avanzata con filtri multipli (usato dal resolver GraphQL)
   */
  async search(searchInput: any): Promise<Patient[]> {
    const queryBuilder = this.pazientiRepository.createQueryBuilder('paziente');
    queryBuilder.where('paziente.attivo = :attivo', { attivo: true });

    if (searchInput.nome) {
      queryBuilder.andWhere('LOWER(paziente.nome) LIKE LOWER(:nome)', {
        nome: `%${searchInput.nome}%`,
      });
    }

    if (searchInput.cognome) {
      queryBuilder.andWhere('LOWER(paziente.cognome) LIKE LOWER(:cognome)', {
        cognome: `%${searchInput.cognome}%`,
      });
    }

    if (searchInput.nomeCompleto) {
      queryBuilder.andWhere(
        "LOWER(CONCAT(paziente.nome, ' ', paziente.cognome)) LIKE LOWER(:nomeCompleto)",
        { nomeCompleto: `%${searchInput.nomeCompleto}%` },
      );
    }

    if (searchInput.codiceFiscale) {
      queryBuilder.andWhere('paziente.codiceFiscale = :codiceFiscale', {
        codiceFiscale: searchInput.codiceFiscale,
      });
    }

    if (searchInput.telefono) {
      queryBuilder.andWhere(
        '(paziente.telefono LIKE :telefono OR paziente.cellulare LIKE :telefono)',
        { telefono: `%${searchInput.telefono}%` },
      );
    }

    if (searchInput.email) {
      queryBuilder.andWhere('LOWER(paziente.email) LIKE LOWER(:email)', {
        email: `%${searchInput.email}%`,
      });
    }

    if (searchInput.genere) {
      queryBuilder.andWhere('paziente.genere = :genere', {
        genere: searchInput.genere,
      });
    }

    if (searchInput.tipoPaziente) {
      queryBuilder.andWhere('paziente.tipoPaziente = :tipoPaziente', {
        tipoPaziente: searchInput.tipoPaziente,
      });
    }

    if (searchInput.statoAnagrafica) {
      queryBuilder.andWhere('paziente.statoAnagrafica = :statoAnagrafica', {
        statoAnagrafica: searchInput.statoAnagrafica,
      });
    }

    if (searchInput.statoPrivacy) {
      queryBuilder.andWhere('paziente.statoPrivacy = :statoPrivacy', {
        statoPrivacy: searchInput.statoPrivacy,
      });
    }

    if (searchInput.consensoPrivacy !== undefined) {
      queryBuilder.andWhere('paziente.consensoPrivacy = :consensoPrivacy', {
        consensoPrivacy: searchInput.consensoPrivacy,
      });
    }

    if (searchInput.consensoMarketing !== undefined) {
      queryBuilder.andWhere('paziente.consensoMarketing = :consensoMarketing', {
        consensoMarketing: searchInput.consensoMarketing,
      });
    }

    if (searchInput.richiestaCancellazione !== undefined) {
      queryBuilder.andWhere(
        'paziente.richiestaCancellazione = :richiestaCancellazione',
        { richiestaCancellazione: searchInput.richiestaCancellazione },
      );
    }

    // Sorting
    const sortBy = searchInput.sortBy || 'cognome';
    const sortOrder = searchInput.sortOrder || 'ASC';
    queryBuilder.orderBy(`paziente.${sortBy}`, sortOrder);

    // Pagination
    const limit = Math.min(searchInput.limit || 20, 100);
    const offset = searchInput.offset || 0;
    queryBuilder.limit(limit).offset(offset);

    return await queryBuilder.getMany();
  }

  async searchByCodiceFiscale(codiceFiscale: string): Promise<Patient | null> {
    return await this.pazientiRepository.findOne({
      where: { codiceFiscale },
    });
  }

  /**
   * Alias per searchByCodiceFiscale (usato dal resolver)
   */
  async findByCodiceFiscale(codiceFiscale: string): Promise<Patient | null> {
    return this.searchByCodiceFiscale(codiceFiscale);
  }

  /**
   * Trova paziente per email
   */
  async findByEmail(email: string): Promise<Patient | null> {
    return await this.pazientiRepository.findOne({
      where: { email, attivo: true },
    });
  }

  /**
   * Trova pazienti per numero di telefono
   */
  async searchByTelefono(telefono: string): Promise<Patient[]> {
    return await this.pazientiRepository.find({
      where: [
        { telefono: Like(`%${telefono}%`), attivo: true },
        { cellulare: Like(`%${telefono}%`), attivo: true },
      ],
      take: 10,
    });
  }

  /**
   * Trova pazienti per numero di telefono (alias)
   */
  async findByPhone(telefono: string): Promise<Patient[]> {
    return this.searchByTelefono(telefono);
  }

  /**
   * Trova pazienti per stato privacy
   */
  async findByStatoPrivacy(statoPrivacy: string): Promise<Patient[]> {
    return await this.pazientiRepository.find({
      where: { statoPrivacy: statoPrivacy as StatoPrivacy, attivo: true },
      order: { cognome: 'ASC', nome: 'ASC' },
    });
  }

  /**
   * Trova pazienti per stato anagrafica
   */
  async findByStatoAnagrafica(statoAnagrafica: string): Promise<Patient[]> {
    return await this.pazientiRepository.find({
      where: { statoAnagrafica: statoAnagrafica as StatoAnagrafica, attivo: true },
      order: { cognome: 'ASC', nome: 'ASC' },
    });
  }

  /**
   * Conta tutti i pazienti attivi
   */
  async count(): Promise<number> {
    return await this.pazientiRepository.count({
      where: { attivo: true },
    });
  }

  /**
   * Aggiorna stato anagrafica
   */
  async updateStatoAnagrafica(id: string, status: string): Promise<Patient> {
    const paziente = await this.findOne(id);
    paziente.statoAnagrafica = status as StatoAnagrafica;
    return await this.pazientiRepository.save(paziente);
  }

  /**
   * Aggiorna stato privacy
   */
  async updateStatoPrivacy(id: string, status: string): Promise<Patient> {
    const paziente = await this.findOne(id);
    paziente.statoPrivacy = status as StatoPrivacy;
    paziente.dataUltimaModificaPrivacy = new Date();
    return await this.pazientiRepository.save(paziente);
  }

  /**
   * Aggiorna consensi (usato dal resolver GraphQL)
   */
  async updateConsents(id: string, consents: any): Promise<Patient> {
    const paziente = await this.findOne(id);

    if (consents.consensoGdpr !== undefined) {
      paziente.consensoPrivacy = consents.consensoGdpr;
      if (consents.consensoGdpr) {
        paziente.dataConsensoPrivacy = new Date();
      }
    }

    if (consents.consensoMarketing !== undefined) {
      paziente.consensoMarketing = consents.consensoMarketing;
    }

    if (consents.consensoComunicazioneTerzi !== undefined) {
      paziente.consensoComunicazioneTerzi = consents.consensoComunicazioneTerzi;
    }

    paziente.dataUltimaModificaPrivacy = new Date();
    return await this.pazientiRepository.save(paziente);
  }

  /**
   * Richiede cancellazione dati (GDPR)
   */
  async requestDeletion(id: string): Promise<Patient> {
    const paziente = await this.findOne(id);
    paziente.requestCancellazione();
    return await this.pazientiRepository.save(paziente);
  }

  /**
   * Anonimizza paziente (GDPR)
   */
  async anonymize(id: string): Promise<Patient> {
    const paziente = await this.findOne(id);
    paziente.anonimizza();
    return await this.pazientiRepository.save(paziente);
  }

  /**
   * Incrementa contatore (cancellazioni o no-show)
   */
  async incrementCounter(
    id: string,
    field: 'cancellationsByYear' | 'noShowsByYear',
    year: string,
  ): Promise<Patient> {
    const paziente = await this.findOne(id);

    if (!paziente[field]) {
      paziente[field] = {};
    }

    paziente[field][year] = (paziente[field][year] || 0) + 1;
    return await this.pazientiRepository.save(paziente);
  }

  /**
   * Elimina paziente (soft delete) - usato dal resolver
   */
  async delete(id: string): Promise<void> {
    return this.remove(id);
  }

  async getPazientiMinorenni(): Promise<Patient[]> {
    const dataLimite = new Date();
    dataLimite.setFullYear(dataLimite.getFullYear() - 18);

    // ✅ CORREZIONE: Rimuovi relations per evitare lazy loading conflicts
    return await this.pazientiRepository.find({
      where: [
        {
          dataNascita: MoreThan(dataLimite), // Data nascita maggiore di 18 anni fa
          attivo: true,
        },
        {
          dataNascita: IsNull(), // Include anche quelli senza data di nascita
          attivo: true,
          tipoPaziente: TipoPaziente.MINORENNE,
        },
      ],
      // ❌ NON includere relations: ['personeRiferimento']
    });
  }

  async getPazientiInScadenzaGdpr(): Promise<Patient[]> {
    const oggi = new Date();
    const fra30Giorni = new Date();
    fra30Giorni.setDate(oggi.getDate() + 30);

    return await this.pazientiRepository.find({
      where: [
        {
          conservazioneFino: IsNull(), // Pazienti che potrebbero aver bisogno di aggiornamento date
          attivo: true,
        },
        {
          conservazioneFino: LessThanOrEqual(fra30Giorni), // In scadenza entro 30 giorni
          attivo: true,
        },
      ],
    });
  }

  // ==================== METODI UTILITY PRIVATI ====================

  private async validatePazienteData(
    createDto: CreatePazienteDto,
  ): Promise<void> {
    // Verifica che abbia almeno un contatto (ignora stringhe vuote)
    const telefono = createDto.telefono?.trim();
    const cellulare = createDto.cellulare?.trim();
    const email = createDto.email?.trim();

    if (!telefono && !cellulare && !email) {
      throw new BadRequestException(
        'Almeno un contatto (telefono, cellulare o email) è obbligatorio',
      );
    }

    // Verifica date logiche
    if (createDto.dataNascita) {
      const nascita = new Date(createDto.dataNascita);
      const oggi = new Date();

      if (nascita > oggi) {
        throw new BadRequestException('Data di nascita non può essere futura');
      }

      const eta = oggi.getFullYear() - nascita.getFullYear();
      if (eta > 150) {
        throw new BadRequestException('Età non realistica');
      }
    }
  }

  private async generateCodicePaziente(): Promise<string> {
    const anno = new Date().getFullYear().toString().slice(-2);
    const prefix = `PAZ${anno}`;

    // Trova l'ultimo codice paziente per quest'anno per evitare duplicati
    const lastPatient = await this.pazientiRepository
      .createQueryBuilder('paziente')
      .where('paziente.codicePaziente LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('paziente.codicePaziente', 'DESC')
      .getOne();

    let progressivo = 1;
    if (lastPatient?.codicePaziente) {
      // Estrae il numero progressivo dall'ultimo codice (es. PAZ25000123 -> 123)
      const lastNumber = parseInt(lastPatient.codicePaziente.slice(-6), 10);
      if (!isNaN(lastNumber)) {
        progressivo = lastNumber + 1;
      }
    }

    return `${prefix}${progressivo.toString().padStart(6, '0')}`;
  }

  //////// inizio mia map to response dto
  private mapToResponseDto(paziente: Patient): PazienteResponseDto {
    try {
      console.log(
        `   🔄 Mappando paziente ID ${paziente.id}: ${paziente.nome} ${paziente.cognome}`,
      );

      return {
        id: paziente.id,
        nomeCompleto: paziente.nomeCompleto, // Usa getter
        eta: paziente.eta, // Usa getter
        statoAnagrafica: paziente.statoAnagrafica,
        statoPrivacy: paziente.statoPrivacy,
        canCreateAppuntamento: paziente.canCreateAppuntamento, // Usa getter
        canProceedToVisita: paziente.canProceedToVisita, // Usa getter
        canEmitFattura: paziente.canEmitFattura, // Usa getter
        hasContattoTelefonico: paziente.hasContattoTelefonico, // Usa getter
        telefonoPrincipale:
          paziente.cellulare || paziente.telefono || undefined,
        emailPrincipale: paziente.email || paziente.pec || undefined,
        createdAt: paziente.createdAt,
        updatedAt: paziente.updatedAt,
      };
    } catch (error) {
      console.error(
        `   ❌ Errore nel mapping del paziente ${paziente.id}:`,
        error,
      );
      console.error(`   📋 Dati paziente:`, {
        id: paziente.id,
        nome: paziente.nome,
        cognome: paziente.cognome,
        dataNascita: paziente.dataNascita,
        statoAnagrafica: paziente.statoAnagrafica,
        statoPrivacy: paziente.statoPrivacy,
      });
      throw error;
    }
  }
  //////// fine mia mapto response dto

  /*
  private mapToResponseDto(paziente: Patient): PazienteResponseDto {
    return {
      id: paziente.id,
      nomeCompleto: paziente.nomeCompleto,
      eta: paziente.eta,
      statoAnagrafica: paziente.statoAnagrafica,
      statoPrivacy: paziente.statoPrivacy,
      canCreateAppuntamento: paziente.canCreateAppuntamento,
      canProceedToVisita: paziente.canProceedToVisita,
      canEmitFattura: paziente.canEmitFattura,
      hasContattoTelefonico: paziente.hasContattoTelefonico,
      telefonoPrincipale: paziente.cellulare || paziente.telefono || undefined,
      emailPrincipale: paziente.email || paziente.pec || undefined,
      createdAt: paziente.createdAt,
      updatedAt: paziente.updatedAt
    };
  }*/

  private async exportPazienteData(paziente: Patient): Promise<any> {
    const persone = await this.personeRiferimentoRepository.find({
      where: { pazienteId: paziente.id },
    });

    const consensi = await this.relazioniRepository.find({
      where: { pazienteId: paziente.id },
    });

    return {
      paziente: {
        ...paziente,
        // Rimuovi campi sensibili interni
        password: undefined,
      },
      personeRiferimento: persone,
      consensi: consensi,
      exportDate: new Date().toISOString(),
      note: 'Export dati personali secondo GDPR Art. 20',
    };
  }
}
