/**
 * Current Slot Detector Service
 *
 * Responsabilità:
 * - Rilevare quale slot orario è attualmente in corso
 * - Timer ogni 30 secondi per aggiornare lo stato
 * - Auto-ATTENDED: quando scatta l'ora di uno slot, imposta ATTENDED sugli appuntamenti
 * - Traccia slot già processati per evitare chiamate ripetute
 */

import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { BehaviorSubject, Subject, Subscription, interval } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { map } from 'rxjs/operators';
import { AvailabilityAppointment, BookingStatus } from '../../../graphql/generated/types';
import { AvailabilityAppointmentService } from '../../../services/availability-appointment.service';
import { SlotGroup, groupAppointmentsBySlot } from '../models/instructor-workspace.model';

@Injectable()
export class CurrentSlotDetectorService implements OnDestroy {
  private appointments: AvailabilityAppointment[] = [];
  private currentSlotSubject = new BehaviorSubject<SlotGroup | null>(null);
  private destroy$ = new Subject<void>();
  private timerSub: Subscription | null = null;

  /** Set di chiavi slot per cui è già stato eseguito l'auto-ATTENDED */
  private processedSlots = new Set<string>();

  readonly currentSlot$ = this.currentSlotSubject.asObservable();
  readonly isInSlot$ = this.currentSlot$.pipe(map((s) => s !== null));

  constructor(
    private ngZone: NgZone,
    private appointmentService: AvailabilityAppointmentService,
  ) {}

  /**
   * Avvia il rilevamento dello slot corrente.
   * Chiama immediatamente e poi ogni 30 secondi.
   */
  start(appointments: AvailabilityAppointment[]): void {
    this.stop();
    this.appointments = appointments;
    this.checkCurrentSlot();

    this.ngZone.runOutsideAngular(() => {
      this.timerSub = interval(30000)
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => {
          this.ngZone.run(() => this.checkCurrentSlot());
        });
    });
  }

  /**
   * Aggiorna gli appuntamenti senza resettare il timer
   */
  updateAppointments(appointments: AvailabilityAppointment[]): void {
    this.appointments = appointments;
    this.checkCurrentSlot();
  }

  /**
   * Ferma il rilevamento
   */
  stop(): void {
    this.timerSub?.unsubscribe();
    this.timerSub = null;
    this.currentSlotSubject.next(null);
  }

  /**
   * Resetta lo stato, inclusi gli slot processati
   */
  reset(): void {
    this.stop();
    this.appointments = [];
    this.processedSlots.clear();
  }

  private checkCurrentSlot(): void {
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // Filtra appuntamenti dove currentTime >= startTime AND currentTime < endTime
    const inProgress = this.appointments.filter(
      (apt) => apt.startTime <= currentTime && currentTime < apt.endTime,
    );

    if (inProgress.length > 0) {
      const slots = groupAppointmentsBySlot(inProgress);
      // Prende il primo slot (di solito uno solo per un dato orario per un operatore)
      const slot = slots[0];
      this.currentSlotSubject.next(slot);

      // Auto-ATTENDED: per ogni slot non ancora processato
      for (const s of slots) {
        if (!this.processedSlots.has(s.key)) {
          this.processedSlots.add(s.key);
          this.autoMarkAttended(s.appointments);
        }
      }
    } else {
      this.currentSlotSubject.next(null);
    }
  }

  /**
   * Imposta automaticamente ATTENDED sugli appuntamenti che non sono
   * già ATTENDED o NO_SHOW
   */
  private autoMarkAttended(appointments: AvailabilityAppointment[]): void {
    for (const apt of appointments) {
      const status = apt.bookingStatus;
      if (
        status !== BookingStatus.Attended &&
        status !== BookingStatus.NoShow &&
        status !== BookingStatus.CancelledEarly &&
        status !== BookingStatus.CancelledLate
      ) {
        this.appointmentService.markAsAttended(apt.id).subscribe({
          next: () => {
            console.log(`[CurrentSlotDetector] Auto-ATTENDED per appuntamento ${apt.id}`);
          },
          error: (err) => {
            console.error(`[CurrentSlotDetector] Errore auto-ATTENDED per ${apt.id}:`, err);
          },
        });
      }
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.timerSub?.unsubscribe();
  }
}
