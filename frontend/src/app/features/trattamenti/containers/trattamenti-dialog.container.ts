import { ChangeDetectionStrategy, Component, Inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DragDropModule, CdkDrag } from '@angular/cdk/drag-drop';
import { RememberedWindowDirective } from '../../../shared/directives/remembered-window.directive';
import { ViewChild } from '@angular/core';
import { TrattamentiContainer } from './trattamenti.container';
import { TrattamentiFilters, TrattamentiViewMode } from '../models/trattamento.model';

export interface TrattamentiDialogData {
  initialFilters?: Partial<TrattamentiFilters>;
  initialViewMode?: TrattamentiViewMode;
}

/**
 * Wrapper MatDialog attorno a TrattamentiContainer.
 *
 * - Drag: l'INTERA barra blu e' trascinabile (cdkDrag senza handle), come il
 *   dialog Appuntamenti. La zona del bottone "chiudi" blocca il drag.
 * - Collapse: doppio click sulla barra blu minimizza alla sola barra; un
 *   secondo doppio click ri-espande.
 * - ESC: chiude il dialog (gestito sia da MatDialog nativo sia da HostListener
 *   per robustezza anche quando il focus e' dentro un campo del contenuto).
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
    MatTooltipModule,
    DragDropModule,
    RememberedWindowDirective,
    TrattamentiContainer,
  ],
  template: `
    <div class="dialog-root" [class.minimized]="minimized">
      <!-- Barra blu: trascinabile su tutta l'area (cdkDrag senza handle).
           Doppio click → minimizza/ripristina. La zona "chiudi" a destra
           blocca il drag via stopPropagation sul mousedown. -->
      <div class="dialog-title-bar"
           cdkDrag
           #titleDrag="cdkDrag"
           cdkDragRootElement=".trattamenti-dialog-pane"
           appRememberedWindow="trattamenti"
           rememberedWindowPane=".trattamenti-dialog-pane"
           cdkDragBoundary=".cdk-overlay-container"
           (dblclick)="toggleMinimized()">
        <div class="title-left">
          <mat-icon>drag_indicator</mat-icon>
          <span class="title-text">Trattamenti</span>
        </div>

        <div class="title-actions"
             (mousedown)="$event.stopPropagation()"
             (dblclick)="$event.stopPropagation()">
          <button mat-icon-button (click)="toggleMinimized()"
                  [matTooltip]="minimized ? 'Espandi' : 'Comprimi'"
                  aria-label="Comprimi/Espandi">
            <mat-icon>{{ minimized ? 'expand_more' : 'expand_less' }}</mat-icon>
          </button>
          <button mat-icon-button (click)="close()" aria-label="Chiudi">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      </div>

      @if (!minimized) {
        <div class="dialog-body">
          <app-trattamenti-container
            [initialFilters]="data?.initialFilters"
            [initialViewMode]="data?.initialViewMode">
          </app-trattamenti-container>
        </div>
      }
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
    /* Minimizzata: solo la barra blu visibile. */
    .dialog-root.minimized {
      height: auto;
      min-height: 0;
    }
    .dialog-title-bar {
      display: flex; align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      background: #1976d2;
      color: white;
      cursor: move;
      border-radius: 4px 4px 0 0;
      flex: 0 0 auto;
      user-select: none;
    }
    .title-left {
      display: flex; align-items: center; gap: 8px;
      font-weight: 500;
    }
    .title-actions { display: flex; align-items: center; gap: 2px; }
    .dialog-body {
      flex: 1;
      overflow: auto;
      padding: 12px 16px 16px;
    }
  `],
})
export class TrattamentiDialogContainer {
  @ViewChild('titleDrag') titleDrag?: CdkDrag;
  minimized = false;

  constructor(
    private dialogRef: MatDialogRef<TrattamentiDialogContainer>,
    @Inject(MAT_DIALOG_DATA) public data: TrattamentiDialogData,
  ) {}

  /**
   * Minimizza/ripristina la finestra alla sola barra blu. Al ripristino,
   * riporta la barra del titolo dentro l'area visibile se trascinata in alto.
   */
  toggleMinimized(): void {
    this.minimized = !this.minimized;
    if (this.minimized) {
      this.dialogRef.addPanelClass('minimized');
    } else {
      this.dialogRef.removePanelClass('minimized');
      setTimeout(() => this.ensureTitleBarVisible(), 0);
    }
  }

  /**
   * Se il pane e' (parzialmente) sopra il bordo superiore/sinistro della
   * viewport, corregge la posizione del cdkDrag per riportare la barra dentro
   * l'area visibile (altrimenti espandendo da minimizzato finirebbe fuori).
   */
  private ensureTitleBarVisible(): void {
    const pane = document.querySelector<HTMLElement>('.trattamenti-dialog-pane');
    if (!pane || !this.titleDrag) return;

    const rect = pane.getBoundingClientRect();
    const margin = 8;
    const overflowTop = margin - rect.top;
    const overflowLeft = margin - rect.left;
    if (overflowTop <= 0 && overflowLeft <= 0) return;

    const pos = this.titleDrag.getFreeDragPosition();
    this.titleDrag.setFreeDragPosition({
      x: pos.x + Math.max(0, overflowLeft),
      y: pos.y + Math.max(0, overflowTop),
    });
  }

  /** ESC chiude la finestra (anche da minimizzata). */
  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close();
  }

  close(): void {
    this.dialogRef.close();
  }
}
