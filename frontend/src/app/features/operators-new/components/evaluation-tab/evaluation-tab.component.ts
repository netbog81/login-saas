/**
 * Evaluation Tab Component
 * Layer 1: Dumb Component (Presentational)
 *
 * Responsabilità:
 * - Visualizzare valutazione completa con 8 sezioni
 * - Sezioni collassabili con mat-expansion-panel
 * - Toolbar con bottoni: Modifica, Elimina, Espandi
 * - Supporta sia il vecchio model Anamnesis che il nuovo AnamnesisComplete
 *
 * NOTA: Questo componente mostra la "Valutazione" del percorso terapeutico.
 * NON confondere con PatientAnamnesisTabComponent che mostra l'anamnesi paziente.
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
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';

import { Anamnesis } from '../../../../models/therapeutic-path.model';
import { AnamnesisComplete, BodyMapMarker, isSectionFilled } from '../../models/anamnesis.model';

// Componente Body Map per visualizzazione readonly
import { BodyMapComponent } from '../body-map/body-map.component';

@Component({
  selector: 'app-evaluation-tab',
  standalone: true,
  imports: [
    CommonModule,
    MatExpansionModule,
    MatIconModule,
    MatButtonModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatDividerModule,
    BodyMapComponent
  ],
  template: `
    <div class="evaluation-tab">
      @if (loading) {
        <div class="loading-state">
          <mat-spinner diameter="32"></mat-spinner>
          <span>Caricamento valutazione...</span>
        </div>
      } @else if (!hasEvaluation) {
        <div class="empty-state">
          <mat-icon>assignment</mat-icon>
          <p>Valutazione non compilata</p>
          <button mat-flat-button color="primary" (click)="onEdit()">
            <mat-icon>add</mat-icon>
            Compila valutazione
          </button>
        </div>
      } @else {
        <div class="evaluation-content">
          <!-- Toolbar con azioni -->
          <div class="evaluation-toolbar">
            <div class="evaluation-info">
              <div class="last-update">
                <mat-icon>update</mat-icon>
                <span>Ultimo aggiornamento: {{ formatDate(getUpdatedAt()) }}</span>
              </div>
              @if (getOperatorName()) {
                <div class="compiled-by">
                  <mat-icon>person</mat-icon>
                  <span>Compilata da: {{ getOperatorName() }}</span>
                </div>
              }
            </div>
            <div class="toolbar-actions">
              <button mat-icon-button (click)="onEdit()" matTooltip="Modifica valutazione">
                <mat-icon>edit</mat-icon>
              </button>
              <button mat-icon-button (click)="onDelete()" matTooltip="Elimina valutazione" color="warn">
                <mat-icon>delete</mat-icon>
              </button>
              <button mat-icon-button (click)="onExpand()" matTooltip="Espandi vista">
                <mat-icon>open_in_full</mat-icon>
              </button>
            </div>
          </div>

          <!-- Panels delle 8 sezioni -->
          <mat-accordion multi>
            <!-- ================================================================ -->
            <!-- SEZIONE 1: INFORMAZIONI GENERALI -->
            <!-- ================================================================ -->
            <mat-expansion-panel expanded [class.filled]="isGeneralInfoFilled()">
              <mat-expansion-panel-header>
                <mat-panel-title>
                  <mat-icon>person</mat-icon>
                  1. Informazioni Generali
                </mat-panel-title>
                @if (isGeneralInfoFilled()) {
                  <mat-panel-description>
                    <span class="filled-badge">Compilata</span>
                  </mat-panel-description>
                }
              </mat-expansion-panel-header>

              <div class="panel-content">
                <div class="info-grid">
                  <div class="info-item">
                    <label>Nome</label>
                    <p>{{ getGeneralInfo()?.nome || '-' }}</p>
                  </div>
                  <div class="info-item">
                    <label>Cognome</label>
                    <p>{{ getGeneralInfo()?.cognome || '-' }}</p>
                  </div>
                  <div class="info-item">
                    <label>Età</label>
                    <p>{{ getGeneralInfo()?.eta || '-' }}</p>
                  </div>
                  <div class="info-item">
                    <label>Sesso</label>
                    <p>{{ formatSesso(getGeneralInfo()?.sesso) }}</p>
                  </div>
                  <div class="info-item">
                    <label>Professione</label>
                    <p>{{ getGeneralInfo()?.professione || '-' }}</p>
                  </div>
                  <div class="info-item">
                    <label>BMI</label>
                    <p>{{ getGeneralInfo()?.bmi || '-' }}</p>
                  </div>
                </div>

                @if (getGeneralInfo()?.sportPraticati?.length) {
                  <div class="field">
                    <label>Sport praticati</label>
                    <mat-chip-set>
                      @for (sport of getGeneralInfo()?.sportPraticati || []; track sport) {
                        <mat-chip>{{ sport }}</mat-chip>
                      }
                    </mat-chip-set>
                  </div>
                }
              </div>
            </mat-expansion-panel>

            <!-- ================================================================ -->
            <!-- SEZIONE 2: IMMAGINE CORPOREA -->
            <!-- ================================================================ -->
            <mat-expansion-panel [class.filled]="getBodyMapMarkers().length > 0">
              <mat-expansion-panel-header>
                <mat-panel-title>
                  <mat-icon>accessibility_new</mat-icon>
                  2. Immagine Corporea
                </mat-panel-title>
                <mat-panel-description>
                  {{ getBodyMapMarkers().length }} punti segnati
                </mat-panel-description>
              </mat-expansion-panel-header>

              <div class="panel-content">
                @if (getBodyMapMarkers().length > 0) {
                  <app-body-map
                    [markers]="getBodyMapMarkers()"
                    [readonly]="true">
                  </app-body-map>
                } @else {
                  <p class="empty-section">Nessun punto segnato sulla mappa corporea</p>
                }
              </div>
            </mat-expansion-panel>

            <!-- ================================================================ -->
            <!-- SEZIONE 3: ANAMNESI PATOLOGICA REMOTA -->
            <!-- ================================================================ -->
            <mat-expansion-panel [class.filled]="isRemoteHistoryFilled()">
              <mat-expansion-panel-header>
                <mat-panel-title>
                  <mat-icon>history</mat-icon>
                  3. Anamnesi Patologica Remota
                </mat-panel-title>
                @if (isRemoteHistoryFilled()) {
                  <mat-panel-description>
                    <span class="filled-badge">Compilata</span>
                  </mat-panel-description>
                }
              </mat-expansion-panel-header>

              <div class="panel-content">
                @if (getRemoteHistory()?.patologiePregresse || getLegacyAnamnesis()?.pastMedicalHistory) {
                  <div class="field">
                    <label>Patologie pregresse</label>
                    <p>{{ getRemoteHistory()?.patologiePregresse || getLegacyAnamnesis()?.pastMedicalHistory }}</p>
                  </div>
                }

                @if (getRemoteHistory()?.interventiChirurgici || getLegacyAnamnesis()?.surgicalHistory) {
                  <div class="field">
                    <label>Interventi chirurgici</label>
                    <p>{{ getRemoteHistory()?.interventiChirurgici || getLegacyAnamnesis()?.surgicalHistory }}</p>
                  </div>
                }

                @if (getRemoteHistory()?.traumi) {
                  <div class="field">
                    <label>Traumi</label>
                    <p>{{ getRemoteHistory()?.traumi }}</p>
                  </div>
                }

                @if (getRemoteHistory()?.terapiaFarmacologica?.length || getLegacyAnamnesis()?.medications?.length) {
                  <div class="field">
                    <label>Terapia farmacologica</label>
                    <mat-chip-set>
                      @for (farmaco of getRemoteHistory()?.terapiaFarmacologica || getLegacyAnamnesis()?.medications || []; track farmaco) {
                        <mat-chip>{{ farmaco }}</mat-chip>
                      }
                    </mat-chip-set>
                  </div>
                }

                @if (!isRemoteHistoryFilled()) {
                  <p class="empty-section">Sezione non compilata</p>
                }
              </div>
            </mat-expansion-panel>

            <!-- ================================================================ -->
            <!-- SEZIONE 4: ANAMNESI PATOLOGICA PROSSIMA -->
            <!-- ================================================================ -->
            <mat-expansion-panel [class.filled]="isRecentHistoryFilled()">
              <mat-expansion-panel-header>
                <mat-panel-title>
                  <mat-icon>report_problem</mat-icon>
                  4. Anamnesi Patologica Prossima
                </mat-panel-title>
                @if (isRecentHistoryFilled()) {
                  <mat-panel-description>
                    <span class="filled-badge">Compilata</span>
                  </mat-panel-description>
                }
              </mat-expansion-panel-header>

              <div class="panel-content">
                @if (getRecentHistory()?.motivoConsulto || getLegacyAnamnesis()?.chiefComplaint) {
                  <div class="field">
                    <label>Motivo del consulto</label>
                    <p>{{ getRecentHistory()?.motivoConsulto || getLegacyAnamnesis()?.chiefComplaint }}</p>
                  </div>
                }

                @if (getRecentHistory()?.esordioSintomi || getLegacyAnamnesis()?.historyOfPresentIllness) {
                  <div class="field">
                    <label>Esordio dei sintomi</label>
                    <p>{{ getRecentHistory()?.esordioSintomi || getLegacyAnamnesis()?.historyOfPresentIllness }}</p>
                  </div>
                }

                @if (getRecentHistory()?.statoAttualeSintomi) {
                  <div class="field">
                    <label>Stato attuale dei sintomi</label>
                    <p>{{ getRecentHistory()?.statoAttualeSintomi }}</p>
                  </div>
                }

                @if (getRecentHistory()?.fattoriAllevianti?.length || getLegacyAnamnesis()?.relievingFactors?.length) {
                  <div class="field">
                    <label>Fattori allevianti</label>
                    <mat-chip-set>
                      @for (fattore of getRecentHistory()?.fattoriAllevianti || getLegacyAnamnesis()?.relievingFactors || []; track fattore) {
                        <mat-chip color="primary">{{ fattore }}</mat-chip>
                      }
                    </mat-chip-set>
                  </div>
                }

                @if (getRecentHistory()?.fattoriAggravanti?.length || getLegacyAnamnesis()?.aggravatingFactors?.length) {
                  <div class="field">
                    <label>Fattori aggravanti</label>
                    <mat-chip-set>
                      @for (fattore of getRecentHistory()?.fattoriAggravanti || getLegacyAnamnesis()?.aggravatingFactors || []; track fattore) {
                        <mat-chip color="warn">{{ fattore }}</mat-chip>
                      }
                    </mat-chip-set>
                  </div>
                }

                @if (getRecentHistory()?.andamentoDolore) {
                  <div class="field">
                    <label>Andamento del dolore</label>
                    <p>{{ getRecentHistory()?.andamentoDolore }}</p>
                  </div>
                }

                @if (!isRecentHistoryFilled()) {
                  <p class="empty-section">Sezione non compilata</p>
                }
              </div>
            </mat-expansion-panel>

            <!-- ================================================================ -->
            <!-- SEZIONE 5: ESAME OBIETTIVO -->
            <!-- ================================================================ -->
            <mat-expansion-panel [class.filled]="isObjectiveExamFilled()">
              <mat-expansion-panel-header>
                <mat-panel-title>
                  <mat-icon>biotech</mat-icon>
                  5. Esame Obiettivo
                </mat-panel-title>
                @if (isObjectiveExamFilled()) {
                  <mat-panel-description>
                    <span class="filled-badge">Compilata</span>
                  </mat-panel-description>
                }
              </mat-expansion-panel-header>

              <div class="panel-content">
                @if (getObjectiveExam()?.osservazione) {
                  <div class="field">
                    <label>Osservazione</label>
                    <p>{{ getObjectiveExam()?.osservazione }}</p>
                  </div>
                }

                @if (getObjectiveExam()?.palpazione) {
                  <div class="field">
                    <label>Palpazione</label>
                    <p>{{ getObjectiveExam()?.palpazione }}</p>
                  </div>
                }

                <div class="field-row">
                  @if (getObjectiveExam()?.movimentoPassivo) {
                    <div class="field">
                      <label>Movimento passivo</label>
                      <p>{{ getObjectiveExam()?.movimentoPassivo }}</p>
                    </div>
                  }

                  @if (getObjectiveExam()?.movimentoAttivo) {
                    <div class="field">
                      <label>Movimento attivo</label>
                      <p>{{ getObjectiveExam()?.movimentoAttivo }}</p>
                    </div>
                  }
                </div>

                <div class="field-row">
                  @if (getObjectiveExam()?.forzaMuscolare) {
                    <div class="field">
                      <label>Forza muscolare</label>
                      <p>{{ getObjectiveExam()?.forzaMuscolare }}</p>
                    </div>
                  }

                  @if (getObjectiveExam()?.equilibrio) {
                    <div class="field">
                      <label>Equilibrio</label>
                      <p>{{ getObjectiveExam()?.equilibrio }}</p>
                    </div>
                  }
                </div>

                @if (getObjectiveExam()?.testSpecifici?.length) {
                  <div class="field">
                    <label>Test specifici</label>
                    <div class="tests-list">
                      @for (test of getObjectiveExam()?.testSpecifici || []; track test.id) {
                        <div class="test-item">
                          <span class="test-name">{{ test.nome }}</span>
                          <span class="test-result" [class.positive]="test.superato === true" [class.negative]="test.superato === false">
                            {{ test.risultato || '-' }}
                          </span>
                        </div>
                      }
                    </div>
                  </div>
                }

                @if (getObjectiveExam()?.esameNeurologico) {
                  <div class="field">
                    <label>Esame neurologico</label>
                    <p>{{ getObjectiveExam()?.esameNeurologico }}</p>
                  </div>
                }

                @if (getObjectiveExam()?.limitazioniAttivita) {
                  <div class="field">
                    <label>Limitazioni attività</label>
                    <p>{{ getObjectiveExam()?.limitazioniAttivita }}</p>
                  </div>
                }

                <div class="field-row">
                  @if (getObjectiveExam()?.fattoriPrognosticiPositivi) {
                    <div class="field positive">
                      <label>Fattori prognostici positivi</label>
                      <p>{{ getObjectiveExam()?.fattoriPrognosticiPositivi }}</p>
                    </div>
                  }

                  @if (getObjectiveExam()?.fattoriPrognosticiNegativi) {
                    <div class="field negative">
                      <label>Fattori prognostici negativi</label>
                      <p>{{ getObjectiveExam()?.fattoriPrognosticiNegativi }}</p>
                    </div>
                  }
                </div>

                @if (getObjectiveExam()?.strategieCoping) {
                  <div class="field">
                    <label>Strategie di coping</label>
                    <p>{{ getObjectiveExam()?.strategieCoping }}</p>
                  </div>
                }

                @if (getObjectiveExam()?.diagnosiFisioterapica) {
                  <div class="field highlight">
                    <label>Diagnosi Fisioterapica</label>
                    <p>{{ getObjectiveExam()?.diagnosiFisioterapica }}</p>
                  </div>
                }

                @if (!isObjectiveExamFilled()) {
                  <p class="empty-section">Sezione non compilata</p>
                }
              </div>
            </mat-expansion-panel>

            <!-- ================================================================ -->
            <!-- SEZIONE 6: ESAMI DIAGNOSTICI -->
            <!-- ================================================================ -->
            <mat-expansion-panel [class.filled]="getDiagnosticExams()?.length">
              <mat-expansion-panel-header>
                <mat-panel-title>
                  <mat-icon>science</mat-icon>
                  6. Esami Diagnostici
                </mat-panel-title>
                <mat-panel-description>
                  {{ getDiagnosticExams()?.length || 0 }} esami
                </mat-panel-description>
              </mat-expansion-panel-header>

              <div class="panel-content">
                @if (getDiagnosticExams()?.length) {
                  <div class="exams-list">
                    @for (exam of getDiagnosticExams() || []; track exam.id) {
                      <div class="exam-item">
                        <div class="exam-header">
                          <span class="exam-name">{{ exam.nomeEsame }}</span>
                          @if (exam.data) {
                            <span class="exam-date">{{ formatDate(exam.data) }}</span>
                          }
                        </div>
                        @if (exam.note) {
                          <p class="exam-note">{{ exam.note }}</p>
                        }
                      </div>
                    }
                  </div>
                } @else {
                  <p class="empty-section">Nessun esame diagnostico inserito</p>
                }
              </div>
            </mat-expansion-panel>

            <!-- ================================================================ -->
            <!-- SEZIONE 7: PIANIFICAZIONE TRATTAMENTO -->
            <!-- ================================================================ -->
            <mat-expansion-panel [class.filled]="isTreatmentPlanFilled()">
              <mat-expansion-panel-header>
                <mat-panel-title>
                  <mat-icon>event_note</mat-icon>
                  7. Pianificazione Trattamento
                </mat-panel-title>
                @if (isTreatmentPlanFilled()) {
                  <mat-panel-description>
                    <span class="filled-badge">Compilata</span>
                  </mat-panel-description>
                }
              </mat-expansion-panel-header>

              <div class="panel-content">
                @if (getTreatmentPlan()?.obiettiviBreveTermine?.length || getLegacyAnamnesis()?.patientGoals) {
                  <div class="objectives-section">
                    <h4>Obiettivi a breve termine</h4>
                    @if (getTreatmentPlan()?.obiettiviBreveTermine?.length) {
                      <div class="objectives-list">
                        @for (obj of getTreatmentPlan()?.obiettiviBreveTermine || []; track obj.id) {
                          <div class="objective-item" [class.achieved]="obj.raggiunto">
                            <mat-icon>{{ obj.raggiunto ? 'check_circle' : 'radio_button_unchecked' }}</mat-icon>
                            <span>{{ obj.descrizione }}</span>
                          </div>
                        }
                      </div>
                    } @else if (getLegacyAnamnesis()?.patientGoals) {
                      <p>{{ getLegacyAnamnesis()?.patientGoals }}</p>
                    }
                  </div>
                }

                @if (getTreatmentPlan()?.obiettiviMedioTermine?.length) {
                  <div class="objectives-section">
                    <h4>Obiettivi a medio termine</h4>
                    <div class="objectives-list">
                      @for (obj of getTreatmentPlan()?.obiettiviMedioTermine || []; track obj.id) {
                        <div class="objective-item" [class.achieved]="obj.raggiunto">
                          <mat-icon>{{ obj.raggiunto ? 'check_circle' : 'radio_button_unchecked' }}</mat-icon>
                          <span>{{ obj.descrizione }}</span>
                        </div>
                      }
                    </div>
                  </div>
                }

                @if (getTreatmentPlan()?.obiettiviLungoTermine?.length || getLegacyAnamnesis()?.therapistGoals) {
                  <div class="objectives-section">
                    <h4>Obiettivi a lungo termine</h4>
                    @if (getTreatmentPlan()?.obiettiviLungoTermine?.length) {
                      <div class="objectives-list">
                        @for (obj of getTreatmentPlan()?.obiettiviLungoTermine || []; track obj.id) {
                          <div class="objective-item" [class.achieved]="obj.raggiunto">
                            <mat-icon>{{ obj.raggiunto ? 'check_circle' : 'radio_button_unchecked' }}</mat-icon>
                            <span>{{ obj.descrizione }}</span>
                          </div>
                        }
                      </div>
                    } @else if (getLegacyAnamnesis()?.therapistGoals) {
                      <p>{{ getLegacyAnamnesis()?.therapistGoals }}</p>
                    }
                  </div>
                }

                @if (getTreatmentPlan()?.interventiProposti?.length) {
                  <div class="field">
                    <label>Interventi proposti</label>
                    <mat-chip-set>
                      @for (intervento of getTreatmentPlan()?.interventiProposti || []; track intervento) {
                        <mat-chip color="primary">{{ intervento }}</mat-chip>
                      }
                    </mat-chip-set>
                  </div>
                }

                @if (getTreatmentPlan()?.frequenzaSedute) {
                  <div class="field">
                    <label>Frequenza sedute</label>
                    <p>{{ getTreatmentPlan()?.frequenzaSedute }}</p>
                  </div>
                }

                @if (!isTreatmentPlanFilled()) {
                  <p class="empty-section">Sezione non compilata</p>
                }
              </div>
            </mat-expansion-panel>

            <!-- ================================================================ -->
            <!-- SEZIONE 8: MONITORAGGIO E RIVALUTAZIONE -->
            <!-- ================================================================ -->
            <mat-expansion-panel [class.filled]="isMonitoringFilled()">
              <mat-expansion-panel-header>
                <mat-panel-title>
                  <mat-icon>trending_up</mat-icon>
                  8. Monitoraggio e Rivalutazione
                </mat-panel-title>
                @if (isMonitoringFilled()) {
                  <mat-panel-description>
                    <span class="filled-badge">Compilata</span>
                  </mat-panel-description>
                }
              </mat-expansion-panel-header>

              <div class="panel-content">
                @if (getMonitoring()?.testSpecifici?.length) {
                  <div class="field">
                    <label>Test specifici</label>
                    <div class="tests-list">
                      @for (test of getMonitoring()?.testSpecifici || []; track test.id) {
                        <div class="test-item">
                          <span class="test-name">{{ test.nome }}</span>
                          <span class="test-result">{{ test.risultato || '-' }}</span>
                          @if (test.data) {
                            <span class="test-date">{{ formatDate(test.data) }}</span>
                          }
                        </div>
                      }
                    </div>
                  </div>
                }

                @if (getMonitoring()?.outcome) {
                  <div class="field">
                    <label>Outcome</label>
                    <p>{{ getMonitoring()?.outcome }}</p>
                  </div>
                }

                @if (getMonitoring()?.criticita?.length) {
                  <div class="field">
                    <label>Criticità</label>
                    <mat-chip-set>
                      @for (criticita of getMonitoring()?.criticita || []; track criticita) {
                        <mat-chip color="warn">{{ criticita }}</mat-chip>
                      }
                    </mat-chip-set>
                  </div>
                }

                @if (!isMonitoringFilled()) {
                  <p class="empty-section">Sezione non compilata</p>
                }
              </div>
            </mat-expansion-panel>
          </mat-accordion>
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

    .evaluation-tab {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;  // Critico per scroll
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

    .evaluation-content {
      flex: 1;
      min-height: 0;  // Critico per scroll
      overflow-y: auto;
      padding: 0 0 16px;
      padding-right: 4px;  // Spazio per scrollbar

      // Scrollbar styling
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

    .evaluation-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
      padding: 12px 16px;
      background: #f8fafc;
      border-radius: 8px;
    }

    .evaluation-info {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      align-items: center;
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

    .compiled-by {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.8125rem;
      color: #64748b;

      mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
        color: #667eea;
      }
    }

    .toolbar-actions {
      display: flex;
      gap: 4px;
    }

    mat-accordion {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    mat-expansion-panel {
      border-radius: 12px !important;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08) !important;

      &.filled {
        border-left: 3px solid #22c55e;
      }

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

        .mat-expansion-panel-header-description {
          justify-content: flex-end;
        }
      }
    }

    .filled-badge {
      font-size: 0.6875rem;
      padding: 2px 8px;
      background: #dcfce7;
      color: #166534;
      border-radius: 12px;
      font-weight: 500;
    }

    .panel-content {
      padding: 8px 0;
    }

    .info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 16px;
      margin-bottom: 16px;
    }

    .info-item {
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
        font-weight: 500;
      }
    }

    .field {
      margin-bottom: 16px;

      &:last-child {
        margin-bottom: 0;
      }

      &.highlight {
        background: #eef2ff;
        padding: 12px;
        border-radius: 8px;
        border-left: 3px solid #667eea;
      }

      &.positive {
        background: #f0fdf4;
        padding: 12px;
        border-radius: 8px;
        border-left: 3px solid #22c55e;
      }

      &.negative {
        background: #fef2f2;
        padding: 12px;
        border-radius: 8px;
        border-left: 3px solid #ef4444;
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
      }
    }

    .field-row {
      display: flex;
      gap: 16px;

      .field {
        flex: 1;
      }
    }

    .empty-section {
      text-align: center;
      color: #94a3b8;
      font-style: italic;
      padding: 16px;
    }

    .tests-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .test-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 12px;
      background: #f8fafc;
      border-radius: 6px;

      .test-name {
        font-weight: 500;
        color: #334155;
      }

      .test-result {
        flex: 1;
        color: #64748b;

        &.positive {
          color: #16a34a;
        }

        &.negative {
          color: #dc2626;
        }
      }

      .test-date {
        font-size: 0.75rem;
        color: #94a3b8;
      }
    }

    .exams-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .exam-item {
      padding: 12px;
      background: #f8fafc;
      border-radius: 8px;

      .exam-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 4px;

        .exam-name {
          font-weight: 500;
          color: #334155;
        }

        .exam-date {
          font-size: 0.75rem;
          color: #64748b;
        }
      }

      .exam-note {
        margin: 0;
        font-size: 0.875rem;
        color: #64748b;
      }
    }

    .objectives-section {
      margin-bottom: 20px;

      h4 {
        margin: 0 0 12px;
        font-size: 0.875rem;
        font-weight: 600;
        color: #334155;
      }
    }

    .objectives-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .objective-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: #f8fafc;
      border-radius: 6px;

      mat-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
        color: #94a3b8;
      }

      &.achieved {
        background: #f0fdf4;

        mat-icon {
          color: #22c55e;
        }

        span {
          text-decoration: line-through;
          color: #64748b;
        }
      }
    }

    mat-chip-set {
      margin-top: 8px;
    }

    /* Responsive */
    @media (max-width: 599px) {
      .evaluation-toolbar {
        flex-direction: column;
        gap: 8px;
        align-items: flex-start;
      }

      .toolbar-actions {
        width: 100%;
        justify-content: flex-end;
      }

      .info-grid {
        grid-template-columns: repeat(2, 1fr);
      }

      .field-row {
        flex-direction: column;
        gap: 0;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EvaluationTabComponent {
  // Supporta sia il vecchio model che il nuovo
  @Input() anamnesis: Anamnesis | null = null;
  @Input() anamnesisComplete: AnamnesisComplete | null = null;
  @Input() loading = false;

  @Output() edit = new EventEmitter<void>();
  @Output() delete = new EventEmitter<void>();
  @Output() expand = new EventEmitter<void>();

  // ============================================================
  // COMPUTED PROPERTIES
  // ============================================================

  get hasEvaluation(): boolean {
    return !!(this.anamnesis || this.anamnesisComplete);
  }

  // ============================================================
  // GETTERS PER SEZIONI (supportano entrambi i model)
  // ============================================================

  getLegacyAnamnesis(): Anamnesis | null {
    return this.anamnesis;
  }

  getGeneralInfo() {
    return this.anamnesisComplete?.generalInfo || null;
  }

  getBodyMapMarkers(): BodyMapMarker[] {
    return this.anamnesisComplete?.bodyMap?.markers || [];
  }

  getRemoteHistory() {
    return this.anamnesisComplete?.remoteHistory || null;
  }

  getRecentHistory() {
    return this.anamnesisComplete?.recentHistory || null;
  }

  getObjectiveExam() {
    return this.anamnesisComplete?.objectiveExam || null;
  }

  getDiagnosticExams() {
    return this.anamnesisComplete?.diagnosticExams || [];
  }

  getTreatmentPlan() {
    return this.anamnesisComplete?.treatmentPlan || null;
  }

  getMonitoring() {
    return this.anamnesisComplete?.monitoring || null;
  }

  getUpdatedAt(): Date | string {
    return this.anamnesisComplete?.updatedAt || this.anamnesis?.updatedAt || new Date();
  }

  getOperatorName(): string | null {
    return this.anamnesisComplete?.operatorName || null;
  }

  // ============================================================
  // IS FILLED CHECKERS
  // ============================================================

  isGeneralInfoFilled(): boolean {
    const info = this.getGeneralInfo();
    if (!info) return false;
    return !!(info.professione || info.sportPraticati?.length || info.bmi);
  }

  isRemoteHistoryFilled(): boolean {
    const history = this.getRemoteHistory();
    const legacy = this.getLegacyAnamnesis();
    if (history) {
      return !!(history.patologiePregresse || history.interventiChirurgici ||
                history.traumi || history.terapiaFarmacologica?.length);
    }
    if (legacy) {
      return !!(legacy.pastMedicalHistory || legacy.surgicalHistory || legacy.medications?.length);
    }
    return false;
  }

  isRecentHistoryFilled(): boolean {
    const history = this.getRecentHistory();
    const legacy = this.getLegacyAnamnesis();
    if (history) {
      return !!(history.motivoConsulto || history.esordioSintomi || history.statoAttualeSintomi ||
                history.fattoriAllevianti?.length || history.fattoriAggravanti?.length || history.andamentoDolore);
    }
    if (legacy) {
      return !!(legacy.chiefComplaint || legacy.historyOfPresentIllness ||
                legacy.aggravatingFactors?.length || legacy.relievingFactors?.length);
    }
    return false;
  }

  isObjectiveExamFilled(): boolean {
    const exam = this.getObjectiveExam();
    if (!exam) return false;
    return !!(exam.osservazione || exam.palpazione || exam.movimentoPassivo ||
              exam.movimentoAttivo || exam.forzaMuscolare || exam.equilibrio ||
              exam.testSpecifici?.length || exam.diagnosiFisioterapica);
  }

  isTreatmentPlanFilled(): boolean {
    const plan = this.getTreatmentPlan();
    const legacy = this.getLegacyAnamnesis();
    if (plan) {
      return !!(plan.obiettiviBreveTermine?.length || plan.obiettiviMedioTermine?.length ||
                plan.obiettiviLungoTermine?.length || plan.interventiProposti?.length || plan.frequenzaSedute);
    }
    if (legacy) {
      return !!(legacy.patientGoals || legacy.therapistGoals);
    }
    return false;
  }

  isMonitoringFilled(): boolean {
    const monitoring = this.getMonitoring();
    if (!monitoring) return false;
    return !!(monitoring.testSpecifici?.length || monitoring.outcome || monitoring.criticita?.length);
  }

  // ============================================================
  // EVENT HANDLERS
  // ============================================================

  onEdit(): void {
    this.edit.emit();
  }

  onDelete(): void {
    this.delete.emit();
  }

  onExpand(): void {
    this.expand.emit();
  }

  // ============================================================
  // FORMATTERS
  // ============================================================

  formatDate(date: Date | string | null | undefined): string {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  formatSesso(sesso: string | null | undefined): string {
    if (!sesso) return '-';
    switch (sesso) {
      case 'MASCHIO': return 'Maschio';
      case 'FEMMINA': return 'Femmina';
      case 'ALTRO': return 'Altro';
      default: return sesso;
    }
  }
}
