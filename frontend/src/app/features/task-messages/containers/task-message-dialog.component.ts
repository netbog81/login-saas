import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  NgZone,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatBadgeModule } from '@angular/material/badge';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { Subject, takeUntil } from 'rxjs';

import { TaskMessageService } from '../services/task-message.service';
import { TaskMessageNotificationService } from '../services/task-message-notification.service';
import { TaskMessageListComponent } from '../components/task-message-list.component';
import {
  TaskMessageDetailDialogComponent,
  TaskMessageDetailDialogResult,
} from '../components/task-message-detail-dialog.component';
import {
  TaskMessageComposeDialogComponent,
  ComposeDialogResult,
} from './task-message-compose-dialog.component';
import { TaskMessage, TaskMessagePage, TaskMessageStatus } from '../models/task-message.models';

@Component({
  selector: 'app-task-message-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatTabsModule,
    MatButtonModule,
    MatIconModule,
    MatBadgeModule,
    MatProgressSpinnerModule,
    MatPaginatorModule,
    DragDropModule,
    TaskMessageListComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog-wrapper" cdkDrag cdkDragRootElement=".cdk-overlay-pane">
      <div class="dialog-header" cdkDragHandle>
        <div class="header-title">
          <mat-icon>mail</mat-icon>
          <span>Messaggi & Task</span>
        </div>
        <div class="header-actions">
          <button mat-icon-button matTooltip="Nuovo Task" (click)="openCompose()">
            <mat-icon>add</mat-icon>
          </button>
          <button mat-icon-button (click)="dialogRef.close()">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      </div>

      <mat-tab-group [(selectedIndex)]="selectedTab" (selectedTabChange)="onTabChange()">
        <mat-tab>
          <ng-template mat-tab-label>
            <span [matBadge]="unreadCount > 0 ? unreadCount : null"
                  matBadgeColor="warn"
                  matBadgeSize="small"
                  [matBadgeHidden]="unreadCount === 0">
              Ricevuti
            </span>
          </ng-template>
          @if (loading) {
            <div class="loading-container">
              <mat-spinner diameter="32"></mat-spinner>
            </div>
          } @else {
            <app-task-message-list
              [messages]="inboxMessages"
              [currentUserId]="currentUserId"
              [listType]="'inbox'"
              [emptyText]="'Nessun messaggio ricevuto'"
              (open)="onOpenMessage($event)"
              (complete)="onComplete($event)">
            </app-task-message-list>
            @if (inboxTotal > pageSize) {
              <mat-paginator
                [length]="inboxTotal"
                [pageSize]="pageSize"
                [pageIndex]="inboxPage - 1"
                (page)="onPageChange($event, 'inbox')"
                [hidePageSize]="true">
              </mat-paginator>
            }
          }
        </mat-tab>

        <mat-tab label="Inviati">
          @if (loading) {
            <div class="loading-container">
              <mat-spinner diameter="32"></mat-spinner>
            </div>
          } @else {
            <app-task-message-list
              [messages]="sentMessages"
              [currentUserId]="currentUserId"
              [listType]="'sent'"
              [emptyText]="'Nessun messaggio inviato'"
              (open)="onOpenMessage($event)"
              (delete)="onDelete($event)"
              (edit)="onEdit($event)">
            </app-task-message-list>
            @if (sentTotal > pageSize) {
              <mat-paginator
                [length]="sentTotal"
                [pageSize]="pageSize"
                [pageIndex]="sentPage - 1"
                (page)="onPageChange($event, 'sent')"
                [hidePageSize]="true">
              </mat-paginator>
            }
          }
        </mat-tab>

        <mat-tab label="Completati">
          @if (loading) {
            <div class="loading-container">
              <mat-spinner diameter="32"></mat-spinner>
            </div>
          } @else {
            <app-task-message-list
              [messages]="completedMessages"
              [currentUserId]="currentUserId"
              [listType]="'completed'"
              [emptyText]="'Nessun task completato'"
              (open)="onOpenMessage($event)">
            </app-task-message-list>
            @if (completedTotal > pageSize) {
              <mat-paginator
                [length]="completedTotal"
                [pageSize]="pageSize"
                [pageIndex]="completedPage - 1"
                (page)="onPageChange($event, 'completed')"
                [hidePageSize]="true">
              </mat-paginator>
            }
          }
        </mat-tab>
      </mat-tab-group>
    </div>
  `,
  styles: [`
    .dialog-wrapper {
      display: flex;
      flex-direction: column;
      height: 100%;
      max-height: 100%;
    }

    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      background: #2c3e50;
      color: white;
      cursor: move;
      border-radius: 4px 4px 0 0;
      flex-shrink: 0;
    }
    .header-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 16px;
      font-weight: 500;
    }
    .header-actions { display: flex; gap: 0; }
    .header-actions button { color: white; }

    mat-tab-group {
      flex: 1;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    :host ::ng-deep .mat-mdc-tab-body-wrapper {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
    }

    .loading-container {
      display: flex;
      justify-content: center;
      padding: 32px;
    }

    mat-paginator { flex-shrink: 0; }

    @media (max-width: 600px) {
      .dialog-header { padding: 8px 12px; }
      .header-title { font-size: 14px; }
    }
  `],
})
export class TaskMessageDialogComponent implements OnInit, OnDestroy {
  readonly dialogRef = inject(MatDialogRef<TaskMessageDialogComponent>);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly taskMessageService = inject(TaskMessageService);
  private readonly notificationService = inject(TaskMessageNotificationService);
  private readonly ngZone = inject(NgZone);
  private readonly cdr = inject(ChangeDetectorRef);

  private readonly destroy$ = new Subject<void>();

  selectedTab = 0;
  loading = false;
  pageSize = 15;

  // Inbox
  inboxMessages: TaskMessage[] = [];
  inboxTotal = 0;
  inboxPage = 1;

  // Sent
  sentMessages: TaskMessage[] = [];
  sentTotal = 0;
  sentPage = 1;

  // Completed
  completedMessages: TaskMessage[] = [];
  completedTotal = 0;
  completedPage = 1;

  unreadCount = 0;
  currentUserId = '';

  ngOnInit(): void {
    // Recupera l'AppUser.id (non il keycloakId) per i confronti con recipientUserId/senderUserId
    this.taskMessageService.getMyAppUserId().pipe(
      takeUntil(this.destroy$),
    ).subscribe((appUserId: string | null) => {
      if (appUserId) {
        this.ngZone.run(() => {
          this.currentUserId = appUserId;
          this.cdr.markForCheck();
        });
      }
    });

    this.notificationService.unreadCount$.pipe(
      takeUntil(this.destroy$),
    ).subscribe((count) => {
      this.ngZone.run(() => {
        this.unreadCount = count;
        this.cdr.markForCheck();
      });
    });

    this.loadCurrentTab();
  }

  onTabChange(): void {
    this.loadCurrentTab();
  }

  onPageChange(event: PageEvent, tab: 'inbox' | 'sent' | 'completed'): void {
    switch (tab) {
      case 'inbox': this.inboxPage = event.pageIndex + 1; break;
      case 'sent': this.sentPage = event.pageIndex + 1; break;
      case 'completed': this.completedPage = event.pageIndex + 1; break;
    }
    this.loadCurrentTab();
  }

  openCompose(): void {
    const ref = this.dialog.open(TaskMessageComposeDialogComponent, {
      width: '500px',
      data: { editMode: false, currentUserId: this.currentUserId },
    });

    ref.afterClosed().subscribe((result: ComposeDialogResult | undefined) => {
      if (result?.input) {
        this.taskMessageService.createMessage(result.input).pipe(
          takeUntil(this.destroy$),
        ).subscribe({
          next: () => {
            this.loadCurrentTab();
            this.notificationService.refreshNow();
          },
        });
      }
    });
  }

  onOpenMessage(msg: TaskMessage): void {
    // Per i messaggi di gruppo l'inbox contiene solo messaggi su cui
    // l'utente può agire (membership verificata dal backend)
    const canActOnGroup = !!msg.recipientGroup && this.selectedTab === 0;
    const isRecipient = msg.recipientUserId === this.currentUserId || canActOnGroup;

    // Auto-mark as read when recipient opens an AVAILABLE message
    if (isRecipient && msg.status === TaskMessageStatus.AVAILABLE) {
      this.taskMessageService.markAsRead(msg.gatewayMessageId).pipe(
        takeUntil(this.destroy$),
      ).subscribe({
        next: () => {
          msg.status = TaskMessageStatus.READ;
          this.loadCurrentTab();
          this.notificationService.refreshNow();
        },
      });
    }

    const ref = this.dialog.open(TaskMessageDetailDialogComponent, {
      width: '550px',
      maxHeight: '80vh',
      data: { message: msg, currentUserId: this.currentUserId, canActOnGroup },
    });

    ref.afterClosed().subscribe((result: TaskMessageDetailDialogResult | undefined) => {
      if (result?.action === 'complete') {
        this.doComplete(msg);
      } else {
        // Refresh to show updated status
        this.loadCurrentTab();
      }
    });
  }

  onComplete(msg: TaskMessage): void {
    this.doComplete(msg);
  }

  onDelete(msg: TaskMessage): void {
    this.taskMessageService.deleteMessage(msg.gatewayMessageId).pipe(
      takeUntil(this.destroy$),
    ).subscribe({
      next: () => {
        this.loadCurrentTab();
        this.notificationService.refreshNow();
      },
    });
  }

  onEdit(msg: TaskMessage): void {
    const ref = this.dialog.open(TaskMessageComposeDialogComponent, {
      width: '500px',
      data: { editMode: true, message: msg, currentUserId: this.currentUserId },
    });

    ref.afterClosed().subscribe((result: ComposeDialogResult | undefined) => {
      if (result?.input && result.gatewayMessageId) {
        this.taskMessageService.updateMessage(result.gatewayMessageId, {
          content: result.input.content,
          availableFrom: result.input.availableFrom,
        }).pipe(
          takeUntil(this.destroy$),
        ).subscribe({
          next: () => this.loadCurrentTab(),
        });
      }
    });
  }

  private doComplete(msg: TaskMessage): void {
    this.taskMessageService.completeMessage(msg.gatewayMessageId).pipe(
      takeUntil(this.destroy$),
    ).subscribe({
      next: () => {
        this.loadCurrentTab();
        this.notificationService.refreshNow();
      },
      error: (err) => {
        // Caso tipico: task di gruppo già completato da una collega.
        // Ricarica comunque, così il messaggio sparisce dalla lista.
        const message: string = err?.message || '';
        this.snackBar.open(
          message.includes('già completato')
            ? 'Task già completato da un altro utente'
            : 'Impossibile completare il task',
          'OK',
          { duration: 5000 },
        );
        this.loadCurrentTab();
        this.notificationService.refreshNow();
      },
    });
  }

  private loadCurrentTab(): void {
    this.ngZone.run(() => {
      this.loading = true;
      this.cdr.markForCheck();
    });

    switch (this.selectedTab) {
      case 0: this.loadInbox(); break;
      case 1: this.loadSent(); break;
      case 2: this.loadCompleted(); break;
    }
  }

  private loadInbox(): void {
    this.taskMessageService.getInbox(this.inboxPage, this.pageSize).pipe(
      takeUntil(this.destroy$),
    ).subscribe({
      next: (result: TaskMessagePage) => {
        this.ngZone.run(() => {
          this.inboxMessages = result.items;
          this.inboxTotal = result.total;
          this.loading = false;
          this.cdr.markForCheck();
        });
      },
      error: () => {
        this.ngZone.run(() => {
          this.loading = false;
          this.cdr.markForCheck();
        });
      },
    });
  }

  private loadSent(): void {
    this.taskMessageService.getSent(this.sentPage, this.pageSize).pipe(
      takeUntil(this.destroy$),
    ).subscribe({
      next: (result: TaskMessagePage) => {
        this.ngZone.run(() => {
          this.sentMessages = result.items;
          this.sentTotal = result.total;
          this.loading = false;
          this.cdr.markForCheck();
        });
      },
      error: () => {
        this.ngZone.run(() => {
          this.loading = false;
          this.cdr.markForCheck();
        });
      },
    });
  }

  private loadCompleted(): void {
    this.taskMessageService.getCompleted(this.completedPage, this.pageSize).pipe(
      takeUntil(this.destroy$),
    ).subscribe({
      next: (result: TaskMessagePage) => {
        this.ngZone.run(() => {
          this.completedMessages = result.items;
          this.completedTotal = result.total;
          this.loading = false;
          this.cdr.markForCheck();
        });
      },
      error: () => {
        this.ngZone.run(() => {
          this.loading = false;
          this.cdr.markForCheck();
        });
      },
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
