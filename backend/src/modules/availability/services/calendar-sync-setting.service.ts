import { Injectable, Logger } from '@nestjs/common';
import { TenantContextService } from '@curandis/tenant-datasource';
import { CalendarSyncSetting } from '../entities/calendar-sync-setting.entity';

/**
 * Impostazioni di sincronizzazione verso i calendari esterni.
 *
 * Riguardano solo cosa finisce su Google e nel feed ICS. Il gestionale
 * conserva sempre tutto.
 */
@Injectable()
export class CalendarSyncSettingService {
  private readonly logger = new Logger(CalendarSyncSettingService.name);

  constructor(private readonly tenantContext: TenantContextService) {}

  private get repo() {
    const ds = this.tenantContext.getDataSource();
    if (!ds) throw new Error('Nessun DataSource di tenant nel contesto corrente');
    return ds.getRepository(CalendarSyncSetting);
  }

  /**
   * La riga del tenant, creata al volo se manca.
   *
   * Non restituisce mai null: un tenant senza riga (creato prima di questa
   * tabella, o migrazione a meta') deve comportarsi come quelli con i valori
   * di default, non far fallire una sincronizzazione.
   */
  async get(): Promise<CalendarSyncSetting> {
    const existing = await this.repo.findOne({ where: {} });
    if (existing) return existing;

    this.logger.warn('Impostazioni di sincronizzazione mancanti: create con i valori di default');
    return this.repo.save(this.repo.create({}));
  }

  async update(input: {
    keepPastAppointments?: boolean;
    keepCalendarOnDisconnect?: boolean;
  }): Promise<CalendarSyncSetting> {
    const setting = await this.get();
    if (input.keepPastAppointments !== undefined) {
      setting.keepPastAppointments = input.keepPastAppointments;
    }
    if (input.keepCalendarOnDisconnect !== undefined) {
      setting.keepCalendarOnDisconnect = input.keepCalendarOnDisconnect;
    }
    const saved = await this.repo.save(setting);
    this.logger.log(
      `Sincronizzazione calendari: passati ${saved.keepPastAppointments ? 'mantenuti' : 'rimossi'}, `
      + `calendario allo scollegamento ${saved.keepCalendarOnDisconnect ? 'mantenuto' : 'cancellato'}`,
    );
    return saved;
  }

  /**
   * Da quale data il calendario esterno deve mostrare gli appuntamenti.
   *
   * Con "mantieni passati" acceso si risale fino al giorno del collegamento:
   * e' il punto da cui il calendario dell'operatore ha cominciato a esistere,
   * e piu' indietro non c'e' mai stato niente da vedere. Spento, si parte da
   * oggi.
   *
   * `fallbackDays` serve al feed ICS, che non ha una data di collegamento
   * perche' non e' un collegamento: e' un indirizzo che qualcuno scarica.
   */
  async pastBound(params: {
    connectedAt?: Date | null;
    fallbackDays: number;
    now?: Date;
  }): Promise<Date> {
    const now = params.now ?? new Date();
    const setting = await this.get();

    if (!setting.keepPastAppointments) {
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);
      return today;
    }

    const window = new Date(now);
    window.setDate(window.getDate() - params.fallbackDays);

    // Si prende la PIU' LONTANA fra la data del collegamento e la finestra
    // fissa. Prendendo solo il collegamento, un operatore appena collegato non
    // avrebbe nessun passato da mantenere e l'impostazione sembrerebbe non
    // fare niente; prendendo solo la finestra, chi e' collegato da mesi
    // perderebbe tutto quello che c'e' prima. Cosi' vale sempre la piu'
    // generosa delle due, che e' quello che "mantieni i passati" promette.
    if (params.connectedAt) {
      const connected = new Date(params.connectedAt);
      return connected < window ? connected : window;
    }

    return window;
  }
}
