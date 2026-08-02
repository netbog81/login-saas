import { Injectable, OnDestroy, inject } from '@angular/core';
import { BehaviorSubject, Observable, Subject, interval, switchMap, startWith, takeUntil, catchError, of, filter } from 'rxjs';
import { TaskMessageService } from './task-message.service';
import { OidcAuthService } from '../../../core/auth/oidc-auth.service';
import { SseService } from '../../../services/sse.service';

/**
 * Intervallo del polling di FALLBACK. Dal 2026-07-28 il refresh del badge
 * è guidato dagli eventi SSE (`task_message_changed` + refetch a ogni
 * riconnessione dello stream): il timer resta solo come rete di sicurezza
 * se lo stream è giù, quindi può essere lasco.
 */
const FALLBACK_POLL_MS = 5 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class TaskMessageNotificationService implements OnDestroy {
  private readonly taskMessageService = inject(TaskMessageService);
  private readonly authService = inject(OidcAuthService);
  private readonly sseService = inject(SseService);

  private readonly unreadCountSubject = new BehaviorSubject<number>(0);
  private readonly destroy$ = new Subject<void>();
  private polling = false;

  readonly unreadCount$: Observable<number> = this.unreadCountSubject.asObservable();

  get unreadCount(): number {
    return this.unreadCountSubject.value;
  }

  /**
   * Avvia l'aggiornamento del contatore non letti.
   * Should be called once when the user is authenticated.
   *
   * Sorgenti di refresh, in ordine di importanza:
   *  1. SSE `task_message_changed` (campanello tenant-wide dal backend)
   *  2. SSE `stream_connected` (riconnessione: recupera eventi persi)
   *  3. Polling di fallback ogni 5 minuti (stream giù / eventi persi)
   */
  startPolling(): void {
    if (this.polling) return;
    this.polling = true;

    this.sseService.getEvents().pipe(
      filter((e) => e.type === 'task_message_changed' || e.type === 'stream_connected'),
      takeUntil(this.destroy$),
    ).subscribe(() => this.refreshNow());

    interval(FALLBACK_POLL_MS).pipe(
      startWith(0),
      filter(() => this.authService.isAuthenticated()),
      switchMap(() =>
        this.taskMessageService.getUnreadCount().pipe(
          catchError(() => of(0)),
        ),
      ),
      takeUntil(this.destroy$),
    ).subscribe((count) => {
      this.unreadCountSubject.next(count);
    });
  }

  /**
   * Triggers an immediate refresh of the unread count.
   */
  refreshNow(): void {
    if (!this.authService.isAuthenticated()) return;

    this.taskMessageService.getUnreadCount().pipe(
      catchError(() => of(0)),
    ).subscribe((count) => {
      this.unreadCountSubject.next(count);
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
