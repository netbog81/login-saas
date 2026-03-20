import { Injectable, OnDestroy, inject } from '@angular/core';
import { BehaviorSubject, Observable, Subject, interval, switchMap, startWith, takeUntil, catchError, of, filter } from 'rxjs';
import { TaskMessageService } from './task-message.service';
import { OidcAuthService } from '../../../core/auth/oidc-auth.service';

@Injectable({ providedIn: 'root' })
export class TaskMessageNotificationService implements OnDestroy {
  private readonly taskMessageService = inject(TaskMessageService);
  private readonly authService = inject(OidcAuthService);

  private readonly unreadCountSubject = new BehaviorSubject<number>(0);
  private readonly destroy$ = new Subject<void>();
  private polling = false;

  readonly unreadCount$: Observable<number> = this.unreadCountSubject.asObservable();

  get unreadCount(): number {
    return this.unreadCountSubject.value;
  }

  /**
   * Starts polling for unread count every 30 seconds.
   * Should be called once when the user is authenticated.
   */
  startPolling(): void {
    if (this.polling) return;
    this.polling = true;

    interval(30000).pipe(
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
