import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { OperatorAbsenceType } from '../../models/operator-absence-type.model';

/**
 * Dumb component: visualizza una mat-table dei tipi di assenza ed emette
 * eventi per create/edit/delete che il container gestirà.
 */
@Component({
  selector: 'app-absence-type-list',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatTooltipModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="header-bar">
      <h3>Tipi di assenza operatore</h3>
      <button mat-flat-button color="primary" (click)="create.emit()">
        <mat-icon>add</mat-icon>
        Nuovo tipo
      </button>
    </div>

    <p *ngIf="items.length === 0" class="empty-state">
      Nessun tipo di assenza configurato. Clicca "Nuovo tipo" per aggiungerne uno.
    </p>

    <table
      *ngIf="items.length > 0"
      mat-table
      [dataSource]="items"
      class="mat-elevation-z1 full-width"
    >
      <ng-container matColumnDef="name">
        <th mat-header-cell *matHeaderCellDef>Nome</th>
        <td mat-cell *matCellDef="let item">
          <strong>{{ item.name }}</strong>
        </td>
      </ng-container>

      <ng-container matColumnDef="description">
        <th mat-header-cell *matHeaderCellDef>Descrizione</th>
        <td mat-cell *matCellDef="let item" class="description-cell">
          {{ item.description || '—' }}
        </td>
      </ng-container>

      <ng-container matColumnDef="isActive">
        <th mat-header-cell *matHeaderCellDef>Stato</th>
        <td mat-cell *matCellDef="let item">
          <mat-chip *ngIf="item.isActive" color="primary" highlighted>Attivo</mat-chip>
          <mat-chip *ngIf="!item.isActive">Disattivo</mat-chip>
        </td>
      </ng-container>

      <ng-container matColumnDef="actions">
        <th mat-header-cell *matHeaderCellDef class="actions-col">Azioni</th>
        <td mat-cell *matCellDef="let item" class="actions-col">
          <button
            mat-icon-button
            (click)="edit.emit(item)"
            matTooltip="Modifica"
            aria-label="Modifica tipo di assenza"
          >
            <mat-icon>edit</mat-icon>
          </button>
          <button
            mat-icon-button
            color="warn"
            (click)="delete.emit(item)"
            matTooltip="Elimina"
            aria-label="Elimina tipo di assenza"
          >
            <mat-icon>delete</mat-icon>
          </button>
        </td>
      </ng-container>

      <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
      <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
    </table>
  `,
  styles: [
    `
      .header-bar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
      }
      h3 {
        margin: 0;
      }
      .full-width {
        width: 100%;
      }
      .description-cell {
        max-width: 400px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .actions-col {
        width: 120px;
        text-align: right;
      }
      .empty-state {
        color: rgba(0, 0, 0, 0.54);
        font-style: italic;
        padding: 24px;
        text-align: center;
        background: #fafafa;
        border-radius: 4px;
      }
    `,
  ],
})
export class AbsenceTypeListComponent {
  @Input() items: OperatorAbsenceType[] = [];

  @Output() create = new EventEmitter<void>();
  @Output() edit = new EventEmitter<OperatorAbsenceType>();
  @Output() delete = new EventEmitter<OperatorAbsenceType>();

  readonly displayedColumns = ['name', 'description', 'isActive', 'actions'];
}
