import { Injectable, NgZone } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

/**
 * Tipi di evento supportati dal sistema SSE
 */
export type CalendarEventType =
  | 'appointment_status_changed'
  | 'treatment_created'
  | 'treatment_status_changed'
  | 'treatment_deleted'
  | 'heartbeat';

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

// Alias per retrocompatibilità
export type AppointmentEvent = CalendarEvent;

/**
 * Service per la gestione di Server-Sent Events (SSE)
 * Permette al frontend di ricevere notifiche real-time dal backend
 */
@Injectable({ providedIn: 'root' })
export class SseService {
  private eventSource: EventSource | null = null;

  constructor(private ngZone: NgZone) {}

  /**
   * Si connette all'endpoint SSE per ricevere eventi del calendario
   * @returns Observable che emette eventi di cambio stato (appuntamenti e trattamenti)
   */
  getAppointmentEvents(): Observable<CalendarEvent> {
    return new Observable(observer => {
      const url = `${environment.apiUrl}/events/appointments`;
      console.log('[SSE] Connecting to:', url);

      this.eventSource = new EventSource(url);

      this.eventSource.onopen = () => {
        console.log('[SSE] Connection established');
      };

      this.eventSource.onmessage = (event) => {
        // Esegui nel NgZone per triggerare change detection
        this.ngZone.run(() => {
          try {
            const data = JSON.parse(event.data) as CalendarEvent;
            if (data.type !== 'heartbeat') {
              console.log('[SSE] Event received:', data);
            }
            observer.next(data);
          } catch (e) {
            console.error('[SSE] Error parsing event:', e);
          }
        });
      };

      this.eventSource.onerror = (error) => {
        console.error('[SSE] Connection error:', error);
        // Non chiamare observer.error per permettere riconnessione automatica
        // EventSource tenta automaticamente di riconnettersi
      };

      // Cleanup alla disiscrizione
      return () => {
        console.log('[SSE] Closing connection');
        if (this.eventSource) {
          this.eventSource.close();
          this.eventSource = null;
        }
      };
    });
  }

  /**
   * Chiude manualmente la connessione SSE
   */
  disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }
}
