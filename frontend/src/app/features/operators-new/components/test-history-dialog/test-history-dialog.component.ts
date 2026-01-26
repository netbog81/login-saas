import {
  Component,
  Input,
  Output,
  EventEmitter,
  ViewChild,
  ElementRef,
  ChangeDetectionStrategy,
  OnChanges,
  SimpleChanges,
  AfterViewInit
} from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TestEvaluationEntry } from '../../models/objectives-tracking.model';

export interface TestHistoryDialogData {
  testId: string;
  testName: string;
  history: TestEvaluationEntry[];
}

export interface TestHistoryEditEvent {
  entryId: string;
  level: number;
  note?: string;
}

export interface TestHistoryDeleteEvent {
  entryId: string;
}

@Component({
  selector: 'app-test-history-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatSliderModule,
    MatFormFieldModule,
    MatInputModule,
    MatTooltipModule,
    DecimalPipe
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Custom Overlay Pattern (come altri dialog del modulo) -->
    <div class="dialog-overlay"
         (mousedown)="onOverlayMouseDown($event)"
         (click)="onOverlayClick($event)">
      <div class="dialog-container"
           (click)="$event.stopPropagation()"
           (mousedown)="$event.stopPropagation()">

        <!-- Header -->
        <header class="dialog-header">
          <div class="header-content">
            <mat-icon class="header-icon">history</mat-icon>
            <div class="header-text">
              <h2>Storico Valutazioni</h2>
              <span class="test-name">{{ data.testName }}</span>
            </div>
          </div>
          <button mat-icon-button (click)="onClose()" matTooltip="Chiudi">
            <mat-icon>close</mat-icon>
          </button>
        </header>

        <!-- Content -->
        <div class="dialog-content">
          <!-- Statistiche -->
          <div class="stats-section">
            <div class="stat-card">
              <span class="stat-label">Media valutazioni</span>
              <span class="stat-value">{{ getAverageScore() | number:'1.1-1' }}/5</span>
            </div>
            <div class="stat-card">
              <span class="stat-label">Totale valutazioni</span>
              <span class="stat-value">{{ data.history.length }}</span>
            </div>
          </div>

          <!-- Grafico -->
          @if (data.history.length >= 2) {
            <div class="chart-section">
              <h3>Andamento nel tempo</h3>
              <div class="chart-container">
                <canvas #chartCanvas width="500" height="200"></canvas>
              </div>
            </div>
          }

          <!-- Lista valutazioni -->
          <div class="history-section">
            <div class="history-header">
              <h3>Dettaglio valutazioni</h3>
              <button mat-icon-button
                      (click)="toggleSortOrder()"
                      [matTooltip]="sortNewestFirst ? 'Mostra prima i più vecchi' : 'Mostra prima i più recenti'">
                <mat-icon>{{ sortNewestFirst ? 'arrow_downward' : 'arrow_upward' }}</mat-icon>
              </button>
            </div>
            <div class="history-list">
              @for (entry of getSortedHistory(); track entry.id) {
                <div class="history-entry" [class.editing]="editingId === entry.id">
                  @if (editingId !== entry.id) {
                    <!-- Vista normale -->
                    <div class="entry-main">
                      <div class="entry-info">
                        <span class="entry-date">{{ formatDate(entry.createdAt) }}</span>
                        <span class="entry-operator">{{ entry.operatorName }}</span>
                      </div>
                      <div class="entry-value-badge">{{ entry.evaluationLevel }}/5</div>
                      <div class="entry-actions">
                        <button mat-icon-button matTooltip="Modifica" (click)="startEditEntry(entry)">
                          <mat-icon>edit</mat-icon>
                        </button>
                        @if (data.history.length > 1) {
                          <button mat-icon-button matTooltip="Elimina" (click)="onDeleteEntry(entry)">
                            <mat-icon color="warn">delete</mat-icon>
                          </button>
                        }
                      </div>
                    </div>
                    @if (entry.note) {
                      <div class="entry-note">{{ entry.note }}</div>
                    }
                    @if (entry.treatmentsSinceLast > 0) {
                      <div class="entry-treatments">
                        <mat-icon>local_hospital</mat-icon>
                        {{ entry.treatmentsSinceLast }} trattamenti dall'ultima valutazione
                      </div>
                    }
                  } @else {
                    <!-- Vista modifica inline -->
                    <div class="edit-entry-form">
                      <div class="slider-row">
                        <mat-slider [min]="0" [max]="5" [step]="1" [discrete]="true" [showTickMarks]="true">
                          <input matSliderThumb [(ngModel)]="editingLevel">
                        </mat-slider>
                        <span class="level-display">{{ editingLevel }}/5</span>
                      </div>
                      <mat-form-field appearance="outline" class="edit-note-field">
                        <mat-label>Note</mat-label>
                        <textarea matInput [(ngModel)]="editingNote" rows="2"></textarea>
                      </mat-form-field>
                      <div class="edit-actions">
                        <button mat-button (click)="cancelEditEntry()">Annulla</button>
                        <button mat-flat-button color="primary" (click)="saveEditEntry()">Salva</button>
                      </div>
                    </div>
                  }
                </div>
              }
            </div>
          </div>
        </div>

        <!-- Footer -->
        <footer class="dialog-footer">
          <button mat-button (click)="onClose()">Chiudi</button>
        </footer>
      </div>
    </div>
  `,
  styles: [`
    /* Overlay pattern come altri dialog del modulo */
    .dialog-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 16px;
    }

    .dialog-container {
      background: white;
      border-radius: 8px;
      width: 90%;
      max-width: 600px;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 11px 15px -7px rgba(0,0,0,.2), 0 24px 38px 3px rgba(0,0,0,.14);
      animation: slideUp 0.2s ease-out;
    }

    @keyframes slideUp {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* Header */
    .dialog-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 24px;
      border-bottom: 1px solid #e2e8f0;
    }

    .header-content {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .header-icon {
      color: #3b82f6;
      font-size: 28px;
      width: 28px;
      height: 28px;
    }

    .header-text h2 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: #1e293b;
    }

    .test-name {
      font-size: 14px;
      color: #64748b;
    }

    /* Content */
    .dialog-content {
      flex: 1;
      overflow-y: auto;
      padding: 16px 24px;
    }

    /* Stats Section */
    .stats-section {
      display: flex;
      gap: 16px;
      margin-bottom: 24px;
    }

    .stat-card {
      flex: 1;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-radius: 8px;
      padding: 16px;
      text-align: center;
    }

    .stat-label {
      display: block;
      font-size: 12px;
      color: #64748b;
      margin-bottom: 4px;
    }

    .stat-value {
      font-size: 24px;
      font-weight: 600;
      color: #3b82f6;
    }

    /* Chart Section */
    .chart-section {
      margin-bottom: 24px;
    }

    .chart-section h3 {
      font-size: 14px;
      font-weight: 600;
      color: #334155;
      margin: 0 0 12px 0;
    }

    .chart-container {
      background: #f8fafc;
      border-radius: 8px;
      padding: 16px;
      overflow-x: auto;
    }

    .chart-container canvas {
      max-width: 100%;
      height: auto;
    }

    /* History Section */
    .history-section .history-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }

    .history-section .history-header h3 {
      margin: 0;
      font-size: 14px;
      font-weight: 600;
      color: #334155;
    }

    .history-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .history-entry {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px;
      transition: all 0.2s ease;
    }

    .history-entry:hover {
      border-color: #cbd5e1;
    }

    .history-entry.editing {
      background: #eff6ff;
      border-color: #93c5fd;
    }

    .entry-main {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .entry-info {
      flex: 1;
    }

    .entry-date {
      display: block;
      font-weight: 500;
      color: #334155;
    }

    .entry-operator {
      font-size: 12px;
      color: #64748b;
    }

    .entry-value-badge {
      background: #3b82f6;
      color: white;
      padding: 4px 12px;
      border-radius: 16px;
      font-weight: 600;
      font-size: 14px;
    }

    .entry-actions {
      display: flex;
      gap: 4px;
      opacity: 0;
      transition: opacity 0.2s ease;
    }

    .history-entry:hover .entry-actions {
      opacity: 1;
    }

    .entry-note {
      margin-top: 8px;
      padding: 8px;
      background: white;
      border-radius: 4px;
      font-size: 13px;
      color: #475569;
    }

    .entry-treatments {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-top: 8px;
      font-size: 12px;
      color: #64748b;
    }

    .entry-treatments mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }

    /* Edit Form */
    .edit-entry-form {
      padding: 8px 0;
    }

    .slider-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .slider-row mat-slider {
      flex: 1;
      max-width: 200px;
    }

    .level-display {
      font-weight: 500;
      min-width: 40px;
    }

    .edit-note-field {
      width: 100%;
      margin-top: 8px;
    }

    .edit-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 8px;
    }

    /* Footer */
    .dialog-footer {
      display: flex;
      justify-content: flex-end;
      padding: 12px 24px;
      border-top: 1px solid #e2e8f0;
    }

    /* RESPONSIVE - Mobile (< 600px) */
    @media (max-width: 599px) {
      .dialog-overlay {
        padding: 0;
      }

      .dialog-container {
        max-width: 100%;
        max-height: 100vh;
        height: 100vh;
        border-radius: 0;
      }

      .header-icon {
        display: none;
      }

      .stats-section {
        flex-direction: column;
      }

      .entry-main {
        flex-wrap: wrap;
      }

      .entry-actions {
        opacity: 1; /* Sempre visibili su mobile */
        width: 100%;
        justify-content: flex-end;
        margin-top: 8px;
      }

      .slider-row {
        flex-wrap: wrap;
      }

      .slider-row mat-slider {
        max-width: none;
        width: 100%;
      }

      .edit-actions {
        flex-direction: column;
      }

      .edit-actions button {
        width: 100%;
      }
    }
  `]
})
export class TestHistoryDialogComponent implements OnChanges, AfterViewInit {
  @ViewChild('chartCanvas') chartCanvas!: ElementRef<HTMLCanvasElement>;

  @Input() data!: TestHistoryDialogData;
  @Input() isVisible = false;

  @Output() close = new EventEmitter<void>();
  @Output() editEntry = new EventEmitter<TestHistoryEditEvent>();
  @Output() deleteEntry = new EventEmitter<TestHistoryDeleteEvent>();

  editingId: string | null = null;
  editingLevel = 0;
  editingNote = '';
  sortNewestFirst = true;  // Default: più recenti prima

  private overlayMouseDownTarget: EventTarget | null = null;
  private chartRendered = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isVisible'] && this.isVisible && this.data?.history?.length >= 2) {
      // Reset chart state when dialog opens
      this.chartRendered = false;
      setTimeout(() => this.renderChart(), 50);
    }
    if (changes['data'] && this.data?.history?.length >= 2 && this.isVisible) {
      setTimeout(() => this.renderChart(), 50);
    }
  }

  ngAfterViewInit(): void {
    if (this.isVisible && this.data?.history?.length >= 2 && !this.chartRendered) {
      setTimeout(() => this.renderChart(), 50);
    }
  }

  getAverageScore(): number {
    if (!this.data?.history?.length) return 0;
    const sum = this.data.history.reduce((acc, e) => acc + e.evaluationLevel, 0);
    return sum / this.data.history.length;
  }

  formatDate(date: Date | string): string {
    const d = new Date(date);
    return d.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Toggle ordinamento lista
  toggleSortOrder(): void {
    this.sortNewestFirst = !this.sortNewestFirst;
  }

  // Lista ordinata per la visualizzazione
  getSortedHistory(): TestEvaluationEntry[] {
    if (!this.data?.history) return [];
    return [...this.data.history].sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return this.sortNewestFirst ? dateB - dateA : dateA - dateB;
    });
  }

  // Dati grafico ordinati cronologicamente (sempre vecchio → nuovo)
  getChartData(): TestEvaluationEntry[] {
    if (!this.data?.history) return [];
    return [...this.data.history].sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateA - dateB;  // Sempre cronologico: vecchio → nuovo
    });
  }

  startEditEntry(entry: TestEvaluationEntry): void {
    this.editingId = entry.id;
    this.editingLevel = entry.evaluationLevel;
    this.editingNote = entry.note || '';
  }

  cancelEditEntry(): void {
    this.editingId = null;
    this.editingLevel = 0;
    this.editingNote = '';
  }

  saveEditEntry(): void {
    if (!this.editingId) return;
    this.editEntry.emit({
      entryId: this.editingId,
      level: this.editingLevel,
      note: this.editingNote || undefined
    });
    this.cancelEditEntry();
  }

  onDeleteEntry(entry: TestEvaluationEntry): void {
    this.deleteEntry.emit({ entryId: entry.id });
  }

  onClose(): void {
    this.close.emit();
  }

  onOverlayMouseDown(event: MouseEvent): void {
    this.overlayMouseDownTarget = event.target;
  }

  onOverlayClick(event: MouseEvent): void {
    if (this.overlayMouseDownTarget === event.currentTarget &&
        event.target === event.currentTarget) {
      this.onClose();
    }
    this.overlayMouseDownTarget = null;
  }

  renderChart(): void {
    if (!this.chartCanvas || this.chartRendered) return;
    const canvas = this.chartCanvas.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Usa getChartData() che ordina esplicitamente per data (vecchio → nuovo)
    const history = this.getChartData();
    const padding = 40;
    const width = canvas.width - padding * 2;
    const height = canvas.height - padding * 2;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (history.length < 2) return;

    this.chartRendered = true;

    // Scala dinamica basata sul numero di valutazioni
    const stepX = width / (history.length - 1);
    const maxY = 5;

    // Griglia orizzontale
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.font = '12px sans-serif';

    for (let i = 0; i <= 5; i++) {
      const y = padding + height - (i / maxY) * height;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(canvas.width - padding, y);
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.textAlign = 'right';
      ctx.fillText(i.toString(), padding - 8, y + 4);
    }

    // Linea del grafico
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.beginPath();

    history.forEach((entry, i) => {
      const x = padding + i * stepX;
      const y = padding + height - (entry.evaluationLevel / maxY) * height;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    // Punti
    history.forEach((entry, i) => {
      const x = padding + i * stepX;
      const y = padding + height - (entry.evaluationLevel / maxY) * height;

      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#3b82f6';
      ctx.fill();
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  }
}
