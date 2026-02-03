/**
 * Patient Anamnesis Tab Component
 * Layer 1: Dumb Component (Presentational)
 *
 * Responsabilità:
 * - Visualizzare l'anamnesi semplice del paziente (legata al paziente, NON al percorso terapeutico)
 * - Campi: patologie pregresse, interventi chirurgici, traumi, terapia farmacologica, allergie, storia familiare
 * - Toolbar con bottoni: Modifica, Elimina, Espandi
 *
 * NOTA: Questo è DIVERSO da EvaluationTabComponent
 * che mostra la valutazione completa del percorso terapeutico.
 */

import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';

import { PatientAnamnesis, isAnamnesisFilled } from '../../models/patient-anamnesis.model';

@Component({
  selector: 'app-patient-anamnesis-tab',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatCardModule,
    MatDividerModule
  ],
  template: `
    <div class="patient-anamnesis-tab">
      @if (loading) {
        <div class="loading-state">
          <mat-spinner diameter="32"></mat-spinner>
          <span>Caricamento anamnesi...</span>
        </div>
      } @else if (!anamnesis || !hasData) {
        <div class="empty-state">
          <mat-icon>medical_information</mat-icon>
          <p>Anamnesi paziente non compilata</p>
          <button mat-flat-button color="primary" (click)="onEdit()">
            <mat-icon>add</mat-icon>
            Compila Anamnesi
          </button>
        </div>
      } @else {
        <div class="anamnesis-content">
          <!-- Toolbar con azioni -->
          <div class="anamnesis-toolbar">
            <div class="anamnesis-info">
              <div class="last-update">
                <mat-icon>update</mat-icon>
                <span>Ultimo aggiornamento: {{ formatDate(anamnesis.updatedAt) }}</span>
              </div>
              @if (anamnesis.operatorName) {
                <div class="compiled-by">
                  <mat-icon>person</mat-icon>
                  <span>Compilata da: {{ anamnesis.operatorName }}</span>
                </div>
              }
            </div>
            <div class="toolbar-actions">
              <button mat-icon-button (click)="onEdit()" matTooltip="Modifica anamnesi">
                <mat-icon>edit</mat-icon>
              </button>
              <button mat-icon-button (click)="onDelete()" matTooltip="Elimina anamnesi" color="warn">
                <mat-icon>delete</mat-icon>
              </button>
              @if (showExpandButton) {
                <button mat-icon-button (click)="onExpand()" matTooltip="Espandi vista">
                  <mat-icon>open_in_full</mat-icon>
                </button>
              }
            </div>
          </div>

          <!-- Contenuto anamnesi -->
          <div class="anamnesis-sections">
            <!-- Patologie pregresse -->
            @if (anamnesis.patologiePregresse) {
              <div class="section">
                <div class="section-header">
                  <mat-icon>healing</mat-icon>
                  <h4>Patologie Pregresse</h4>
                </div>
                <p class="section-content">{{ anamnesis.patologiePregresse }}</p>
              </div>
            }

            <!-- Interventi chirurgici -->
            @if (anamnesis.interventiChirurgici) {
              <div class="section">
                <div class="section-header">
                  <mat-icon>local_hospital</mat-icon>
                  <h4>Interventi Chirurgici</h4>
                </div>
                <p class="section-content">{{ anamnesis.interventiChirurgici }}</p>
              </div>
            }

            <!-- Traumi -->
            @if (anamnesis.traumi) {
              <div class="section">
                <div class="section-header">
                  <mat-icon>personal_injury</mat-icon>
                  <h4>Traumi</h4>
                </div>
                <p class="section-content">{{ anamnesis.traumi }}</p>
              </div>
            }

            <!-- Terapia farmacologica -->
            @if (anamnesis.terapiaFarmacologica?.length) {
              <div class="section">
                <div class="section-header">
                  <mat-icon>medication</mat-icon>
                  <h4>Terapia Farmacologica</h4>
                </div>
                <mat-chip-set class="section-chips">
                  @for (farmaco of anamnesis.terapiaFarmacologica; track farmaco) {
                    <mat-chip>{{ farmaco }}</mat-chip>
                  }
                </mat-chip-set>
              </div>
            }

            <!-- Allergie -->
            @if (anamnesis.allergie) {
              <div class="section section-warning">
                <div class="section-header">
                  <mat-icon>warning</mat-icon>
                  <h4>Allergie</h4>
                </div>
                <p class="section-content">{{ anamnesis.allergie }}</p>
              </div>
            }

            <!-- Storia familiare -->
            @if (anamnesis.storiaFamiliare) {
              <div class="section">
                <div class="section-header">
                  <mat-icon>family_restroom</mat-icon>
                  <h4>Storia Familiare</h4>
                </div>
                <p class="section-content">{{ anamnesis.storiaFamiliare }}</p>
              </div>
            }

            <!-- Note -->
            @if (anamnesis.note) {
              <div class="section section-note">
                <div class="section-header">
                  <mat-icon>notes</mat-icon>
                  <h4>Note</h4>
                </div>
                <p class="section-content">{{ anamnesis.note }}</p>
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
    }

    .patient-anamnesis-tab {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;
    }

    .loading-state, .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px 24px;
      text-align: center;
      color: #64748b;

      mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        color: #cbd5e1;
        margin-bottom: 16px;
      }

      p {
        margin: 0 0 16px;
        font-weight: 500;
      }
    }

    .anamnesis-content {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      padding: 0 0 16px;
      padding-right: 4px;

      &::-webkit-scrollbar {
        width: 6px;
      }

      &::-webkit-scrollbar-track {
        background: #f1f5f9;
        border-radius: 3px;
      }

      &::-webkit-scrollbar-thumb {
        background: #cbd5e1;
        border-radius: 3px;

        &:hover {
          background: #94a3b8;
        }
      }
    }

    .anamnesis-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
      padding: 12px 16px;
      background: #f8fafc;
      border-radius: 8px;
    }

    .anamnesis-info {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      align-items: center;
    }

    .last-update, .compiled-by {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.8125rem;
      color: #64748b;

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
    }

    .compiled-by mat-icon {
      color: #667eea;
    }

    .toolbar-actions {
      display: flex;
      gap: 4px;
    }

    .anamnesis-sections {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .section {
      background: white;
      border-radius: 12px;
      padding: 16px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);

      &.section-warning {
        border-left: 4px solid #f59e0b;
        background: #fffbeb;
      }

      &.section-note {
        background: #f8fafc;
        border-style: dashed;
      }
    }

    .section-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 12px;

      mat-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
        color: #667eea;
      }

      h4 {
        margin: 0;
        font-size: 0.9375rem;
        font-weight: 600;
        color: #334155;
      }
    }

    .section-warning .section-header mat-icon {
      color: #f59e0b;
    }

    .section-content {
      margin: 0;
      font-size: 0.9375rem;
      color: #475569;
      line-height: 1.6;
      white-space: pre-wrap;
    }

    .section-chips {
      margin-top: 4px;
    }

    /* Responsive */
    @media (max-width: 599px) {
      .anamnesis-toolbar {
        flex-direction: column;
        gap: 8px;
        align-items: flex-start;
      }

      .toolbar-actions {
        width: 100%;
        justify-content: flex-end;
      }

      .section {
        padding: 12px;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientAnamnesisTabComponent {
  @Input() anamnesis: PatientAnamnesis | null = null;
  @Input() loading = false;
  @Input() showExpandButton = true;

  @Output() edit = new EventEmitter<void>();
  @Output() delete = new EventEmitter<void>();
  @Output() expand = new EventEmitter<void>();

  get hasData(): boolean {
    return isAnamnesisFilled(this.anamnesis);
  }

  onEdit(): void {
    this.edit.emit();
  }

  onDelete(): void {
    this.delete.emit();
  }

  onExpand(): void {
    this.expand.emit();
  }

  formatDate(date: Date | string | null | undefined): string {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}
