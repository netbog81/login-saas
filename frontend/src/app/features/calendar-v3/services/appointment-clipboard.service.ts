/**
 * Appointment Clipboard Service
 * Layer 3: Business logic / Stato (NIENTE chiamate GraphQL dirette).
 *
 * Gestisce la funzione "copia/incolla appuntamento" del calendario v3:
 * - mantiene l'appuntamento copiato e lo stato del flusso (selezione/incolla);
 * - trasforma l'appuntamento copiato negli input necessari per la ricerca
 *   slot (customInstrumentSlots) e per la creazione del nuovo appuntamento.
 *
 * La creazione vera e propria resta in AvailabilityAppointmentService: questo
 * service e' solo stato + trasformazioni pure (rispetta separation of concerns).
 *
 * APPROACH FK: riuso createAppointment esistente (solo ID per servizi/strumenti).
 */

import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Appointment } from '../../../models/appointment.model';
import {
  CreateAvailabilityAppointmentInput,
  AppointmentInstrumentInput,
  ServiceInputItem,
} from '../../../services/availability-appointment.service';

/**
 * Slot di destinazione scelto per l'incollo: operatore + data + orari.
 * I campi rispecchiano AvailableSlotPosition (calendar-v2.model).
 */
export interface PasteTargetSlot {
  operatorId: string;
  date: string;
  startTime: string;
  endTime: string;
}

/** Slot strumento per la ricerca disponibilita' (offset relativi all'inizio). */
export interface ClipboardInstrumentSlot {
  instrumentCategoryId: string;
  startOffsetMinutes: number;
  endOffsetMinutes: number;
}

/**
 * Fase del flusso copia/incolla:
 * - 'idle'      → nessuna operazione in corso;
 * - 'selecting' → premuto "Copia appuntamento" in toolbar, si attende il
 *                 click sull'appuntamento da copiare;
 * - 'pasting'   → appuntamento copiato, si attende la scelta dello slot.
 */
export type ClipboardPhase = 'idle' | 'selecting' | 'pasting';

@Injectable({ providedIn: 'root' })
export class AppointmentClipboardService {
  private phaseSubject = new BehaviorSubject<ClipboardPhase>('idle');
  private copiedSubject = new BehaviorSubject<Appointment | null>(null);

  /** Fase corrente del flusso copia/incolla. */
  phase$ = this.phaseSubject.asObservable();
  /** Appuntamento attualmente copiato (null se nessuno). */
  copied$ = this.copiedSubject.asObservable();

  get phase(): ClipboardPhase {
    return this.phaseSubject.value;
  }

  get copiedAppointment(): Appointment | null {
    return this.copiedSubject.value;
  }

  get isSelecting(): boolean {
    return this.phaseSubject.value === 'selecting';
  }

  get isPasting(): boolean {
    return this.phaseSubject.value === 'pasting';
  }

  /** true se un flusso copia/incolla e' attivo (selezione o incollo). */
  get isActive(): boolean {
    return this.phaseSubject.value !== 'idle';
  }

  /**
   * Avvia la fase di selezione (dal pulsante toolbar "Copia appuntamento").
   * Il calendario entra in "modalita' selezione": il prossimo click su un
   * appuntamento lo copia direttamente.
   */
  startSelecting(): void {
    this.copiedSubject.next(null);
    this.phaseSubject.next('selecting');
  }

  /**
   * Copia un appuntamento ed entra nella fase di incollo.
   * Usato sia dal click in modalita' selezione, sia dal pulsante "Copia"
   * del dialog di modifica.
   */
  copy(appointment: Appointment): void {
    this.copiedSubject.next(appointment);
    this.phaseSubject.next('pasting');
  }

  /** Annulla il flusso (tasto Annulla / ESC / click fuori dagli slot). */
  clear(): void {
    this.copiedSubject.next(null);
    this.phaseSubject.next('idle');
  }

  // ==================== TRASFORMAZIONI PURE ====================

  /** Durata in minuti dell'appuntamento copiato (endTime - startTime). */
  getDurationMinutes(): number {
    const apt = this.copiedSubject.value;
    if (!apt) return 0;
    return this.timeToMinutes(apt.endTime) - this.timeToMinutes(apt.startTime);
  }

  /**
   * Mappa gli strumenti dell'appuntamento copiato in slot per la ricerca
   * disponibilita' (customInstrumentSlots di getPhysiotherapistAvailableSlotsBatch).
   * Senza una categoria concreta lo strumento non e' verificabile: in tal
   * caso lo slot viene ignorato e resta il solo vincolo durata.
   */
  getInstrumentSlots(): ClipboardInstrumentSlot[] {
    const apt = this.copiedSubject.value;
    if (!apt?.instruments?.length) return [];
    return apt.instruments
      .map((i) => {
        const categoryId = i.instrumentCategoryId;
        if (!categoryId) return null;
        return {
          instrumentCategoryId: categoryId,
          startOffsetMinutes: i.startOffsetMinutes,
          endOffsetMinutes: i.endOffsetMinutes,
        };
      })
      .filter((s): s is ClipboardInstrumentSlot => s !== null);
  }

  /** true se la copia ha vincoli strumenti che incidono sull'ordine. */
  getInstrumentOrderMatters(): boolean {
    return !!this.copiedSubject.value?.instrumentOrderMatters;
  }

  /**
   * Breve riepilogo testuale dell'appuntamento copiato per il banner.
   * Es: "Mario Rossi · 60 min · 1 strumento".
   */
  getSummary(): string {
    const apt = this.copiedSubject.value;
    if (!apt) return '';
    const parts: string[] = [apt.title || 'Appuntamento'];
    parts.push(`${this.getDurationMinutes()} min`);
    const instrCount = apt.instruments?.length ?? 0;
    if (instrCount > 0) {
      parts.push(instrCount === 1 ? '1 strumento' : `${instrCount} strumenti`);
    }
    return parts.join(' · ');
  }

  /**
   * Costruisce l'input di creazione del nuovo appuntamento copiando TUTTO
   * dall'originale (paziente, servizi, strumenti+offset, note, flag) tranne
   * data/ora/operatore, che vengono presi dallo slot di destinazione.
   *
   * Il nuovo appuntamento parte sempre da stato 'scheduled': non eredita
   * conferme/presenze/note operatore. Le serie ricorrenti producono un
   * singolo appuntamento (niente repeatConfig).
   *
   * Ritorna null se non c'e' un appuntamento copiato.
   */
  buildCreateInput(slot: PasteTargetSlot): CreateAvailabilityAppointmentInput | null {
    const apt = this.copiedSubject.value;
    if (!apt) return null;

    const services: ServiceInputItem[] | undefined = apt.appointmentServices?.length
      ? apt.appointmentServices.map((s, idx) => ({
          serviceId: s.serviceId,
          customDuration: s.customDuration,
          customPrice: s.customPrice,
          orderPosition: idx,
        }))
      : undefined;

    const instruments: AppointmentInstrumentInput[] | undefined = apt.instruments?.length
      ? apt.instruments
          .filter((i) => !!i.instrumentCategoryId)
          .map((i, idx) => ({
            instrumentCategoryId: i.instrumentCategoryId!,
            startOffsetMinutes: i.startOffsetMinutes,
            endOffsetMinutes: i.endOffsetMinutes,
            orderPosition: i.orderPosition ?? idx,
          }))
      : undefined;

    return {
      operatorId: slot.operatorId,
      services,
      // Fallback legacy: se non ci sono i servizi multi ma c'e' il singolo.
      serviceId: !services && apt.serviceId ? apt.serviceId : undefined,
      clientName: apt.title,
      patientId: apt.patientId,
      appointmentDate: slot.date,
      startTime: slot.startTime,
      endTime: slot.endTime,
      notes: apt.notes,
      instrumentOrderMatters: apt.instrumentOrderMatters,
      instruments,
      nonRetribuito: apt.nonRetribuito,
    };
  }

  private timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }
}
