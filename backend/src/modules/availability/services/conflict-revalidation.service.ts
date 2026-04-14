import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import {
  AvailabilityAppointment,
  BookingStatus,
} from '../entities/availability-appointment.entity';
import { AppointmentType } from '../entities/appointment-type.enum';
import { GymExceptionService } from './gym-exception.service';
import { GeneralSettingsService } from '../../settings/services/general-settings.service';

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
 * - Se l'appointment non è GYM, skip (non gestiamo eccezioni per standard).
 * - Se operatorId o gymRoomId mancano, skip.
 * - Chiama GymExceptionService.getEffectiveOperator(gymRoomId, operatorId, date, time).
 * - Se isUncovered=false → l'operatore è disponibile (diretto o via sostituto)
 *   → azzera hasConflict.
 * - Se isUncovered=true → il conflitto è ancora reale, lascio il flag.
 */
@Injectable()
export class ConflictRevalidationService {
  private readonly logger = new Logger(ConflictRevalidationService.name);

  constructor(
    @InjectRepository(AvailabilityAppointment)
    private appointmentRepo: Repository<AvailabilityAppointment>,
    private gymExceptionService: GymExceptionService,
    private settingsService: GeneralSettingsService,
  ) {}

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
    // Carica tutti gli appointment in conflitto (solo futuri o oggi)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const conflictedAppointments = await this.appointmentRepo.find({
      where: {
        hasConflict: true,
        bookingStatus: In([BookingStatus.SCHEDULED, BookingStatus.CONFIRMED]),
      },
      relations: ['operator'],
    });

    if (conflictedAppointments.length === 0) {
      return 0;
    }

    this.logger.log(
      `Revalidazione conflitti: ${conflictedAppointments.length} appointment da verificare`,
    );

    const toResolve: string[] = [];

    for (const apt of conflictedAppointments) {
      // Solo appointment GYM hanno eccezioni palestra; gli standard non li
      // gestiamo qui (potrebbero avere TEMPLATE_CHANGE come conflictReason).
      if (apt.appointmentType !== AppointmentType.GYM) continue;
      if (!apt.operatorId || !apt.gymRoomId) continue;

      try {
        const result = await this.gymExceptionService.getEffectiveOperator(
          apt.gymRoomId,
          apt.operatorId,
          apt.appointmentDate,
          apt.startTime,
        );

        if (!result.isUncovered) {
          // L'operatore è disponibile (diretto o via sostituto) → conflitto risolto
          toResolve.push(apt.id);
        }
      } catch {
        // Se getEffectiveOperator fallisce (es. operatore cancellato),
        // lasciamo il conflitto — la segreteria lo gestirà manualmente.
      }
    }

    if (toResolve.length > 0) {
      await this.appointmentRepo.update(toResolve, {
        hasConflict: false,
        conflictReason: undefined,
        conflictDetectedAt: undefined,
      });

      this.logger.log(
        `Revalidazione conflitti: ${toResolve.length} conflitti risolti automaticamente`,
      );
    }

    return toResolve.length;
  }
}
