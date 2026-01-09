/**
 * Anamnesis Tab Component
 * Layer 1: Dumb Component (Presentational)
 *
 * Responsabilità:
 * - Visualizzare anamnesi del percorso terapeutico
 * - Usare expansion panels per le sezioni
 */

import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Anamnesis } from '../../../../models/therapeutic-path.model';

@Component({
  selector: 'app-anamnesis-tab',
  standalone: true,
  imports: [
    CommonModule,
    MatExpansionModule,
    MatIconModule,
    MatButtonModule,
    MatChipsModule,
    MatProgressSpinnerModule
  ],
  template: `
    <div class="anamnesis-tab">
      @if (loading) {
        <div class="loading-state">
          <mat-spinner diameter="32"></mat-spinner>
          <span>Caricamento anamnesi...</span>
        </div>
      } @else if (!anamnesis) {
        <div class="empty-state">
          <mat-icon>assignment</mat-icon>
          <p>Anamnesi non compilata</p>
          <button mat-flat-button color="primary" (click)="onEdit()">
            <mat-icon>add</mat-icon>
            Compila Anamnesi
          </button>
        </div>
      } @else {
        <div class="anamnesis-content">
          <!-- Header con azioni -->
          <div class="anamnesis-header">
            <div class="last-update">
              <mat-icon>update</mat-icon>
              <span>Ultimo aggiornamento: {{ formatDate(anamnesis.updatedAt) }}</span>
            </div>
            <button mat-icon-button (click)="onEdit()" matTooltip="Modifica anamnesi">
              <mat-icon>edit</mat-icon>
            </button>
          </div>

          <!-- Panels -->
          <mat-accordion multi>
            <!-- Motivo della visita -->
            <mat-expansion-panel expanded>
              <mat-expansion-panel-header>
                <mat-panel-title>
                  <mat-icon>report_problem</mat-icon>
                  Motivo della Visita
                </mat-panel-title>
              </mat-expansion-panel-header>

              <div class="panel-content">
                <div class="field">
                  <label>Disturbo Principale</label>
                  <p>{{ anamnesis.chiefComplaint || 'Non specificato' }}</p>
                </div>

                <div class="field">
                  <label>Storia del Problema Attuale</label>
                  <p>{{ anamnesis.historyOfPresentIllness || 'Non specificato' }}</p>
                </div>

                @if (anamnesis.onsetDate) {
                  <div class="field inline">
                    <label>Data Insorgenza</label>
                    <p>{{ formatDate(anamnesis.onsetDate) }}</p>
                  </div>
                }
              </div>
            </mat-expansion-panel>

            <!-- Valutazione del dolore -->
            <mat-expansion-panel>
              <mat-expansion-panel-header>
                <mat-panel-title>
                  <mat-icon>sentiment_very_dissatisfied</mat-icon>
                  Valutazione del Dolore
                </mat-panel-title>
              </mat-expansion-panel-header>

              <div class="panel-content">
                <div class="pain-assessment">
                  @if (anamnesis.painScale !== undefined) {
                    <div class="pain-scale">
                      <label>Intensità (VAS)</label>
                      <div class="pain-value" [class]="getPainClass(anamnesis.painScale)">
                        {{ anamnesis.painScale }}/10
                      </div>
                    </div>
                  }

                  @if (anamnesis.painLocation) {
                    <div class="field">
                      <label>Localizzazione</label>
                      <p>{{ anamnesis.painLocation }}</p>
                    </div>
                  }
                </div>

                @if (anamnesis.aggravatingFactors?.length) {
                  <div class="field">
                    <label>Fattori Aggravanti</label>
                    <mat-chip-set>
                      @for (factor of anamnesis.aggravatingFactors; track factor) {
                        <mat-chip color="warn">{{ factor }}</mat-chip>
                      }
                    </mat-chip-set>
                  </div>
                }

                @if (anamnesis.relievingFactors?.length) {
                  <div class="field">
                    <label>Fattori Allevianti</label>
                    <mat-chip-set>
                      @for (factor of anamnesis.relievingFactors; track factor) {
                        <mat-chip color="primary">{{ factor }}</mat-chip>
                      }
                    </mat-chip-set>
                  </div>
                }
              </div>
            </mat-expansion-panel>

            <!-- Storia Clinica -->
            <mat-expansion-panel>
              <mat-expansion-panel-header>
                <mat-panel-title>
                  <mat-icon>history</mat-icon>
                  Storia Clinica
                </mat-panel-title>
              </mat-expansion-panel-header>

              <div class="panel-content">
                @if (anamnesis.pastMedicalHistory) {
                  <div class="field">
                    <label>Patologie Pregresse</label>
                    <p>{{ anamnesis.pastMedicalHistory }}</p>
                  </div>
                }

                @if (anamnesis.surgicalHistory) {
                  <div class="field">
                    <label>Interventi Chirurgici</label>
                    <p>{{ anamnesis.surgicalHistory }}</p>
                  </div>
                }

                @if (anamnesis.familyHistory) {
                  <div class="field">
                    <label>Familiarità</label>
                    <p>{{ anamnesis.familyHistory }}</p>
                  </div>
                }
              </div>
            </mat-expansion-panel>

            <!-- Farmaci e Allergie -->
            <mat-expansion-panel>
              <mat-expansion-panel-header>
                <mat-panel-title>
                  <mat-icon>medication</mat-icon>
                  Farmaci e Allergie
                </mat-panel-title>
              </mat-expansion-panel-header>

              <div class="panel-content">
                @if (anamnesis.medications?.length) {
                  <div class="field">
                    <label>Farmaci in uso</label>
                    <mat-chip-set>
                      @for (med of anamnesis.medications; track med) {
                        <mat-chip>{{ med }}</mat-chip>
                      }
                    </mat-chip-set>
                  </div>
                } @else {
                  <div class="field">
                    <label>Farmaci in uso</label>
                    <p class="empty">Nessun farmaco segnalato</p>
                  </div>
                }

                @if (anamnesis.allergies?.length) {
                  <div class="field">
                    <label>Allergie</label>
                    <mat-chip-set>
                      @for (allergy of anamnesis.allergies; track allergy) {
                        <mat-chip color="warn">{{ allergy }}</mat-chip>
                      }
                    </mat-chip-set>
                  </div>
                } @else {
                  <div class="field">
                    <label>Allergie</label>
                    <p class="empty">Nessuna allergia segnalata</p>
                  </div>
                }
              </div>
            </mat-expansion-panel>

            <!-- Obiettivi -->
            <mat-expansion-panel>
              <mat-expansion-panel-header>
                <mat-panel-title>
                  <mat-icon>flag</mat-icon>
                  Obiettivi Terapeutici
                </mat-panel-title>
              </mat-expansion-panel-header>

              <div class="panel-content">
                @if (anamnesis.patientGoals) {
                  <div class="field">
                    <label>Obiettivi del Paziente</label>
                    <p>{{ anamnesis.patientGoals }}</p>
                  </div>
                }

                @if (anamnesis.therapistGoals) {
                  <div class="field">
                    <label>Obiettivi del Terapista</label>
                    <p>{{ anamnesis.therapistGoals }}</p>
                  </div>
                }
              </div>
            </mat-expansion-panel>
          </mat-accordion>
        </div>
      }
    </div>
  `,
  styles: [`
    .anamnesis-tab {
      height: 100%;
      overflow-y: auto;
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
      padding: 0 0 16px;
    }

    .anamnesis-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
      padding: 12px 16px;
      background: #f8fafc;
      border-radius: 8px;
    }

    .last-update {
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

    mat-accordion {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    mat-expansion-panel {
      border-radius: 12px !important;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08) !important;

      ::ng-deep {
        .mat-expansion-panel-header-title {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #334155;
          font-weight: 500;

          mat-icon {
            font-size: 20px;
            width: 20px;
            height: 20px;
            color: #667eea;
          }
        }
      }
    }

    .panel-content {
      padding: 8px 0;
    }

    .field {
      margin-bottom: 16px;

      &:last-child {
        margin-bottom: 0;
      }

      &.inline {
        display: flex;
        align-items: center;
        gap: 8px;

        label {
          margin-bottom: 0;
        }

        p {
          font-weight: 500;
        }
      }

      label {
        display: block;
        font-size: 0.75rem;
        font-weight: 600;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 4px;
      }

      p {
        margin: 0;
        font-size: 0.9375rem;
        color: #1e293b;
        line-height: 1.5;

        &.empty {
          color: #94a3b8;
          font-style: italic;
        }
      }
    }

    .pain-assessment {
      display: flex;
      gap: 24px;
      align-items: flex-start;
      margin-bottom: 16px;
    }

    .pain-scale {
      label {
        display: block;
        font-size: 0.75rem;
        font-weight: 600;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 4px;
      }
    }

    .pain-value {
      font-size: 1.5rem;
      font-weight: 700;
      padding: 8px 16px;
      border-radius: 8px;

      &.pain-low {
        background: #dcfce7;
        color: #166534;
      }

      &.pain-medium {
        background: #fef3c7;
        color: #92400e;
      }

      &.pain-high {
        background: #fee2e2;
        color: #dc2626;
      }
    }

    mat-chip-set {
      margin-top: 8px;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AnamnesisTabComponent {
  @Input() anamnesis: Anamnesis | null = null;
  @Input() loading = false;

  @Output() edit = new EventEmitter<void>();

  onEdit(): void {
    this.edit.emit();
  }

  formatDate(date: Date | string): string {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  getPainClass(pain: number): string {
    if (pain <= 3) return 'pain-low';
    if (pain <= 6) return 'pain-medium';
    return 'pain-high';
  }
}
