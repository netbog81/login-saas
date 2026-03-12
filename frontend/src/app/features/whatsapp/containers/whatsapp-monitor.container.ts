import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  NgZone,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subject, takeUntil } from 'rxjs';
import { WhatsappService } from '../services/whatsapp.service';
import {
  WhatsappMessageLog,
  WhatsappLogFilter,
  WhatsappMessageLogPage,
} from '../models/whatsapp.models';
import { MessageFilterComponent } from '../components/message-filter/message-filter.component';
import { MessageTableComponent } from '../components/message-table/message-table.component';
import { MessageDetailDialogComponent } from '../components/message-detail-dialog/message-detail-dialog.component';

@Component({
  selector: 'app-whatsapp-monitor',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatPaginatorModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MessageFilterComponent,
    MessageTableComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-card>
      <mat-card-content>
        <app-message-filter
          (search)="onSearch($event)"
          (reset)="onReset()">
        </app-message-filter>

        <app-message-table
          [messages]="messages"
          [loading]="loading"
          (viewDetail)="onViewDetail($event)">
        </app-message-table>

        @if (total > 0) {
          <mat-paginator
            [length]="total"
            [pageSize]="pageSize"
            [pageIndex]="currentPage - 1"
            [pageSizeOptions]="[25, 50, 100]"
            (page)="onPageChange($event)"
            showFirstLastButtons>
          </mat-paginator>
        }
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    mat-card {
      margin: 0;
    }
  `],
})
export class WhatsappMonitorContainer implements OnInit, OnDestroy {
  messages: WhatsappMessageLog[] = [];
  total = 0;
  loading = false;
  currentPage = 1;
  pageSize = 50;
  currentFilters: WhatsappLogFilter = { page: 1, limit: 50 };

  private destroy$ = new Subject<void>();

  constructor(
    private whatsappService: WhatsappService,
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
  ) {}

  ngOnInit(): void {
    this.loadMessages();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSearch(filters: WhatsappLogFilter): void {
    this.currentFilters = { ...filters, page: 1, limit: this.pageSize };
    this.currentPage = 1;
    this.loadMessages();
  }

  onReset(): void {
    this.currentFilters = { page: 1, limit: this.pageSize };
    this.currentPage = 1;
    this.loadMessages();
  }

  onPageChange(event: PageEvent): void {
    this.currentPage = event.pageIndex + 1;
    this.pageSize = event.pageSize;
    this.currentFilters = {
      ...this.currentFilters,
      page: this.currentPage,
      limit: this.pageSize,
    };
    this.loadMessages();
  }

  onViewDetail(message: WhatsappMessageLog): void {
    this.dialog.open(MessageDetailDialogComponent, {
      data: message,
      width: '600px',
      maxHeight: '90vh',
    });
  }

  private loadMessages(): void {
    this.ngZone.run(() => {
      this.loading = true;
      this.cdr.markForCheck();
    });

    this.whatsappService
      .getMessageLogs(this.currentFilters)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result: WhatsappMessageLogPage) => {
          this.ngZone.run(() => {
            this.messages = result.items;
            this.total = result.total;
            this.loading = false;
            this.cdr.markForCheck();
          });
        },
        error: (err) => {
          console.error('Error loading message logs:', err);
          this.ngZone.run(() => {
            this.loading = false;
            this.messages = [];
            this.total = 0;
            this.cdr.markForCheck();
          });
        },
      });
  }
}
