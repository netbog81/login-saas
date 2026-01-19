import { Injectable } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';

/**
 * Tipi di evento supportati dal sistema SSE
 */
export type CalendarEventType =
  | 'appointment_status_changed'
  | 'treatment_created'
  | 'treatment_status_changed'
  | 'treatment_deleted';

/**
 * Interfaccia unificata per tutti gli eventi calendario
 * Supporta sia eventi appuntamenti che trattamenti
 */
export interface CalendarEvent {
  type: CalendarEventType;
  // Per eventi appuntamenti
  appointmentIds?: string[];
  // Per eventi trattamenti
  treatmentId?: string;
  operatorId?: string;
  // Comune
  newStatus?: string;
  timestamp: Date;
}

/**
 * Service per gestire eventi real-time tramite SSE
 * Utilizzato per notificare il frontend di cambiamenti in appuntamenti e trattamenti
 */
@Injectable()
export class EventsService {
  private events$ = new Subject<CalendarEvent>();

  /**
   * Emette un evento a tutti i client connessi
   */
  emit(event: CalendarEvent): void {
    this.events$.next(event);
  }

  /**
   * Restituisce l'observable degli eventi per SSE
   */
  getEvents(): Observable<CalendarEvent> {
    return this.events$.asObservable();
  }
}
