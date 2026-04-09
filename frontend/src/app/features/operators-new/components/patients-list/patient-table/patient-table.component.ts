/**
 * Patient Table Component
 * Layer 1: UI Component (Dumb)
 *
 * Responsabilità:
 * - Visualizzare la tabella dei pazienti con mat-table
 * - Emettere evento quando si seleziona un paziente
 */

import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  ViewChild,
  AfterViewInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginatorModule, MatPaginator } from '@angular/material/paginator';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { Patient, getPatientPhone, getPatientInitials } from '../../../../../models/patient.model';

@Component({
  selector: 'app-patient-table',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatProgressSpinnerModule
  ],
  template: `
    <div class="table-container">
      @if (loading) {
        <div class="loading-overlay">
          <mat-spinner diameter="40"></mat-spinner>
        </div>
      }

      @if (!loading && patients.length === 0) {
        <div class="empty-state">
          <mat-icon>person_off</mat-icon>
          <p>{{ emptyMessage }}</p>
        </div>
      } @else {
        <div class="table-wrapper">
          <table mat-table [dataSource]="dataSource" matSort class="patients-table">
            <!-- Avatar Column -->
            <ng-container matColumnDef="avatar">
              <th mat-header-cell *matHeaderCellDef></th>
              <td mat-cell *matCellDef="let patient">
                <div class="avatar">
                  {{ getInitials(patient) }}
                </div>
              </td>
            </ng-container>

            <!-- Nome Column -->
            <ng-container matColumnDef="nome">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>Nome</th>
              <td mat-cell *matCellDef="let patient">{{ patient.nome }}</td>
            </ng-container>

            <!-- Cognome Column -->
            <ng-container matColumnDef="cognome">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>Cognome</th>
              <td mat-cell *matCellDef="let patient">{{ patient.cognome }}</td>
            </ng-container>

            <!-- Telefono Column -->
            <ng-container matColumnDef="telefono">
              <th mat-header-cell *matHeaderCellDef>Telefono</th>
              <td mat-cell *matCellDef="let patient">
                {{ getPhone(patient) || '-' }}
              </td>
            </ng-container>

            <!-- Email Column -->
            <ng-container matColumnDef="email">
              <th mat-header-cell *matHeaderCellDef>Email</th>
              <td mat-cell *matCellDef="let patient">
                {{ patient.email || '-' }}
              </td>
            </ng-container>

            <!-- Actions Column -->
            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef>Azioni</th>
              <td mat-cell *matCellDef="let patient">
                <button mat-icon-button
                        color="primary"
                        matTooltip="Visualizza dettagli"
                        (click)="onViewPatient(patient, $event)">
                  <mat-icon>visibility</mat-icon>
                </button>
                <button mat-icon-button
                        color="primary"
                        matTooltip="Elenco appuntamenti"
                        (click)="onViewAppointments(patient, $event)">
                  <mat-icon>event_note</mat-icon>
                </button>
                <button mat-icon-button
                        color="accent"
                        matTooltip="Nuovo appuntamento"
                        (click)="onNewAppointment(patient, $event)">
                  <mat-icon>event</mat-icon>
                </button>
                <button mat-icon-button
                        matTooltip="Modifica anagrafica"
                        (click)="onEditPatient(patient, $event)"
                        *ngIf="patientEdit.observed">
                  <mat-icon>edit</mat-icon>
                </button>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns; sticky: true"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns;"
                class="patient-row"
                [class.selected]="selectedPatientId === row.id"
                (click)="onRowClick(row)">
            </tr>
          </table>
        </div>

        <mat-paginator
          [pageSizeOptions]="[10, 25, 50]"
          [pageSize]="25"
          showFirstLastButtons>
        </mat-paginator>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
      min-height: 0;
    }

    .table-container {
      position: relative;
      background: white;
      border-radius: 12px;
      overflow: hidden;
      height: 100%;
      display: flex;
      flex-direction: column;
    }

    .table-wrapper {
      flex: 1;
      min-height: 0;
      overflow: auto;
    }

    .loading-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(255, 255, 255, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px 24px;
      color: #64748b;

      mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        margin-bottom: 16px;
        opacity: 0.5;
      }

      p {
        margin: 0;
        font-size: 0.9375rem;
      }
    }

    .patients-table {
      width: 100%;
    }

    .avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.875rem;
      font-weight: 600;
    }

    .patient-row {
      cursor: pointer;
      transition: background-color 0.2s ease;

      &:hover {
        background-color: #f8fafc;
      }

      &.selected {
        background-color: #eff6ff;
      }
    }

    th.mat-mdc-header-cell {
      font-weight: 600;
      color: #475569;
      font-size: 0.8125rem;
    }

    td.mat-mdc-cell {
      font-size: 0.875rem;
      color: #1e293b;
    }

    /* Responsive - Hide columns on small screens */
    @media (max-width: 959px) {
      .mat-column-email {
        display: none;
      }
    }

    @media (max-width: 599px) {
      .mat-column-telefono {
        display: none;
      }

      .avatar {
        width: 32px;
        height: 32px;
        font-size: 0.75rem;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientTableComponent implements AfterViewInit {
  @Input() set patients(value: Patient[]) {
    this.dataSource.data = value;
  }
  get patients(): Patient[] {
    return this.dataSource.data;
  }

  @Input() loading: boolean = false;
  @Input() selectedPatientId: string | null = null;
  @Input() emptyMessage: string = 'Nessun paziente trovato';

  @Output() patientSelect = new EventEmitter<Patient>();
  @Output() patientView = new EventEmitter<Patient>();
  @Output() viewAppointments = new EventEmitter<Patient>();
  @Output() newAppointment = new EventEmitter<Patient>();
  @Output() patientEdit = new EventEmitter<Patient>();

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  displayedColumns: string[] = ['avatar', 'nome', 'cognome', 'telefono', 'email', 'actions'];
  dataSource = new MatTableDataSource<Patient>([]);

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  getInitials(patient: Patient): string {
    return getPatientInitials(patient);
  }

  getPhone(patient: Patient): string {
    return getPatientPhone(patient);
  }

  onRowClick(patient: Patient): void {
    this.patientSelect.emit(patient);
  }

  onViewPatient(patient: Patient, event: Event): void {
    event.stopPropagation();
    this.patientView.emit(patient);
  }

  onViewAppointments(patient: Patient, event: Event): void {
    event.stopPropagation();
    this.viewAppointments.emit(patient);
  }

  onNewAppointment(patient: Patient, event: Event): void {
    event.stopPropagation();
    this.newAppointment.emit(patient);
  }

  onEditPatient(patient: Patient, event: Event): void {
    event.stopPropagation();
    this.patientEdit.emit(patient);
  }
}
