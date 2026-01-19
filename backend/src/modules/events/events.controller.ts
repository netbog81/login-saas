import { Controller, Sse, MessageEvent } from '@nestjs/common';
import { Observable, map, interval, merge } from 'rxjs';
import { EventsService } from './events.service';

/**
 * Controller per Server-Sent Events (SSE)
 * Permette al frontend di ricevere notifiche real-time
 */
@Controller('events')
export class EventsController {
  constructor(private eventsService: EventsService) {}

  /**
   * Endpoint SSE per ricevere eventi sugli appuntamenti
   * Il client si connette a GET /events/appointments e riceve eventi in streaming
   */
  @Sse('appointments')
  appointmentEvents(): Observable<MessageEvent> {
    // Heartbeat ogni 30 secondi per mantenere la connessione attiva
    const heartbeat$ = interval(30000).pipe(
      map(() => ({
        data: JSON.stringify({ type: 'heartbeat', timestamp: new Date() }),
      }))
    );

    // Eventi reali
    const events$ = this.eventsService.getEvents().pipe(
      map(event => ({
        data: JSON.stringify(event),
      }))
    );

    // Merge heartbeat e eventi reali
    return merge(heartbeat$, events$);
  }
}
