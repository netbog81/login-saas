import { Injectable, Logger } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { TenantContextService } from '@curandis/tenant-datasource';

/**
 * Tipi di evento supportati dal sistema SSE
 */
export type CalendarEventType =
  | 'appointment_status_changed'
  | 'appointment_changed'
  | 'treatment_created'
  | 'treatment_status_changed'
  | 'treatment_deleted'
  | 'task_message_changed'
  | 'availability_changed'
  | 'whatsapp_chat_changed';

/**
 * Interfaccia unificata per tutti gli eventi realtime.
 * Il payload è volutamente minimo (ID e stati): il client fa refetch
 * mirato, i dati veri viaggiano solo su canali autenticati per-query.
 */
export interface CalendarEvent {
  type: CalendarEventType;
  // Per eventi appuntamenti
  appointmentIds?: string[];
  // Per eventi trattamenti
  treatmentId?: string;
  operatorId?: string;
  // Per la chat WhatsApp: quale conversazione va rinfrescata
  conversationId?: string;
  // Comune
  newStatus?: string;
  timestamp: Date;
}

/**
 * Busta interna: ogni evento viaggia con il tenant di appartenenza e,
 * opzionalmente, con un destinatario specifico (Keycloak user id).
 */
interface ScopedEnvelope {
  tenantAlias: string;
  targetUserId?: string;
  event: CalendarEvent;
}

/**
 * Service per gestire eventi real-time tramite SSE.
 *
 * Scoping (2026-07-28): lo stream non è più un broadcast globale — ogni
 * evento è etichettato con il tenant (ricavato dall'AsyncLocalStorage del
 * TenantContextService al momento dell'emit) e i client SSE ricevono solo
 * gli eventi del proprio tenant, più gli eventi mirati al proprio utente.
 */
@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);
  private readonly stream$ = new Subject<ScopedEnvelope>();

  constructor(private readonly tenantContext: TenantContextService) {}

  /**
   * Emette un evento a tutti i client del tenant corrente.
   *
   * Il tenant viene letto dall'AsyncLocalStorage: funziona in request HTTP,
   * nei cron (che wrappano in tenantContext.run) e nei consumer RabbitMQ.
   * Fuori da un contesto tenant l'evento viene scartato con warn — mai
   * broadcast cross-tenant.
   */
  emit(event: CalendarEvent): void {
    const tenantAlias = this.tenantContext.getTenantAlias();
    if (!tenantAlias) {
      this.logger.warn(
        `emit() chiamato fuori dal contesto tenant: evento "${event.type}" scartato. ` +
        `Usare emitToTenant(alias, event) nei punti senza AsyncLocalStorage.`,
      );
      return;
    }
    this.stream$.next({ tenantAlias, event });
  }

  /** Emette un evento a tutti i client di un tenant esplicito. */
  emitToTenant(tenantAlias: string, event: CalendarEvent): void {
    this.stream$.next({ tenantAlias, event });
  }

  /** Emette un evento visibile solo a un utente (Keycloak sub) del tenant. */
  emitToUser(tenantAlias: string, targetUserId: string, event: CalendarEvent): void {
    this.stream$.next({ tenantAlias, targetUserId, event });
  }

  /**
   * Stream per un singolo client SSE: eventi del suo tenant, esclusi
   * quelli mirati ad altri utenti.
   */
  getEventsFor(tenantAlias: string, userId: string): Observable<CalendarEvent> {
    return this.stream$.asObservable().pipe(
      filter(
        (e) =>
          e.tenantAlias === tenantAlias &&
          (!e.targetUserId || e.targetUserId === userId),
      ),
      map((e) => e.event),
    );
  }
}
