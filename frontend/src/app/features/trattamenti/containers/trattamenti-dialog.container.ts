import { ChangeDetectionStrategy, Component, Inject, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { TrattamentiContainer } from './trattamenti.container';
import { TrattamentiFilters, TrattamentiViewMode } from '../models/trattamento.model';

export interface TrattamentiDialogData {
  initialFilters?: Partial<TrattamentiFilters>;
  initialViewMode?: TrattamentiViewMode;
}

/**
 * Wrapper MatDialog attorno a TrattamentiContainer.
 *
 * - Drag: header con cdkDrag + cdkDragRootElement sul pannello dialog.
 * - Resize: CSS `resize: both` sul content (il browser disegna la maniglia).
 * - Se l'utente chiude con backdrop/ESC, il dialog si dismette.
 */
@Component({
  selector: 'app-trattamenti-dialog-container',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    DragDropModule,
    TrattamentiContainer,
  ],
  template: `
    <div class="dialog-root">
      <div
        class="dialog-title-bar"
        cdkDrag
        cdkDragRootElement=".trattamenti-dialog-pane"
        cdkDragBoundary=".cdk-overlay-container">
        <div cdkDragHandle class="drag-handle">
          <mat-icon>drag_indicator</mat-icon>
          <span>Trattamenti</span>
        </div>
        <button mat-icon-button (click)="close()" aria-label="Chiudi">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="dialog-body">
        <app-trattamenti-container
          [initialFilters]="data?.initialFilters"
          [initialViewMode]="data?.initialViewMode">
        </app-trattamenti-container>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; }
    .dialog-root {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 400px;
      min-width: 600px;
    }
    .dialog-title-bar {
      display: flex; align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      background: #1976d2;
      color: white;
      cursor: move;
      border-radius: 4px 4px 0 0;
    }
    .drag-handle {
      display: flex; align-items: center; gap: 8px;
      font-weight: 500;
    }
    .dialog-body {
      flex: 1;
      overflow: auto;
      padding: 12px 16px 16px;
    }
  `],
})
export class TrattamentiDialogContainer {
  constructor(
    private dialogRef: MatDialogRef<TrattamentiDialogContainer>,
    @Inject(MAT_DIALOG_DATA) public data: TrattamentiDialogData,
  ) {}

  close(): void {
    this.dialogRef.close();
  }
}
