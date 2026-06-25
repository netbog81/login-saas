/**
 * Anamnesis Form Component
 * Layer 1: Dumb Component (Presentational)
 *
 * Responsabilità:
 * - Form reattivo per compilazione anamnesi completa (8 sezioni)
 * - Chip input per campi multi-valore
 * - Integra body-map component
 * - Auto-fill dati paziente per sezione 1
 */

import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnChanges,
  SimpleChanges,
  ChangeDetectionStrategy,
  ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';

// Angular Material
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { COMMA, ENTER } from '@angular/cdk/keycodes';
import { MatChipInputEvent } from '@angular/material/chips';

// Components
import { BodyMapComponent } from '../body-map/body-map.component';

// Models
import {
  AnamnesisComplete,
  BodyMapMarker,
  TestSpecifico,
  DiagnosticExam,
  Obiettivo,
  generateId,
  createEmptyAnamnesis
} from '../../models/anamnesis.model';
import { Patient } from '../../../../models/patient.model';
import { PatientAnamnesis } from '../../models/patient-anamnesis.model';

@Component({
  selector: 'app-anamnesis-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatExpansionModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatDatepickerModule,
    MatCheckboxModule,
    MatTooltipModule,
    MatDividerModule,
    BodyMapComponent
  ],
  template: `
    <form [formGroup]="form" class="anamnesis-form">
      <mat-accordion multi>
        <!-- ================================================================ -->
        <!-- SEZIONE 1: INFORMAZIONI GENERALI (+ dati percorso terapeutico) -->
        <!-- ================================================================ -->
        <mat-expansion-panel expanded>
          <mat-expansion-panel-header>
            <mat-panel-title>
              <mat-icon>person</mat-icon>
              1. Informazioni Generali
            </mat-panel-title>
          </mat-expansion-panel-header>

          <!-- Dati del percorso terapeutico (modulo unificato). Gli altri
               campi del percorso sono nei "dettagli percorso". -->
          <div class="section-content path-info-block" formGroupName="pathInfo">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Nome percorso</mat-label>
              <input matInput formControlName="nome" required
                placeholder="Es: Lombalgia cronica, Riabilitazione post-operatoria...">
              @if (form.get('pathInfo.nome')?.hasError('required') && form.get('pathInfo.nome')?.touched) {
                <mat-error>Il nome del percorso è obbligatorio</mat-error>
              }
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Diagnosi</mat-label>
              <textarea matInput formControlName="diagnosi" rows="2"
                placeholder="Diagnosi medica di riferimento..."></textarea>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Note percorso</mat-label>
              <textarea matInput formControlName="note" rows="2"
                placeholder="Note generali sul percorso terapeutico..."></textarea>
            </mat-form-field>
          </div>

          <mat-divider></mat-divider>

          <div class="section-content" formGroupName="generalInfo">
            <div class="form-row three-cols">
              <mat-form-field appearance="outline">
                <mat-label>Nome</mat-label>
                <input matInput formControlName="nome" readonly>
                <mat-icon matSuffix matTooltip="Auto-compilato">lock</mat-icon>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Cognome</mat-label>
                <input matInput formControlName="cognome" readonly>
                <mat-icon matSuffix matTooltip="Auto-compilato">lock</mat-icon>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Età</mat-label>
                <input matInput formControlName="eta" readonly>
                <mat-icon matSuffix matTooltip="Auto-compilato">lock</mat-icon>
              </mat-form-field>
            </div>

            <div class="form-row three-cols">
              <mat-form-field appearance="outline">
                <mat-label>Sesso</mat-label>
                <mat-select formControlName="sesso">
                  <mat-option value="MASCHIO">Maschio</mat-option>
                  <mat-option value="FEMMINA">Femmina</mat-option>
                  <mat-option value="ALTRO">Altro</mat-option>
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Professione</mat-label>
                <input matInput formControlName="professione" placeholder="Es: Impiegato">
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>BMI</mat-label>
                <input matInput type="number" formControlName="bmi" placeholder="Es: 24.5">
              </mat-form-field>
            </div>

            <div class="form-row">
              <mat-form-field appearance="outline" class="chip-field">
                <mat-label>Sport praticati</mat-label>
                <mat-chip-grid #sportChipGrid>
                  @for (sport of sportPraticatiArray; track sport) {
                    <mat-chip-row (removed)="removeChip('sportPraticati', sport)">
                      {{ sport }}
                      <button matChipRemove>
                        <mat-icon>cancel</mat-icon>
                      </button>
                    </mat-chip-row>
                  }
                </mat-chip-grid>
                <input
                  placeholder="Digita e premi Enter..."
                  [matChipInputFor]="sportChipGrid"
                  [matChipInputSeparatorKeyCodes]="separatorKeyCodes"
                  (matChipInputTokenEnd)="addChip('sportPraticati', $event)">
              </mat-form-field>
            </div>
          </div>
        </mat-expansion-panel>

        <!-- ================================================================ -->
        <!-- SEZIONE 2: IMMAGINE CORPOREA -->
        <!-- ================================================================ -->
        <mat-expansion-panel expanded>
          <mat-expansion-panel-header>
            <mat-panel-title>
              <mat-icon>accessibility_new</mat-icon>
              2. Immagine Corporea
            </mat-panel-title>
            <mat-panel-description>
              {{ bodyMapMarkers.length }} punti segnati
            </mat-panel-description>
          </mat-expansion-panel-header>

          <div class="section-content">
            <app-body-map
              [markers]="bodyMapMarkers"
              [readonly]="false"
              (markersChange)="onBodyMapChange($event)">
            </app-body-map>
          </div>
        </mat-expansion-panel>

        <!-- ================================================================ -->
        <!-- SEZIONE 3: ANAMNESI PATOLOGICA PROSSIMA -->
        <!-- ================================================================ -->
        <mat-expansion-panel expanded>
          <mat-expansion-panel-header>
            <mat-panel-title>
              <mat-icon>report_problem</mat-icon>
              3. Anamnesi Patologica Prossima
            </mat-panel-title>
          </mat-expansion-panel-header>

          <div class="section-content" formGroupName="recentHistory">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Motivo del consulto</mat-label>
              <textarea matInput formControlName="motivoConsulto" rows="2"
                placeholder="Es: Dolore lombare persistente da circa 3 mesi..."></textarea>
            </mat-form-field>

            <div class="form-row two-cols">
              <mat-form-field appearance="outline">
                <mat-label>Esordio dei sintomi</mat-label>
                <input matInput formControlName="esordioSintomi"
                  placeholder="Es: Circa 3 mesi fa, dopo sforzo">
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Stato attuale dei sintomi</mat-label>
                <input matInput formControlName="statoAttualeSintomi"
                  placeholder="Es: Dolore costante con esacerbazioni">
              </mat-form-field>
            </div>

            <div class="form-row two-cols">
              <mat-form-field appearance="outline" class="chip-field">
                <mat-label>Fattori allevianti</mat-label>
                <mat-chip-grid #alleviChipGrid>
                  @for (fattore of fattoriAlleviantiArray; track fattore) {
                    <mat-chip-row color="primary" (removed)="removeChip('fattoriAllevianti', fattore)">
                      {{ fattore }}
                      <button matChipRemove><mat-icon>cancel</mat-icon></button>
                    </mat-chip-row>
                  }
                </mat-chip-grid>
                <input
                  placeholder="Es: Riposo, calore..."
                  [matChipInputFor]="alleviChipGrid"
                  [matChipInputSeparatorKeyCodes]="separatorKeyCodes"
                  (matChipInputTokenEnd)="addChip('fattoriAllevianti', $event)">
              </mat-form-field>

              <mat-form-field appearance="outline" class="chip-field">
                <mat-label>Fattori aggravanti</mat-label>
                <mat-chip-grid #aggraChipGrid>
                  @for (fattore of fattoriAggravantiArray; track fattore) {
                    <mat-chip-row color="warn" (removed)="removeChip('fattoriAggravanti', fattore)">
                      {{ fattore }}
                      <button matChipRemove><mat-icon>cancel</mat-icon></button>
                    </mat-chip-row>
                  }
                </mat-chip-grid>
                <input
                  placeholder="Es: Flessione, stare in piedi..."
                  [matChipInputFor]="aggraChipGrid"
                  [matChipInputSeparatorKeyCodes]="separatorKeyCodes"
                  (matChipInputTokenEnd)="addChip('fattoriAggravanti', $event)">
              </mat-form-field>
            </div>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Andamento del dolore</mat-label>
              <input matInput formControlName="andamentoDolore"
                placeholder="Es: Peggioramento serale, miglioramento con riposo notturno">
            </mat-form-field>
          </div>
        </mat-expansion-panel>

        <!-- ================================================================ -->
        <!-- SEZIONE 4: ESAMI DIAGNOSTICI -->
        <!-- ================================================================ -->
        <mat-expansion-panel expanded>
          <mat-expansion-panel-header>
            <mat-panel-title>
              <mat-icon>science</mat-icon>
              4. Esami Diagnostici
            </mat-panel-title>
            <mat-panel-description>
              {{ diagnosticExamsArray.length }} esami
            </mat-panel-description>
          </mat-expansion-panel-header>

          <div class="section-content">
            <div class="subsection-header">
              <button mat-stroked-button type="button" (click)="addDiagnosticExam()">
                <mat-icon>add</mat-icon> Aggiungi Esame
              </button>
            </div>

            @for (exam of diagnosticExamsArray.controls; track $index; let i = $index) {
              <div class="exam-row" formArrayName="diagnosticExams">
                <div [formGroupName]="i" class="exam-fields">
                  <mat-form-field appearance="outline">
                    <mat-label>Nome esame</mat-label>
                    <input matInput formControlName="nomeEsame" placeholder="Es: RX Rachide Lombare">
                  </mat-form-field>
                  <mat-form-field appearance="outline">
                    <mat-label>Data</mat-label>
                    <input matInput [matDatepicker]="examDatePicker" formControlName="data">
                    <mat-datepicker-toggle matSuffix [for]="examDatePicker"></mat-datepicker-toggle>
                    <mat-datepicker #examDatePicker></mat-datepicker>
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="flex-grow">
                    <mat-label>Note</mat-label>
                    <input matInput formControlName="note" placeholder="Es: Discopatia L4-L5">
                  </mat-form-field>
                  <button mat-icon-button color="warn" type="button" (click)="removeDiagnosticExam(i)">
                    <mat-icon>delete</mat-icon>
                  </button>
                </div>
              </div>
            }

            @if (diagnosticExamsArray.length === 0) {
              <p class="empty-message">Nessun esame diagnostico inserito</p>
            }
          </div>
        </mat-expansion-panel>

        <!-- ================================================================ -->
        <!-- SEZIONE 5: ANAMNESI PATOLOGICA REMOTA -->
        <!-- Dati del paziente (tabella PatientAnamnesis), pre-compilati se -->
        <!-- già esistenti. Gli altri campi (allergie, storia familiare,    -->
        <!-- gruppo sanguigno...) sono nei "dettagli anamnesi remota".      -->
        <!-- ================================================================ -->
        <mat-expansion-panel expanded>
          <mat-expansion-panel-header>
            <mat-panel-title>
              <mat-icon>history</mat-icon>
              5. Anamnesi Patologica Remota
            </mat-panel-title>
          </mat-expansion-panel-header>

          <div class="section-content" formGroupName="remoteHistory">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Patologie pregresse</mat-label>
              <textarea matInput formControlName="patologiePregresse" rows="3"
                placeholder="Es: Ipertensione arteriosa, diabete tipo 2..."></textarea>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Interventi chirurgici</mat-label>
              <textarea matInput formControlName="interventiChirurgici" rows="2"
                placeholder="Es: Appendicectomia (2010), artroscopia ginocchio dx (2018)..."></textarea>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Traumi</mat-label>
              <textarea matInput formControlName="traumi" rows="2"
                placeholder="Es: Frattura clavicola sx (2015), distorsione caviglia dx (2020)..."></textarea>
            </mat-form-field>

            <mat-form-field appearance="outline" class="chip-field full-width">
              <mat-label>Terapia farmacologica in atto</mat-label>
              <mat-chip-grid #farmChipGrid>
                @for (farmaco of terapiaFarmacologicaArray; track farmaco) {
                  <mat-chip-row (removed)="removeChip('terapiaFarmacologica', farmaco)">
                    {{ farmaco }}
                    <button matChipRemove><mat-icon>cancel</mat-icon></button>
                  </mat-chip-row>
                }
              </mat-chip-grid>
              <input
                placeholder="Es: Ramipril 5mg, Cardioaspirina..."
                [matChipInputFor]="farmChipGrid"
                [matChipInputSeparatorKeyCodes]="separatorKeyCodes"
                (matChipInputTokenEnd)="addChip('terapiaFarmacologica', $event)">
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Note anamnesi remota</mat-label>
              <textarea matInput formControlName="note" rows="2"
                placeholder="Note generali sull'anamnesi remota del paziente..."></textarea>
            </mat-form-field>
          </div>
        </mat-expansion-panel>

        <!-- ================================================================ -->
        <!-- SEZIONE 6: ESAME OBIETTIVO -->
        <!-- ================================================================ -->
        <mat-expansion-panel expanded>
          <mat-expansion-panel-header>
            <mat-panel-title>
              <mat-icon>biotech</mat-icon>
              6. Esame Obiettivo
            </mat-panel-title>
          </mat-expansion-panel-header>

          <div class="section-content" formGroupName="objectiveExam">
            <div class="form-row two-cols">
              <mat-form-field appearance="outline">
                <mat-label>Osservazione</mat-label>
                <textarea matInput formControlName="osservazione" rows="2"
                  placeholder="Es: Iperlordosi lombare, spalle anteposte..."></textarea>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Palpazione</mat-label>
                <textarea matInput formControlName="palpazione" rows="2"
                  placeholder="Es: Contrattura paravertebrale bilaterale L3-L5..."></textarea>
              </mat-form-field>
            </div>

            <div class="form-row two-cols">
              <mat-form-field appearance="outline">
                <mat-label>Valutazione movimento passivo</mat-label>
                <textarea matInput formControlName="movimentoPassivo" rows="2"
                  placeholder="Es: Limitazione flessione lombare..."></textarea>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Valutazione movimento attivo</mat-label>
                <textarea matInput formControlName="movimentoAttivo" rows="2"
                  placeholder="Es: ROM ridotto in flessione ed estensione..."></textarea>
              </mat-form-field>
            </div>

            <div class="form-row three-cols">
              <mat-form-field appearance="outline">
                <mat-label>Forza muscolare</mat-label>
                <input matInput formControlName="forzaMuscolare"
                  placeholder="Es: Deficit gluteo medio sx">
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Equilibrio</mat-label>
                <input matInput formControlName="equilibrio"
                  placeholder="Es: Romberg negativo">
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Esame neurologico</mat-label>
                <input matInput formControlName="esameNeurologico"
                  placeholder="Es: ROT normoelicitabili">
              </mat-form-field>
            </div>

            <!-- Test Specifici -->
            <div class="subsection">
              <div class="subsection-header">
                <h4>Test Specifici</h4>
                <button mat-stroked-button type="button" (click)="addTestSpecifico('objectiveExam')">
                  <mat-icon>add</mat-icon> Aggiungi Test
                </button>
              </div>

              @for (test of objectiveExamTestsArray.controls; track $index; let i = $index) {
                <div class="test-row" [formGroupName]="'testSpecifici'">
                  <div [formGroupName]="i" class="test-fields">
                    <mat-form-field appearance="outline">
                      <mat-label>Nome test</mat-label>
                      <input matInput formControlName="nome" placeholder="Es: Lasègue">
                    </mat-form-field>
                    <mat-form-field appearance="outline">
                      <mat-label>Risultato</mat-label>
                      <input matInput formControlName="risultato" placeholder="Es: Negativo bilateralmente">
                    </mat-form-field>
                    <button mat-icon-button color="warn" type="button" (click)="removeTestSpecifico('objectiveExam', i)">
                      <mat-icon>delete</mat-icon>
                    </button>
                  </div>
                </div>
              }
            </div>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Limitazioni attività</mat-label>
              <textarea matInput formControlName="limitazioniAttivita" rows="2"
                placeholder="Es: Difficoltà nel sollevare pesi, stare seduto a lungo..."></textarea>
            </mat-form-field>

            <div class="form-row two-cols">
              <mat-form-field appearance="outline">
                <mat-label>Fattori prognostici positivi</mat-label>
                <textarea matInput formControlName="fattoriPrognosticiPositivi" rows="2"
                  placeholder="Es: Paziente motivato, buona compliance..."></textarea>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Fattori prognostici negativi</mat-label>
                <textarea matInput formControlName="fattoriPrognosticiNegativi" rows="2"
                  placeholder="Es: Lavoro sedentario, sovrappeso..."></textarea>
              </mat-form-field>
            </div>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Strategie di coping</mat-label>
              <textarea matInput formControlName="strategieCoping" rows="2"
                placeholder="Es: Come il paziente affronta il problema..."></textarea>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Diagnosi Fisioterapica</mat-label>
              <textarea matInput formControlName="diagnosiFisioterapica" rows="3"
                placeholder="Es: Lombalgia meccanica aspecifica con componente muscolare..."></textarea>
            </mat-form-field>
          </div>
        </mat-expansion-panel>

        <!-- ================================================================ -->
        <!-- SEZIONE 7: PIANIFICAZIONE TRATTAMENTO -->
        <!-- ================================================================ -->
        <mat-expansion-panel expanded>
          <mat-expansion-panel-header>
            <mat-panel-title>
              <mat-icon>event_note</mat-icon>
              7. Pianificazione Trattamento
            </mat-panel-title>
          </mat-expansion-panel-header>

          <div class="section-content" formGroupName="treatmentPlan">
            <!-- Obiettivi Breve Termine -->
            <div class="objectives-section">
              <div class="subsection-header">
                <h4>Obiettivi a breve termine</h4>
                <button mat-stroked-button type="button" (click)="addObiettivo('obiettiviBreveTermine')">
                  <mat-icon>add</mat-icon> Aggiungi
                </button>
              </div>
              @for (obj of obiettiviBreveTermineArray.controls; track $index; let i = $index) {
                <div class="objective-row" formArrayName="obiettiviBreveTermine">
                  <div [formGroupName]="i" class="objective-fields">
                    <mat-form-field appearance="outline" class="flex-grow">
                      <mat-label>Descrizione obiettivo</mat-label>
                      <input matInput formControlName="descrizione" placeholder="Es: Riduzione dolore VAS < 4">
                    </mat-form-field>
                    <button mat-icon-button color="warn" type="button" (click)="removeObiettivo('obiettiviBreveTermine', i)">
                      <mat-icon>delete</mat-icon>
                    </button>
                  </div>
                </div>
              }
            </div>

            <!-- Obiettivi Medio Termine -->
            <div class="objectives-section">
              <div class="subsection-header">
                <h4>Obiettivi a medio termine</h4>
                <button mat-stroked-button type="button" (click)="addObiettivo('obiettiviMedioTermine')">
                  <mat-icon>add</mat-icon> Aggiungi
                </button>
              </div>
              @for (obj of obiettiviMedioTermineArray.controls; track $index; let i = $index) {
                <div class="objective-row" formArrayName="obiettiviMedioTermine">
                  <div [formGroupName]="i" class="objective-fields">
                    <mat-form-field appearance="outline" class="flex-grow">
                      <mat-label>Descrizione obiettivo</mat-label>
                      <input matInput formControlName="descrizione" placeholder="Es: Ripresa attività lavorativa">
                    </mat-form-field>
                    <button mat-icon-button color="warn" type="button" (click)="removeObiettivo('obiettiviMedioTermine', i)">
                      <mat-icon>delete</mat-icon>
                    </button>
                  </div>
                </div>
              }
            </div>

            <!-- Obiettivi Lungo Termine -->
            <div class="objectives-section">
              <div class="subsection-header">
                <h4>Obiettivi a lungo termine</h4>
                <button mat-stroked-button type="button" (click)="addObiettivo('obiettiviLungoTermine')">
                  <mat-icon>add</mat-icon> Aggiungi
                </button>
              </div>
              @for (obj of obiettiviLungoTermineArray.controls; track $index; let i = $index) {
                <div class="objective-row" formArrayName="obiettiviLungoTermine">
                  <div [formGroupName]="i" class="objective-fields">
                    <mat-form-field appearance="outline" class="flex-grow">
                      <mat-label>Descrizione obiettivo</mat-label>
                      <input matInput formControlName="descrizione" placeholder="Es: Prevenzione recidive">
                    </mat-form-field>
                    <button mat-icon-button color="warn" type="button" (click)="removeObiettivo('obiettiviLungoTermine', i)">
                      <mat-icon>delete</mat-icon>
                    </button>
                  </div>
                </div>
              }
            </div>

            <mat-divider></mat-divider>

            <mat-form-field appearance="outline" class="chip-field full-width">
              <mat-label>Interventi terapeutici proposti</mat-label>
              <mat-chip-grid #interventiChipGrid>
                @for (intervento of interventiPropostiArray; track intervento) {
                  <mat-chip-row (removed)="removeChip('interventiProposti', intervento)">
                    {{ intervento }}
                    <button matChipRemove><mat-icon>cancel</mat-icon></button>
                  </mat-chip-row>
                }
              </mat-chip-grid>
              <input
                placeholder="Es: Terapia manuale, Esercizio terapeutico..."
                [matChipInputFor]="interventiChipGrid"
                [matChipInputSeparatorKeyCodes]="separatorKeyCodes"
                (matChipInputTokenEnd)="addChip('interventiProposti', $event)">
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Frequenza delle sedute</mat-label>
              <input matInput formControlName="frequenzaSedute" placeholder="Es: 2 volte/settimana">
            </mat-form-field>
          </div>
        </mat-expansion-panel>

        <!-- ================================================================ -->
        <!-- SEZIONE 8: MONITORAGGIO E RIVALUTAZIONE -->
        <!-- ================================================================ -->
        <mat-expansion-panel expanded>
          <mat-expansion-panel-header>
            <mat-panel-title>
              <mat-icon>trending_up</mat-icon>
              8. Monitoraggio e Rivalutazione
            </mat-panel-title>
          </mat-expansion-panel-header>

          <div class="section-content" formGroupName="monitoring">
            <!-- Test Specifici Monitoraggio -->
            <div class="subsection">
              <div class="subsection-header">
                <h4>Test Specifici</h4>
                <button mat-stroked-button type="button" (click)="addTestSpecifico('monitoring')">
                  <mat-icon>add</mat-icon> Aggiungi Test
                </button>
              </div>

              @for (test of monitoringTestsArray.controls; track $index; let i = $index) {
                <div class="test-row" formArrayName="testSpecifici">
                  <div [formGroupName]="i" class="test-fields">
                    <mat-form-field appearance="outline">
                      <mat-label>Nome test</mat-label>
                      <input matInput formControlName="nome" placeholder="Es: Oswestry Disability Index">
                    </mat-form-field>
                    <mat-form-field appearance="outline">
                      <mat-label>Risultato</mat-label>
                      <input matInput formControlName="risultato" placeholder="Es: 32%">
                    </mat-form-field>
                    <mat-form-field appearance="outline">
                      <mat-label>Data</mat-label>
                      <input matInput [matDatepicker]="testDatePicker" formControlName="data">
                      <mat-datepicker-toggle matSuffix [for]="testDatePicker"></mat-datepicker-toggle>
                      <mat-datepicker #testDatePicker></mat-datepicker>
                    </mat-form-field>
                    <button mat-icon-button color="warn" type="button" (click)="removeTestSpecifico('monitoring', i)">
                      <mat-icon>delete</mat-icon>
                    </button>
                  </div>
                </div>
              }
            </div>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Outcome</mat-label>
              <textarea matInput formControlName="outcome" rows="2"
                placeholder="Es: Da valutare dopo 8 sedute..."></textarea>
            </mat-form-field>

            <mat-form-field appearance="outline" class="chip-field full-width">
              <mat-label>Criticità</mat-label>
              <mat-chip-grid #criticitaChipGrid>
                @for (criticita of criticitaArray; track criticita) {
                  <mat-chip-row color="warn" (removed)="removeChip('criticita', criticita)">
                    {{ criticita }}
                    <button matChipRemove><mat-icon>cancel</mat-icon></button>
                  </mat-chip-row>
                }
              </mat-chip-grid>
              <input
                placeholder="Es: Compliance esercizi, stress lavorativo..."
                [matChipInputFor]="criticitaChipGrid"
                [matChipInputSeparatorKeyCodes]="separatorKeyCodes"
                (matChipInputTokenEnd)="addChip('criticita', $event)">
            </mat-form-field>
          </div>
        </mat-expansion-panel>
      </mat-accordion>
    </form>
  `,
  styles: [`
    :host {
      display: block;
    }

    .anamnesis-form {
      mat-accordion {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      mat-expansion-panel {
        border-radius: 12px !important;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08) !important;

        ::ng-deep .mat-expansion-panel-header-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 500;

          mat-icon {
            color: #667eea;
          }
        }
      }
    }

    .section-content {
      padding: 8px 0;
    }

    .form-row {
      display: flex;
      gap: 16px;
      margin-bottom: 8px;

      &.two-cols > * {
        flex: 1;
      }

      &.three-cols > * {
        flex: 1;
      }
    }

    mat-form-field {
      &.full-width {
        width: 100%;
      }

      &.chip-field {
        width: 100%;
      }

      &.flex-grow {
        flex: 1;
      }
    }

    .subsection {
      margin: 16px 0;
      padding: 16px;
      background: #f8fafc;
      border-radius: 8px;
    }

    .subsection-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;

      h4 {
        margin: 0;
        font-size: 0.875rem;
        font-weight: 600;
        color: #334155;
      }
    }

    .test-row, .exam-row, .objective-row {
      margin-bottom: 8px;
    }

    .test-fields, .exam-fields, .objective-fields {
      display: flex;
      gap: 12px;
      align-items: flex-start;

      mat-form-field {
        flex: 1;
      }
    }

    .objectives-section {
      margin-bottom: 24px;
    }

    .empty-message {
      text-align: center;
      color: #64748b;
      font-style: italic;
      padding: 16px;
    }

    mat-divider {
      margin: 24px 0;
    }

    /* Responsive */
    @media (max-width: 767px) {
      .form-row {
        flex-direction: column;
        gap: 0;

        &.two-cols > *,
        &.three-cols > * {
          flex: none;
          width: 100%;
        }
      }

      .test-fields, .exam-fields, .objective-fields {
        flex-wrap: wrap;

        mat-form-field {
          min-width: 100%;
        }

        button {
          margin-left: auto;
        }
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AnamnesisFormComponent implements OnInit, OnChanges {
  @Input() anamnesis: AnamnesisComplete | null = null;
  @Input() patient: Patient | null = null;
  @Input() pathId: string = '';
  /**
   * Anamnesi remota già esistente del paziente: usata per pre-compilare la
   * sezione "Anamnesi Patologica Remota" (e il suo campo note) quando si apre
   * il modulo unificato. Indipendente dalla valutazione.
   */
  @Input() patientAnamnesis: PatientAnamnesis | null = null;

  @Output() formChange = new EventEmitter<AnamnesisComplete>();
  @Output() save = new EventEmitter<AnamnesisComplete>();
  @Output() cancel = new EventEmitter<void>();

  form!: FormGroup;
  bodyMapMarkers: BodyMapMarker[] = [];
  readonly separatorKeyCodes = [ENTER, COMMA] as const;

  // Chip arrays - gestiti separatamente per performance
  sportPraticatiArray: string[] = [];
  terapiaFarmacologicaArray: string[] = [];
  fattoriAlleviantiArray: string[] = [];
  fattoriAggravantiArray: string[] = [];
  interventiPropostiArray: string[] = [];
  criticitaArray: string[] = [];

  constructor(
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.patchPatientData();
    // Patch anamnesis data if already available (edit mode)
    // This is necessary because ngOnChanges is called BEFORE ngOnInit
    // and the form is not yet initialized when ngOnChanges runs the first time
    if (this.anamnesis) {
      this.patchFormData();
    }
    // Pre-compila la sezione anamnesi remota dal dato paziente esistente
    // (anche in create-with-path, dove non c'è una valutazione precedente).
    this.patchRemoteAnamnesis();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['anamnesis'] && this.form && this.anamnesis) {
      this.patchFormData();
    }
    if (changes['patient'] && this.form && this.patient) {
      this.patchPatientData();
    }
    if (changes['patientAnamnesis'] && this.form) {
      this.patchRemoteAnamnesis();
    }
  }

  /**
   * Pre-compila la sezione "Anamnesi Patologica Remota" (e il campo note) con
   * i dati dell'anamnesi del paziente, se presenti. Non sovrascrive valori già
   * inseriti dall'operatore nel form (es. dopo un patchFormData in edit).
   */
  private patchRemoteAnamnesis(): void {
    if (!this.form || !this.patientAnamnesis) return;
    const remoteHistory = this.form.get('remoteHistory');
    if (!remoteHistory) return;

    remoteHistory.patchValue({
      patologiePregresse: this.patientAnamnesis.patologiePregresse,
      interventiChirurgici: this.patientAnamnesis.interventiChirurgici,
      traumi: this.patientAnamnesis.traumi,
      note: this.patientAnamnesis.note
    });
    this.terapiaFarmacologicaArray = [...(this.patientAnamnesis.terapiaFarmacologica || [])];
    this.cdr.markForCheck();
  }

  private initForm(): void {
    this.form = this.fb.group({
      // Dati percorso terapeutico (modulo unificato): nome obbligatorio
      pathInfo: this.fb.group({
        nome: ['', Validators.required],
        diagnosi: [null],
        note: [null]
      }),
      generalInfo: this.fb.group({
        nome: [''],
        cognome: [''],
        eta: [null],
        sesso: [null],
        professione: [null],
        sportPraticati: [[]],
        bmi: [null]
      }),
      remoteHistory: this.fb.group({
        patologiePregresse: [null],
        interventiChirurgici: [null],
        traumi: [null],
        terapiaFarmacologica: [[]],
        note: [null]
      }),
      recentHistory: this.fb.group({
        motivoConsulto: [null],
        esordioSintomi: [null],
        statoAttualeSintomi: [null],
        fattoriAllevianti: [[]],
        fattoriAggravanti: [[]],
        andamentoDolore: [null]
      }),
      objectiveExam: this.fb.group({
        osservazione: [null],
        palpazione: [null],
        movimentoPassivo: [null],
        movimentoAttivo: [null],
        forzaMuscolare: [null],
        equilibrio: [null],
        testSpecifici: this.fb.array([]),
        esameNeurologico: [null],
        limitazioniAttivita: [null],
        fattoriPrognosticiPositivi: [null],
        fattoriPrognosticiNegativi: [null],
        strategieCoping: [null],
        diagnosiFisioterapica: [null]
      }),
      diagnosticExams: this.fb.array([]),
      treatmentPlan: this.fb.group({
        obiettiviBreveTermine: this.fb.array([]),
        obiettiviMedioTermine: this.fb.array([]),
        obiettiviLungoTermine: this.fb.array([]),
        interventiProposti: [[]],
        frequenzaSedute: [null]
      }),
      monitoring: this.fb.group({
        testSpecifici: this.fb.array([]),
        outcome: [null],
        criticita: [[]]
      })
    });
  }

  private patchPatientData(): void {
    if (!this.patient || !this.form) return;

    const generalInfo = this.form.get('generalInfo');
    if (generalInfo) {
      generalInfo.patchValue({
        nome: this.patient.nome || '',
        cognome: this.patient.cognome || '',
        eta: this.patient.eta || null,
        sesso: this.patient.genere || null
      });
    }
    this.cdr.markForCheck();
  }

  private patchFormData(): void {
    if (!this.anamnesis || !this.form) return;

    // Patch dati percorso terapeutico (modulo unificato)
    const pathInfo = this.form.get('pathInfo');
    if (pathInfo && this.anamnesis.pathInfo) {
      pathInfo.patchValue(this.anamnesis.pathInfo);
    }

    // Patch general info (keeping patient auto-filled data)
    const generalInfo = this.form.get('generalInfo');
    if (generalInfo && this.anamnesis.generalInfo) {
      generalInfo.patchValue({
        professione: this.anamnesis.generalInfo.professione,
        bmi: this.anamnesis.generalInfo.bmi
      });
      this.sportPraticatiArray = [...(this.anamnesis.generalInfo.sportPraticati || [])];
    }

    // Body map
    this.bodyMapMarkers = [...(this.anamnesis.bodyMap?.markers || [])];

    // NB: l'anamnesi remota NON viene più patchata da qui: la sua fonte è
    // patientAnamnesis (tabella PatientAnamnesis), gestita da
    // patchRemoteAnamnesis(). Vedi modulo unificato.

    // Recent history
    const recentHistory = this.form.get('recentHistory');
    if (recentHistory && this.anamnesis.recentHistory) {
      recentHistory.patchValue(this.anamnesis.recentHistory);
      this.fattoriAlleviantiArray = [...(this.anamnesis.recentHistory.fattoriAllevianti || [])];
      this.fattoriAggravantiArray = [...(this.anamnesis.recentHistory.fattoriAggravanti || [])];
    }

    // Objective exam
    const objectiveExam = this.form.get('objectiveExam');
    if (objectiveExam && this.anamnesis.objectiveExam) {
      objectiveExam.patchValue(this.anamnesis.objectiveExam);
      // Patch test specifici
      this.clearFormArray(this.objectiveExamTestsArray);
      this.anamnesis.objectiveExam.testSpecifici?.forEach(test => {
        this.objectiveExamTestsArray.push(this.createTestSpecificoGroup(test));
      });
    }

    // Diagnostic exams
    this.clearFormArray(this.diagnosticExamsArray);
    this.anamnesis.diagnosticExams?.forEach(exam => {
      this.diagnosticExamsArray.push(this.createDiagnosticExamGroup(exam));
    });

    // Treatment plan
    const treatmentPlan = this.form.get('treatmentPlan');
    if (treatmentPlan && this.anamnesis.treatmentPlan) {
      treatmentPlan.patchValue({
        frequenzaSedute: this.anamnesis.treatmentPlan.frequenzaSedute
      });
      this.interventiPropostiArray = [...(this.anamnesis.treatmentPlan.interventiProposti || [])];

      // Objectives
      this.clearFormArray(this.obiettiviBreveTermineArray);
      this.anamnesis.treatmentPlan.obiettiviBreveTermine?.forEach(obj => {
        this.obiettiviBreveTermineArray.push(this.createObiettivoGroup(obj));
      });

      this.clearFormArray(this.obiettiviMedioTermineArray);
      this.anamnesis.treatmentPlan.obiettiviMedioTermine?.forEach(obj => {
        this.obiettiviMedioTermineArray.push(this.createObiettivoGroup(obj));
      });

      this.clearFormArray(this.obiettiviLungoTermineArray);
      this.anamnesis.treatmentPlan.obiettiviLungoTermine?.forEach(obj => {
        this.obiettiviLungoTermineArray.push(this.createObiettivoGroup(obj));
      });
    }

    // Monitoring
    const monitoring = this.form.get('monitoring');
    if (monitoring && this.anamnesis.monitoring) {
      monitoring.patchValue({
        outcome: this.anamnesis.monitoring.outcome
      });
      this.criticitaArray = [...(this.anamnesis.monitoring.criticita || [])];

      this.clearFormArray(this.monitoringTestsArray);
      this.anamnesis.monitoring.testSpecifici?.forEach(test => {
        this.monitoringTestsArray.push(this.createTestSpecificoGroup(test));
      });
    }

    this.cdr.markForCheck();
  }

  // ============================================================
  // FORM ARRAYS GETTERS
  // ============================================================

  get objectiveExamTestsArray(): FormArray {
    return this.form.get('objectiveExam.testSpecifici') as FormArray;
  }

  get diagnosticExamsArray(): FormArray {
    return this.form.get('diagnosticExams') as FormArray;
  }

  get obiettiviBreveTermineArray(): FormArray {
    return this.form.get('treatmentPlan.obiettiviBreveTermine') as FormArray;
  }

  get obiettiviMedioTermineArray(): FormArray {
    return this.form.get('treatmentPlan.obiettiviMedioTermine') as FormArray;
  }

  get obiettiviLungoTermineArray(): FormArray {
    return this.form.get('treatmentPlan.obiettiviLungoTermine') as FormArray;
  }

  get monitoringTestsArray(): FormArray {
    return this.form.get('monitoring.testSpecifici') as FormArray;
  }

  // ============================================================
  // CHIP INPUT HANDLERS
  // ============================================================

  addChip(field: string, event: MatChipInputEvent): void {
    const value = (event.value || '').trim();
    if (!value) return;

    switch (field) {
      case 'sportPraticati':
        this.sportPraticatiArray.push(value);
        break;
      case 'terapiaFarmacologica':
        this.terapiaFarmacologicaArray.push(value);
        break;
      case 'fattoriAllevianti':
        this.fattoriAlleviantiArray.push(value);
        break;
      case 'fattoriAggravanti':
        this.fattoriAggravantiArray.push(value);
        break;
      case 'interventiProposti':
        this.interventiPropostiArray.push(value);
        break;
      case 'criticita':
        this.criticitaArray.push(value);
        break;
    }

    event.chipInput!.clear();
    this.cdr.markForCheck();
  }

  removeChip(field: string, value: string): void {
    switch (field) {
      case 'sportPraticati':
        this.sportPraticatiArray = this.sportPraticatiArray.filter(v => v !== value);
        break;
      case 'terapiaFarmacologica':
        this.terapiaFarmacologicaArray = this.terapiaFarmacologicaArray.filter(v => v !== value);
        break;
      case 'fattoriAllevianti':
        this.fattoriAlleviantiArray = this.fattoriAlleviantiArray.filter(v => v !== value);
        break;
      case 'fattoriAggravanti':
        this.fattoriAggravantiArray = this.fattoriAggravantiArray.filter(v => v !== value);
        break;
      case 'interventiProposti':
        this.interventiPropostiArray = this.interventiPropostiArray.filter(v => v !== value);
        break;
      case 'criticita':
        this.criticitaArray = this.criticitaArray.filter(v => v !== value);
        break;
    }
    this.cdr.markForCheck();
  }

  // ============================================================
  // BODY MAP HANDLER
  // ============================================================

  onBodyMapChange(markers: BodyMapMarker[]): void {
    this.bodyMapMarkers = markers;
    this.cdr.markForCheck();
  }

  // ============================================================
  // FORM ARRAY HELPERS
  // ============================================================

  private createTestSpecificoGroup(test?: TestSpecifico): FormGroup {
    return this.fb.group({
      id: [test?.id || generateId()],
      nome: [test?.nome || ''],
      risultato: [test?.risultato || null],
      data: [test?.data || null],
      superato: [test?.superato ?? null]
    });
  }

  private createDiagnosticExamGroup(exam?: DiagnosticExam): FormGroup {
    return this.fb.group({
      id: [exam?.id || generateId()],
      nomeEsame: [exam?.nomeEsame || ''],
      data: [exam?.data || null],
      note: [exam?.note || null]
    });
  }

  private createObiettivoGroup(obj?: Obiettivo): FormGroup {
    return this.fb.group({
      id: [obj?.id || generateId()],
      descrizione: [obj?.descrizione || ''],
      raggiunto: [obj?.raggiunto ?? false],
      dataRaggiungimento: [obj?.dataRaggiungimento || null]
    });
  }

  private clearFormArray(formArray: FormArray): void {
    while (formArray.length !== 0) {
      formArray.removeAt(0);
    }
  }

  addTestSpecifico(section: 'objectiveExam' | 'monitoring'): void {
    const array = section === 'objectiveExam'
      ? this.objectiveExamTestsArray
      : this.monitoringTestsArray;
    array.push(this.createTestSpecificoGroup());
    this.cdr.markForCheck();
  }

  removeTestSpecifico(section: 'objectiveExam' | 'monitoring', index: number): void {
    const array = section === 'objectiveExam'
      ? this.objectiveExamTestsArray
      : this.monitoringTestsArray;
    array.removeAt(index);
    this.cdr.markForCheck();
  }

  addDiagnosticExam(): void {
    this.diagnosticExamsArray.push(this.createDiagnosticExamGroup());
    this.cdr.markForCheck();
  }

  removeDiagnosticExam(index: number): void {
    this.diagnosticExamsArray.removeAt(index);
    this.cdr.markForCheck();
  }

  addObiettivo(type: 'obiettiviBreveTermine' | 'obiettiviMedioTermine' | 'obiettiviLungoTermine'): void {
    let array: FormArray;
    switch (type) {
      case 'obiettiviBreveTermine':
        array = this.obiettiviBreveTermineArray;
        break;
      case 'obiettiviMedioTermine':
        array = this.obiettiviMedioTermineArray;
        break;
      case 'obiettiviLungoTermine':
        array = this.obiettiviLungoTermineArray;
        break;
    }
    array.push(this.createObiettivoGroup());
    this.cdr.markForCheck();
  }

  removeObiettivo(type: 'obiettiviBreveTermine' | 'obiettiviMedioTermine' | 'obiettiviLungoTermine', index: number): void {
    let array: FormArray;
    switch (type) {
      case 'obiettiviBreveTermine':
        array = this.obiettiviBreveTermineArray;
        break;
      case 'obiettiviMedioTermine':
        array = this.obiettiviMedioTermineArray;
        break;
      case 'obiettiviLungoTermine':
        array = this.obiettiviLungoTermineArray;
        break;
    }
    array.removeAt(index);
    this.cdr.markForCheck();
  }

  // ============================================================
  // PUBLIC METHODS
  // ============================================================

  /**
   * Restituisce i dati del form come AnamnesisComplete
   */
  getFormValue(): AnamnesisComplete {
    const formValue = this.form.getRawValue();

    return {
      id: this.anamnesis?.id || generateId(),
      pathId: this.pathId,
      pathInfo: formValue.pathInfo,
      generalInfo: {
        ...formValue.generalInfo,
        sportPraticati: this.sportPraticatiArray
      },
      bodyMap: {
        markers: this.bodyMapMarkers
      },
      remoteHistory: {
        ...formValue.remoteHistory,
        terapiaFarmacologica: this.terapiaFarmacologicaArray
      },
      recentHistory: {
        ...formValue.recentHistory,
        fattoriAllevianti: this.fattoriAlleviantiArray,
        fattoriAggravanti: this.fattoriAggravantiArray
      },
      objectiveExam: formValue.objectiveExam,
      diagnosticExams: formValue.diagnosticExams,
      treatmentPlan: {
        ...formValue.treatmentPlan,
        interventiProposti: this.interventiPropostiArray
      },
      monitoring: {
        ...formValue.monitoring,
        criticita: this.criticitaArray
      },
      createdAt: this.anamnesis?.createdAt || new Date(),
      updatedAt: new Date(),
      createdBy: this.anamnesis?.createdBy || ''
    };
  }

  /**
   * Verifica se il form è valido
   */
  isValid(): boolean {
    return this.form.valid;
  }

  /**
   * Emette l'evento di salvataggio
   */
  onSave(): void {
    this.save.emit(this.getFormValue());
  }

  /**
   * Emette l'evento di annullamento
   */
  onCancel(): void {
    this.cancel.emit();
  }
}
