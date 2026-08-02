import { Injectable, Logger } from '@nestjs/common';
import { In } from 'typeorm';
import {
  AvailabilityAppointment,
  BookingStatus,
  ConflictReason,
} from '../entities/availability-appointment.entity';
import {
  AvailabilityException,
  ExceptionType,
} from '../entities/availability-exception.entity';
import { AppointmentType } from '../entities/appointment-type.enum';
import { findBlockingException } from '../utils/day-exception-semantics.util';
import { GymExceptionService } from './gym-exception.service';
import { AvailabilityService } from './availability.service';
import { GeneralSettingsService } from '../../settings/services/general-settings.service';
import { TenantContextService } from '@curandis/tenant-datasource';

const SETTINGS_KEY = 'conflicts.lastRevalidationAt';
const COOLDOWN_MS = 2 * 60 * 60 * 1000; // 2 ore

/**
 * Service per la revalidazione periodica dei flag `hasConflict` sugli
 * appointment. Verifica runtime se ogni conflitto marcato è ancora reale
 * e rimuove i flag stale.
 *
 * Due modalità:
 *
 * 1. **revalidateIfNeeded()** — "check pigro" chiamato dal frontend al
 *    caricamento della pagina principale. Esegue la revalidazione solo se
 *    sono passate ≥ 2 ore dall'ultima esecuzione (cooldown). Gira nel
 *    contesto HTTP della request → tenant context corretto via search_path.
 *
 * 2. **revalidateAll()** — revalidazione senza cooldown, usabile da
 *    getConflictedAppointments per on-read revalidation (opzione B).
 *
 * Flusso per ciascun appointment con hasConflict=true:
 * - Appuntamenti non più attivi (svolti/cancellati/no-show): il conflitto è
 *   operativamente irrilevante → azzerato in blocco.
 * - Assenze operatore (OPERATOR_SICK / OPERATOR_VACATION /
 *   OPERATOR_UNAVAILABLE): il conflitto è ancora reale se
 *   un'AvailabilityException dell'operatore copre ancora lo slot (stesso
 *   predicato di checkAndMarkConflictForOperatorAppointment); per i GYM, in
 *   aggiunta, se lo slot risulta scoperto da un'eccezione palestra
 *   (getEffectiveOperator → isUncovered=true, nessun sostituto).
 * - TEMPLATE_CHANGE (solo standard: la disponibilità palestra ha regole
 *   proprie): il conflitto è risolto se l'appuntamento ricade interamente
 *   nelle fasce di disponibilità correnti dell'operatore
 *   (AvailabilityService.getOperatorsRawBands — template meno assenze, senza
 *   sottrarre gli appuntamenti). Necessario perché la detection al cambio
 *   template marca in blocco TUTTI gli appuntamenti futuri dell'operatore.
 * - RECURRING_APPOINTMENT resta a risoluzione manuale.
 */
@Injectable()
export class ConflictRevalidationService {
  private readonly logger = new Logger(ConflictRevalidationService.name);

  constructor(
    private readonly tenantContext: TenantContextService,
    private gymExceptionService: GymExceptionService,
    private settingsService: GeneralSettingsService,
    private availabilityService: AvailabilityService,
  ){}

  /** DataSource del tenant corrente (AsyncLocalStorage). */
  private get dataSource() {
    const ds = this.tenantContext.getDataSource();
    if (!ds) throw new Error('No tenant DataSource in current request context');
    return ds;
  }

  private get appointmentRepo() { return this.dataSource.getRepository(AvailabilityAppointment); }

  /**
   * Esegue la revalidazione solo se sono passate ≥ COOLDOWN_MS dall'ultima.
   * Ritorna il numero di conflitti risolti (0 se skip per cooldown).
   */
  async revalidateIfNeeded(): Promise<{ skipped: boolean; resolved: number }> {
    const lastRun = await this.settingsService.getValue<string | null>(
      SETTINGS_KEY,
      null,
    );

    if (lastRun) {
      const elapsed = Date.now() - new Date(lastRun).getTime();
      if (elapsed < COOLDOWN_MS) {
        return { skipped: true, resolved: 0 };
      }
    }

    const resolved = await this.revalidateAll();

    // Aggiorna timestamp
    await this.settingsService.upsert(SETTINGS_KEY, new Date().toISOString(), {
      description: 'Ultimo check di revalidazione conflitti',
      valueType: 'string',
      category: 'conflicts',
    });

    return { skipped: false, resolved };
  }

  /**
   * Revalida TUTTI gli appointment con hasConflict=true. Rimuove il flag
   * per quelli il cui conflitto non è più reale.
   * Ritorna il numero di flag rimossi.
   */
  async revalidateAll(): Promise<number> {
    // 0. Appuntamenti non più attivi (svolti/cancellati/no-show): l'elenco
    //    conflitti li mostrerebbe ma nessuna azione ha più senso → azzera.
    const staleResult = await this.appointmentRepo
      .createQueryBuilder()
      .update(AvailabilityAppointment)
      .set({
        hasConflict: false,
        conflictReason: null as any,
        conflictDetectedAt: null as any,
        conflictSourceExceptionId: null as any,
      })
      .where('"hasConflict" = true')
      .andWhere('"bookingStatus" NOT IN (:...active)', {
        active: [BookingStatus.SCHEDULED, BookingStatus.CONFIRMED],
      })
      .execute();
    let resolved = staleResult.affected ?? 0;
    if (resolved > 0) {
      this.logger.log(
        `Revalidazione conflitti: ${resolved} flag azzerati su appuntamenti non più attivi`,
      );
    }

    const conflictedAppointments = await this.appointmentRepo.find({
      where: {
        hasConflict: true,
        bookingStatus: In([BookingStatus.SCHEDULED, BookingStatus.CONFIRMED]),
      },
    });

    if (conflictedAppointments.length === 0) {
      return resolved;
    }

    this.logger.log(
      `Revalidazione conflitti: ${conflictedAppointments.length} appointment da verificare`,
    );

    const ABSENCE_REASONS = [
      ConflictReason.OPERATOR_SICK,
      ConflictReason.OPERATOR_VACATION,
      ConflictReason.OPERATOR_UNAVAILABLE,
    ];

    const toResolve: string[] = [];

    // --- 1. Conflitti da assenza operatore ---
    for (const apt of conflictedAppointments) {
      if (!apt.conflictReason || !ABSENCE_REASONS.includes(apt.conflictReason)) {
        continue;
      }
      if (!apt.operatorId) continue;

      try {
        // Assenza generica operatore ancora attiva sullo slot?
        let stillReal = await this.isCoveredByOperatorAbsence(apt);

        // GYM: slot ancora scoperto da un'eccezione palestra?
        if (!stillReal && apt.appointmentType === AppointmentType.GYM && apt.gymRoomId) {
          const result = await this.gymExceptionService.getEffectiveOperator(
            apt.gymRoomId,
            apt.operatorId,
            apt.appointmentDate,
            apt.startTime,
          );
          stillReal = result.isUncovered;
        }

        if (!stillReal) {
          toResolve.push(apt.id);
        }
      } catch {
        // Se la verifica fallisce (es. operatore cancellato), lasciamo il
        // conflitto — la segreteria lo gestirà manualmente.
      }
    }

    // --- 2. Conflitti da cambio template (solo standard) ---
    // La detection al cambio template marca in blocco tutti gli appuntamenti
    // futuri dell'operatore: qui verifichiamo davvero, contro le fasce di
    // disponibilità correnti (template meno assenze, appuntamenti esclusi).
    const templateConflicts = conflictedAppointments.filter(
      (apt) =>
        apt.conflictReason === ConflictReason.TEMPLATE_CHANGE &&
        apt.appointmentType !== AppointmentType.GYM &&
        !!apt.operatorId,
    );
    if (templateConflicts.length > 0) {
      try {
        const dateStrs = templateConflicts.map((a) => this.toDateStr(a.appointmentDate));
        const minDate = dateStrs.reduce((a, b) => (a < b ? a : b));
        const maxDate = dateStrs.reduce((a, b) => (a > b ? a : b));
        const operatorIds = [...new Set(templateConflicts.map((a) => a.operatorId!))];

        const bands = await this.availabilityService.getOperatorsRawBands(
          operatorIds,
          minDate,
          maxDate,
        );

        for (const apt of templateConflicts) {
          const dayBands =
            bands.get(`${apt.operatorId}|${this.toDateStr(apt.appointmentDate)}`) || [];
          if (this.isIntervalCovered(apt.startTime, apt.endTime, dayBands)) {
            toResolve.push(apt.id);
          }
        }
      } catch (err: any) {
        this.logger.error(
          `Revalidazione conflitti TEMPLATE_CHANGE fallita: ${err?.message}`,
        );
      }
    }

    if (toResolve.length > 0) {
      await this.appointmentRepo.update(toResolve, {
        hasConflict: false,
        // null esplicito: TypeORM ignora i campi undefined nell'update
        conflictReason: null as any,
        conflictDetectedAt: null as any,
        conflictSourceExceptionId: null as any,
      });

      this.logger.log(
        `Revalidazione conflitti: ${toResolve.length} conflitti risolti automaticamente`,
      );
    }

    return resolved + toResolve.length;
  }

  /** Normalizza una data (Date o stringa ISO) in 'YYYY-MM-DD'. */
  private toDateStr(d: Date | string): string {
    return d instanceof Date
      ? d.toISOString().split('T')[0]
      : String(d).split('T')[0];
  }

  /**
   * True se [startTime, endTime] è interamente coperto dalle fasce (in
   * minuti). Le fasce contigue/sovrapposte vengono fuse, come nel guard
   * assertWithinAvailability.
   */
  private isIntervalCovered(
    startTime: string,
    endTime: string,
    bands: { start: number; end: number }[],
  ): boolean {
    const toMin = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + (m || 0);
    };
    const start = toMin(startTime);
    const end = toMin(endTime);
    if (end <= start || bands.length === 0) return false;

    const sorted = [...bands].sort((a, b) => a.start - b.start);
    const merged: { start: number; end: number }[] = [];
    for (const b of sorted) {
      const last = merged[merged.length - 1];
      if (last && b.start <= last.end) {
        last.end = Math.max(last.end, b.end);
      } else {
        merged.push({ ...b });
      }
    }
    return merged.some((r) => r.start <= start && r.end >= end);
  }

  /**
   * True se lo slot dell'appuntamento è ancora coperto da un'assenza
   * operatore (AvailabilityException). Stesso predicato del check allo
   * spostamento appuntamenti (checkAndMarkConflictForOperatorAppointment),
   * centralizzato in day-exception-semantics.util.ts.
   */
  private async isCoveredByOperatorAbsence(
    apt: AvailabilityAppointment,
  ): Promise<boolean> {
    const exceptions = await this.dataSource
      .getRepository(AvailabilityException)
      .find({
        where: {
          operatorId: apt.operatorId,
          exceptionDate: apt.appointmentDate,
        },
      });
    if (exceptions.length === 0) return false;

    return findBlockingException(exceptions, apt.startTime, apt.endTime) !== null;
  }
}
