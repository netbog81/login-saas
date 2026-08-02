import { Component, OnInit, OnDestroy, inject, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { Subject, takeUntil } from 'rxjs';

import { AbsenceManagementService } from '../services/absence-management.service';
import {
  AbsenceImpactPreview,
  AvailabilityImpactPreview,
  ScheduleChangeImpactPreview,
  ScheduleWindow,
} from '../models/absence.model';
import { OperatorAbsenceTypeService } from '../../operator-absence-types/services/operator-absence-type.service';
import { OperatorAbsenceType } from '../../operator-absence-types/models/operator-absence-type.model';
import { OperatorService } from '../../../../services/operator.service';
import { Operator, OperatorMacroCategory } from '../../../../graphql/generated/types';

export type ExceptionMode = 'absence' | 'availability' | 'schedule';

/** Esito restituito al chiamante, per lo snackbar riepilogativo. */
export interface ExceptionDialogResult {
  mode: ExceptionMode;
  createdCount: number;
  conflictCount: number;
  skippedCount: number;
  removedAvailabilityCount: number;
}

/**
 * Dialog unico per le tre modifiche all'orario di un operatore.
 *
 *   ASSENZA        toglie ore    (giornata intera o fascia)
 *   DISPONIBILITÀ  aggiunge ore  (si somma all'orario abituale)
 *   CAMBIO ORARIO  sostituisce   (il nuovo orario È l'orario del giorno)
 *
 * Le tre condividono lo stesso scheletro — operatori, periodo, giorni della
 * settimana, motivo — e differiscono solo per come si leggono gli orari e
 * per cosa mostra la verifica. Tenerle in un dialog solo evita tre form
 * quasi identici che divergono alla prima modifica, ed evita di far
 * indovinare la differenza dal nome di un pulsante.
 *
 * La verifica è obbligatoria prima di salvare: è l'unico punto in cui si
 * vedono i giorni scartati, il motivo, e gli appuntamenti impattati.
 */
@Component({
  selector: 'app-exception-dialog-container',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatSlideToggleModule,
    MatIconModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    DragDropModule,
  ],
  template: `
    <div class="dialog-wrapper" cdkDrag cdkDragRootElement=".cdk-overlay-pane">
      <div class="dialog-header" [ngClass]="'mode-' + mode" cdkDragHandle>
        <div class="header-title">
          <mat-icon>{{ modeIcon() }}</mat-icon>
          <span>Nuova voce &mdash; {{ modeLabel() }}</span>
        </div>
        <button mat-icon-button (click)="onCancel()" aria-label="Chiudi">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="dialog-body">
        <!-- Modalità -->
        <mat-button-toggle-group
          [(ngModel)]="mode"
          (change)="onModeChanged()"
          class="mode-group"
        >
          <mat-button-toggle value="absence">
            <mat-icon>event_busy</mat-icon> Assenza
          </mat-button-toggle>
          <mat-button-toggle value="availability">
            <mat-icon>event_available</mat-icon> Disponibilità in più
          </mat-button-toggle>
          <mat-button-toggle value="schedule">
            <mat-icon>schedule</mat-icon> Cambio orario
          </mat-button-toggle>
        </mat-button-toggle-group>

        <p class="mode-explain" [ngClass]="'mode-' + mode">
          <mat-icon>info</mat-icon>
          <span [ngSwitch]="mode">
            <ng-container *ngSwitchCase="'absence'">
              <strong>Toglie</strong> ore: nella fascia indicata l'operatore non lavora.
            </ng-container>
            <ng-container *ngSwitchCase="'availability'">
              <strong>Aggiunge</strong> ore all'orario abituale, senza toccarlo.
            </ng-container>
            <ng-container *ngSwitchCase="'schedule'">
              <strong>Sostituisce</strong> l'orario del giorno: quel giorno l'operatore
              fa esattamente le fasce indicate qui sotto, e nient'altro.
            </ng-container>
          </span>
        </p>

        <!-- Operatori -->
        <div class="operators-block">
          <div class="operators-header">
            <h3>Operatori</h3>
            <mat-checkbox [checked]="allSelected()" (change)="toggleAll($event.checked)">
              Tutti
            </mat-checkbox>
          </div>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Seleziona uno o più operatori</mat-label>
            <mat-select multiple [(ngModel)]="selectedOperatorIds" (selectionChange)="onFormChanged()">
              <mat-option *ngFor="let op of operators" [value]="op.id">
                {{ op.name }} {{ op.surname }}
                <span class="cat-hint">({{ categoryLabel(op.macroCategory) }})</span>
              </mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <!-- Periodo -->
        <div class="form-row">
          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>Dal giorno</mat-label>
            <input
              matInput
              [matDatepicker]="pickerFrom"
              [(ngModel)]="dateFrom"
              (ngModelChange)="onDateFromChanged()"
            />
            <mat-datepicker-toggle matSuffix [for]="pickerFrom"></mat-datepicker-toggle>
            <mat-datepicker #pickerFrom></mat-datepicker>
          </mat-form-field>
          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>Al giorno</mat-label>
            <input
              matInput
              [matDatepicker]="pickerTo"
              [(ngModel)]="dateTo"
              (ngModelChange)="onFormChanged()"
            />
            <mat-datepicker-toggle matSuffix [for]="pickerTo"></mat-datepicker-toggle>
            <mat-datepicker #pickerTo></mat-datepicker>
          </mat-form-field>
        </div>
        <p class="mode-hint single-day-hint" *ngIf="isSingleDay()">
          Giorno singolo: {{ formatJsDate(dateFrom) }}. Per un periodo, sposta "Al giorno".
        </p>

        <!-- Giorni della settimana -->
        <div class="weekdays-block">
          <div class="weekdays-header">
            <span>Solo in questi giorni</span>
            <button mat-button color="primary" type="button" (click)="clearWeekdays()">
              Tutti i giorni
            </button>
          </div>
          <mat-button-toggle-group
            multiple
            [(ngModel)]="weekdays"
            (change)="onFormChanged()"
            class="weekdays-group"
          >
            <mat-button-toggle *ngFor="let d of weekdayOptions" [value]="d.value">
              {{ d.label }}
            </mat-button-toggle>
          </mat-button-toggle-group>
          <p class="mode-hint">Nessuna selezione = tutti i giorni del periodo.</p>
        </div>

        <!-- ASSENZA: tipo + giornata intera -->
        <ng-container *ngIf="mode === 'absence'">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Tipo di assenza</mat-label>
            <mat-select [(ngModel)]="absenceTypeId">
              <mat-option [value]="null">— Nessuno —</mat-option>
              <mat-option *ngFor="let t of absenceTypes" [value]="t.id">{{ t.name }}</mat-option>
            </mat-select>
          </mat-form-field>

          <div class="toggle-block">
            <mat-slide-toggle [(ngModel)]="wholeDay" (change)="onFormChanged()">
              Giornata intera
            </mat-slide-toggle>
            <p class="mode-hint">
              Disattiva per indicare una fascia (es. assente dalle 15:00).
            </p>
          </div>
        </ng-container>

        <!-- ASSENZA a fascia / DISPONIBILITÀ: una sola fascia -->
        <div class="form-row" *ngIf="usesSingleWindow()">
          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>Dalle</mat-label>
            <input matInput type="time" [(ngModel)]="startTime" (ngModelChange)="onFormChanged()" />
          </mat-form-field>
          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>Alle</mat-label>
            <input matInput type="time" [(ngModel)]="endTime" (ngModelChange)="onFormChanged()" />
          </mat-form-field>
        </div>

        <!-- CAMBIO ORARIO: N fasce -->
        <div class="windows-block" *ngIf="mode === 'schedule'">
          <div class="weekdays-header">
            <span>Nuovo orario del giorno</span>
            <button mat-button color="primary" type="button" (click)="addWindow()">
              <mat-icon>add</mat-icon> Aggiungi fascia
            </button>
          </div>
          <div class="window-row" *ngFor="let w of windows; let i = index">
            <mat-form-field appearance="outline" class="flex-1">
              <mat-label>Dalle</mat-label>
              <input matInput type="time" [(ngModel)]="w.startTime" (ngModelChange)="onFormChanged()" />
            </mat-form-field>
            <mat-form-field appearance="outline" class="flex-1">
              <mat-label>Alle</mat-label>
              <input matInput type="time" [(ngModel)]="w.endTime" (ngModelChange)="onFormChanged()" />
            </mat-form-field>
            <button
              mat-icon-button
              color="warn"
              type="button"
              [disabled]="windows.length === 1"
              matTooltip="Rimuovi fascia"
              (click)="removeWindow(i)"
            >
              <mat-icon>delete</mat-icon>
            </button>
          </div>
          <p class="mode-hint">
            Più fasce = turno spezzato (es. 07:00–15:00 e 16:00–20:00). L'orario da
            template per quel giorno viene ignorato.
          </p>
        </div>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Motivo (opzionale)</mat-label>
          <input matInput [(ngModel)]="reason" />
        </mat-form-field>

        <!-- Verifica -->
        <div class="preview-block">
          <div class="preview-header">
            <h3>Verifica</h3>
            <button
              mat-stroked-button
              color="primary"
              [disabled]="!canPreview() || previewLoading"
              (click)="loadPreview()"
            >
              <mat-icon>fact_check</mat-icon>
              Verifica
            </button>
          </div>

          <div *ngIf="previewLoading" class="loading-inline">
            <mat-spinner diameter="20"></mat-spinner>
            Controllo in corso...
          </div>

          <p *ngIf="!hasPreview() && !previewLoading" class="mode-hint">
            Obbligatoria: mostra i giorni non applicabili e gli appuntamenti impattati.
          </p>

          <!-- ASSENZA -->
          <ng-container *ngIf="absencePreview && !previewLoading">
            <p *ngIf="absencePreview.conflicts.length === 0" class="ok-hint">
              <mat-icon>check_circle</mat-icon>
              Nessun appuntamento impattato.
            </p>
            <div *ngIf="absencePreview.conflicts.length > 0" class="impact-list warn-box">
              <p class="impact-title">
                <mat-icon>warning</mat-icon>
                {{ absencePreview.conflicts.length }} appuntament{{
                  absencePreview.conflicts.length === 1 ? 'o' : 'i'
                }} finiranno in conflitto
              </p>
              <div class="impact-row" *ngFor="let apt of absencePreview.conflicts">
                <span class="impact-date">{{ formatDate(apt.appointmentDate) }}</span>
                <span class="impact-time">{{ shortTime(apt.startTime) }}–{{ shortTime(apt.endTime) }}</span>
                <span class="impact-name">{{ apt.clientName }}</span>
              </div>
            </div>
            <div
              *ngIf="absencePreview.attendedWithoutTreatment.length > 0"
              class="impact-list info-box"
            >
              <p class="impact-title">
                <mat-icon>info</mat-icon>
                {{ absencePreview.attendedWithoutTreatment.length }} già PRESENTATO senza
                trattamento aperto — da verificare a mano:
              </p>
              <div class="impact-row" *ngFor="let apt of absencePreview.attendedWithoutTreatment">
                <span class="impact-date">{{ formatDate(apt.appointmentDate) }}</span>
                <span class="impact-time">{{ shortTime(apt.startTime) }}–{{ shortTime(apt.endTime) }}</span>
                <span class="impact-name">{{ apt.clientName }}</span>
              </div>
            </div>
            <div *ngIf="absencePreview.removedAvailabilityCount > 0" class="impact-list warn-box">
              <p class="impact-title">
                <mat-icon>event_available</mat-icon>
                {{ absencePreview.removedAvailabilityCount }} disponibilità straordinari{{
                  absencePreview.removedAvailabilityCount === 1 ? 'a' : 'e'
                }} verrà rimossa: l'assenza ha la precedenza.
              </p>
            </div>
          </ng-container>

          <!-- DISPONIBILITÀ -->
          <ng-container *ngIf="availabilityPreview && !previewLoading">
            <p *ngIf="availabilityPreview.creatableCount > 0" class="ok-hint">
              <mat-icon>check_circle</mat-icon>
              {{ availabilityPreview.creatableCount }} giorn{{
                availabilityPreview.creatableCount === 1 ? 'o' : 'i'
              }} da creare.
            </p>
            <p *ngIf="availabilityPreview.creatableCount === 0" class="impact-list warn-box">
              <mat-icon>block</mat-icon> Nessun giorno disponibile con questi criteri.
            </p>
            <div *ngIf="availabilityPreview.blockers.length > 0" class="impact-list warn-box">
              <p class="impact-title">
                <mat-icon>event_busy</mat-icon>
                {{ availabilityPreview.blockers.length }} giorni scartati: l'operatore non è libero
              </p>
              <div class="impact-row" *ngFor="let b of availabilityPreview.blockers">
                <span class="impact-date">{{ formatDate(b.date) }}</span>
                <span class="impact-name">{{ b.operatorName }}</span>
                <span class="impact-reason">{{ b.reason }}</span>
              </div>
            </div>
            <div *ngIf="availabilityPreview.alreadyCovered.length > 0" class="impact-list info-box">
              <p class="impact-title">
                <mat-icon>info</mat-icon>
                In parte già coperto dall'orario abituale — la disponibilità verrà comunque
                estesa alla fascia indicata
              </p>
              <div class="impact-row" *ngFor="let c of availabilityPreview.alreadyCovered">
                <span class="impact-date">{{ formatDate(c.date) }}</span>
                <span class="impact-name">{{ c.operatorName }}</span>
                <span class="impact-reason">già disponibile {{ c.windows.join(', ') }}</span>
              </div>
            </div>
          </ng-container>

          <!-- CAMBIO ORARIO -->
          <ng-container *ngIf="schedulePreview && !previewLoading">
            <p *ngIf="schedulePreview.creatableCount > 0" class="ok-hint">
              <mat-icon>check_circle</mat-icon>
              {{ schedulePreview.creatableCount }} giorn{{
                schedulePreview.creatableCount === 1 ? 'o' : 'i'
              }} da modificare.
            </p>
            <p *ngIf="schedulePreview.creatableCount === 0" class="impact-list warn-box">
              <mat-icon>block</mat-icon> Nessun giorno modificabile con questi criteri.
            </p>

            <div *ngIf="schedulePreview.days.length > 0" class="impact-list compare-box">
              <p class="impact-title">
                <mat-icon>compare_arrows</mat-icon> Confronto con l'orario abituale
              </p>
              <div class="compare-row" *ngFor="let d of schedulePreview.days">
                <div class="compare-head">
                  <span class="impact-date">{{ formatDate(d.date) }}</span>
                  <span class="impact-name">{{ d.operatorName }}</span>
                </div>
                <div class="compare-line">
                  <span class="compare-label">Attuale</span>
                  <span>{{ d.currentWindows.length ? d.currentWindows.join(', ') : 'non lavora' }}</span>
                </div>
                <div class="compare-line">
                  <span class="compare-label">Nuovo</span>
                  <span>{{ newWindowsLabel() }}</span>
                </div>
                <div class="compare-line lost" *ngIf="d.lostWindows.length > 0">
                  <span class="compare-label">− perde</span>
                  <span>{{ d.lostWindows.join(', ') }}</span>
                </div>
                <div class="compare-line gained" *ngIf="d.gainedWindows.length > 0">
                  <span class="compare-label">+ guadagna</span>
                  <span>{{ d.gainedWindows.join(', ') }}</span>
                </div>
              </div>
            </div>

            <div *ngIf="schedulePreview.blockers.length > 0" class="impact-list warn-box">
              <p class="impact-title">
                <mat-icon>event_busy</mat-icon>
                {{ schedulePreview.blockers.length }} giorni scartati
              </p>
              <div class="impact-row" *ngFor="let b of schedulePreview.blockers">
                <span class="impact-date">{{ formatDate(b.date) }}</span>
                <span class="impact-name">{{ b.operatorName }}</span>
                <span class="impact-reason">{{ b.reason }}</span>
              </div>
            </div>

            <p *ngIf="schedulePreview.conflicts.length === 0 && schedulePreview.creatableCount > 0"
               class="ok-hint">
              <mat-icon>check_circle</mat-icon>
              Nessun appuntamento resta fuori dal nuovo orario.
            </p>
            <div *ngIf="schedulePreview.conflicts.length > 0" class="impact-list warn-box">
              <p class="impact-title">
                <mat-icon>warning</mat-icon>
                {{ schedulePreview.conflicts.length }} appuntament{{
                  schedulePreview.conflicts.length === 1 ? 'o' : 'i'
                }} resterà fuori dal nuovo orario → pagina Conflitti
              </p>
              <div class="impact-row" *ngFor="let apt of schedulePreview.conflicts">
                <span class="impact-date">{{ formatDate(apt.appointmentDate) }}</span>
                <span class="impact-time">{{ shortTime(apt.startTime) }}–{{ shortTime(apt.endTime) }}</span>
                <span class="impact-name">{{ apt.clientName }}</span>
              </div>
            </div>
          </ng-container>
        </div>

        <div *ngIf="errorMessage" class="error-box">
          <mat-icon>error</mat-icon>
          {{ errorMessage }}
        </div>
      </div>

      <div class="dialog-footer">
        <button mat-button (click)="onCancel()">Annulla</button>
        <button
          mat-flat-button
          color="primary"
          [disabled]="saving || !canSubmit()"
          (click)="onSave()"
        >
          <mat-spinner *ngIf="saving" diameter="18"></mat-spinner>
          {{ saveLabel() }}
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        height: 100%;
      }
      .dialog-wrapper {
        display: flex;
        flex-direction: column;
        height: 100%;
        max-height: 100%;
      }
      .dialog-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        color: white;
        cursor: move;
        border-radius: 4px 4px 0 0;
        flex-shrink: 0;
        transition: background 0.2s;
      }
      .dialog-header.mode-absence {
        background: #b71c1c;
      }
      .dialog-header.mode-availability {
        background: #1b5e20;
      }
      .dialog-header.mode-schedule {
        background: #0d47a1;
      }
      .header-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 16px;
        font-weight: 500;
      }
      .dialog-header button {
        color: white;
      }
      .dialog-body {
        flex: 1;
        overflow-y: auto;
        padding: 20px 24px;
      }
      .dialog-footer {
        flex-shrink: 0;
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        padding: 12px 16px;
        border-top: 1px solid rgba(0, 0, 0, 0.08);
        background: #fafafa;
      }
      .mode-group {
        width: 100%;
        margin-bottom: 12px;
      }
      .mode-group ::ng-deep .mat-button-toggle {
        flex: 1;
      }
      .mode-explain {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        margin: 0 0 16px;
        padding: 10px 12px;
        border-radius: 4px;
        font-size: 13px;
        background: #f5f5f5;
      }
      .mode-explain.mode-absence {
        background: #ffebee;
      }
      .mode-explain.mode-availability {
        background: #e8f5e9;
      }
      .mode-explain.mode-schedule {
        background: #e3f2fd;
      }
      .mode-explain mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
      .form-row {
        display: flex;
        gap: 16px;
      }
      .flex-1 {
        flex: 1;
      }
      .full-width {
        width: 100%;
      }
      .operators-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 4px;
      }
      .operators-header h3 {
        margin: 0;
      }
      .cat-hint {
        color: rgba(0, 0, 0, 0.45);
        font-size: 12px;
        margin-left: 4px;
      }
      .weekdays-block,
      .windows-block,
      .toggle-block {
        margin: 0 0 16px;
        padding: 12px;
        background: #f5f5f5;
        border-radius: 4px;
      }
      .weekdays-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
        font-size: 13px;
        color: rgba(0, 0, 0, 0.7);
      }
      .weekdays-group {
        flex-wrap: wrap;
      }
      .window-row {
        display: flex;
        gap: 12px;
        align-items: center;
      }
      .mode-hint {
        margin: 8px 0 0;
        font-size: 12px;
        color: rgba(0, 0, 0, 0.54);
      }
      .single-day-hint {
        margin: -8px 0 12px;
      }
      .preview-block {
        margin-top: 8px;
      }
      .preview-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
      }
      .preview-header h3 {
        margin: 0;
      }
      .loading-inline {
        display: flex;
        align-items: center;
        gap: 8px;
        color: rgba(0, 0, 0, 0.54);
        padding: 8px 0;
      }
      .ok-hint {
        display: flex;
        align-items: center;
        gap: 8px;
        color: #2e7d32;
        padding: 8px 12px;
        background: #e8f5e9;
        border-radius: 4px;
        margin-bottom: 12px;
      }
      .impact-list {
        border-radius: 4px;
        padding: 12px;
        margin-bottom: 12px;
        max-height: 240px;
        overflow-y: auto;
      }
      .warn-box {
        background: #fff3e0;
      }
      .info-box {
        background: #e3f2fd;
      }
      .compare-box {
        background: #f5f5f5;
      }
      .impact-title {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0 0 8px;
        font-size: 13px;
      }
      .impact-row {
        display: flex;
        gap: 12px;
        font-size: 13px;
        padding: 2px 0;
      }
      .impact-date {
        min-width: 90px;
        font-weight: 500;
      }
      .impact-time {
        min-width: 90px;
      }
      .impact-name {
        min-width: 140px;
      }
      .impact-reason {
        color: rgba(0, 0, 0, 0.6);
      }
      .compare-row {
        padding: 8px 0;
        border-bottom: 1px solid rgba(0, 0, 0, 0.06);
        font-size: 13px;
      }
      .compare-row:last-child {
        border-bottom: none;
      }
      .compare-head {
        display: flex;
        gap: 12px;
        margin-bottom: 4px;
      }
      .compare-line {
        display: flex;
        gap: 8px;
        padding: 1px 0;
      }
      .compare-label {
        min-width: 90px;
        color: rgba(0, 0, 0, 0.54);
      }
      .compare-line.lost {
        color: #c62828;
      }
      .compare-line.gained {
        color: #2e7d32;
      }
      .error-box {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px;
        background: #ffebee;
        color: #c62828;
        border-radius: 4px;
        margin-top: 12px;
      }
    `,
  ],
})
export class ExceptionDialogContainerComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private dialogRef =
    inject<MatDialogRef<ExceptionDialogContainerComponent, ExceptionDialogResult | false>>(
      MatDialogRef,
    );
  private absenceService = inject(AbsenceManagementService);
  private absenceTypeService = inject(OperatorAbsenceTypeService);
  private operatorService = inject(OperatorService);
  private ngZone = inject(NgZone);

  /** 0=Lun … 6=Dom, stessa convenzione dei pattern di template. */
  readonly weekdayOptions = [
    { value: 0, label: 'Lun' },
    { value: 1, label: 'Mar' },
    { value: 2, label: 'Mer' },
    { value: 3, label: 'Gio' },
    { value: 4, label: 'Ven' },
    { value: 5, label: 'Sab' },
    { value: 6, label: 'Dom' },
  ];

  mode: ExceptionMode = 'absence';

  operators: Operator[] = [];
  absenceTypes: OperatorAbsenceType[] = [];

  selectedOperatorIds: string[] = [];
  dateFrom: Date = new Date();
  dateTo: Date = new Date();
  weekdays: number[] = [];
  reason = '';

  // Assenza
  absenceTypeId: string | null = null;
  wholeDay = true;

  // Assenza a fascia / disponibilità
  startTime = '';
  endTime = '';

  // Cambio orario
  windows: ScheduleWindow[] = [{ startTime: '', endTime: '' }];

  absencePreview: AbsenceImpactPreview | null = null;
  availabilityPreview: AvailabilityImpactPreview | null = null;
  schedulePreview: ScheduleChangeImpactPreview | null = null;
  previewLoading = false;
  saving = false;
  errorMessage: string | null = null;

  ngOnInit(): void {
    // Solo operatori/medici: gli istruttori palestra hanno il flusso
    // dedicato con sostituti in Configurazioni palestra.
    this.operatorService
      .getOperators(undefined, undefined, true)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (ops) =>
          this.ngZone.run(() => {
            this.operators = (ops || []).filter(
              (o) => o.macroCategory !== OperatorMacroCategory.GymInstructor,
            );
          }),
        error: (err) => console.error('Errore caricamento operatori:', err),
      });

    this.absenceTypeService
      .list(true)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (types) => this.ngZone.run(() => (this.absenceTypes = types)),
        error: (err) => console.error('Errore caricamento tipi di assenza:', err),
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ---- etichette ----

  modeLabel(): string {
    return { absence: 'Assenza', availability: 'Disponibilità in più', schedule: 'Cambio orario' }[
      this.mode
    ];
  }

  modeIcon(): string {
    return { absence: 'event_busy', availability: 'event_available', schedule: 'schedule' }[
      this.mode
    ];
  }

  saveLabel(): string {
    return {
      absence: 'Crea assenza',
      availability: 'Crea disponibilità',
      schedule: 'Applica cambio orario',
    }[this.mode];
  }

  newWindowsLabel(): string {
    return this.windows
      .filter((w) => w.startTime && w.endTime)
      .map((w) => `${w.startTime}–${w.endTime}`)
      .join(', ');
  }

  /** L'assenza a fascia e la disponibilità usano un'unica finestra. */
  usesSingleWindow(): boolean {
    return (
      this.mode === 'availability' || (this.mode === 'absence' && !this.wholeDay)
    );
  }

  isSingleDay(): boolean {
    return (
      !!this.dateFrom &&
      !!this.dateTo &&
      this.toIso(this.dateFrom) === this.toIso(this.dateTo)
    );
  }

  // ---- form ----

  allSelected(): boolean {
    return this.operators.length > 0 && this.selectedOperatorIds.length === this.operators.length;
  }

  toggleAll(checked: boolean): void {
    this.selectedOperatorIds = checked ? this.operators.map((o) => o.id) : [];
    this.onFormChanged();
  }

  clearWeekdays(): void {
    this.weekdays = [];
    this.onFormChanged();
  }

  addWindow(): void {
    this.windows.push({ startTime: '', endTime: '' });
    this.onFormChanged();
  }

  removeWindow(index: number): void {
    if (this.windows.length === 1) return;
    this.windows.splice(index, 1);
    this.onFormChanged();
  }

  categoryLabel(cat?: string | null): string {
    switch (cat) {
      case OperatorMacroCategory.Doctor:
        return 'Medico';
      case OperatorMacroCategory.Physiotherapist:
        return 'Fisioterapista';
      default:
        return 'Operatore';
    }
  }

  onDateFromChanged(): void {
    if (this.dateTo < this.dateFrom) {
      this.dateTo = new Date(this.dateFrom);
    }
    this.onFormChanged();
  }

  onModeChanged(): void {
    this.onFormChanged();
  }

  /** Ogni modifica invalida la verifica precedente. */
  onFormChanged(): void {
    this.absencePreview = null;
    this.availabilityPreview = null;
    this.schedulePreview = null;
    this.errorMessage = null;
  }

  hasPreview(): boolean {
    return !!(this.absencePreview || this.availabilityPreview || this.schedulePreview);
  }

  canPreview(): boolean {
    if (this.selectedOperatorIds.length === 0) return false;
    if (!this.dateFrom || !this.dateTo || this.dateTo < this.dateFrom) return false;

    if (this.mode === 'schedule') {
      const filled = this.windows.filter((w) => w.startTime && w.endTime);
      if (filled.length !== this.windows.length || filled.length === 0) return false;
      return filled.every((w) => w.startTime < w.endTime);
    }
    if (this.usesSingleWindow()) {
      return !!this.startTime && !!this.endTime && this.startTime < this.endTime;
    }
    return true;
  }

  /**
   * Il salvataggio richiede la verifica. Per assenza è una conferma di ciò
   * che si sta per rompere; per le altre due è l'unico punto in cui si
   * vedono i giorni scartati e il perché.
   */
  canSubmit(): boolean {
    if (!this.canPreview()) return false;
    if (this.mode === 'absence') return !!this.absencePreview;
    if (this.mode === 'availability') {
      return !!this.availabilityPreview && this.availabilityPreview.creatableCount > 0;
    }
    return !!this.schedulePreview && this.schedulePreview.creatableCount > 0;
  }

  // ---- verifica ----

  loadPreview(): void {
    if (!this.canPreview()) return;
    this.previewLoading = true;
    this.errorMessage = null;

    const done = () => this.ngZone.run(() => (this.previewLoading = false));
    const fail = (err: any) =>
      this.ngZone.run(() => {
        this.previewLoading = false;
        this.errorMessage =
          err?.graphQLErrors?.[0]?.message || 'Errore nella verifica';
      });

    if (this.mode === 'absence') {
      this.absenceService
        .previewImpact({
          operatorIds: this.selectedOperatorIds,
          dateFrom: this.toIso(this.dateFrom),
          dateTo: this.toIso(this.dateTo),
          startTime: this.wholeDay ? undefined : this.startTime,
          endTime: this.wholeDay ? undefined : this.endTime,
        })
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (p) => this.ngZone.run(() => ((this.absencePreview = p), done())),
          error: fail,
        });
      return;
    }

    if (this.mode === 'availability') {
      this.absenceService
        .previewAvailabilityImpact({
          operatorIds: this.selectedOperatorIds,
          dateFrom: this.toIso(this.dateFrom),
          dateTo: this.toIso(this.dateTo),
          startTime: this.startTime,
          endTime: this.endTime,
          reason: this.reason || undefined,
          weekdays: this.weekdays.length > 0 ? this.weekdays : undefined,
        })
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (p) => this.ngZone.run(() => ((this.availabilityPreview = p), done())),
          error: fail,
        });
      return;
    }

    this.absenceService
      .previewScheduleChange(this.buildScheduleInput())
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (p) => this.ngZone.run(() => ((this.schedulePreview = p), done())),
        error: fail,
      });
  }

  private buildScheduleInput() {
    return {
      operatorIds: this.selectedOperatorIds,
      dateFrom: this.toIso(this.dateFrom),
      dateTo: this.toIso(this.dateTo),
      windows: this.windows.map((w) => ({ startTime: w.startTime, endTime: w.endTime })),
      reason: this.reason || undefined,
      weekdays: this.weekdays.length > 0 ? this.weekdays : undefined,
    };
  }

  // ---- salvataggio ----

  onSave(): void {
    if (this.saving || !this.canSubmit()) return;
    this.saving = true;
    this.errorMessage = null;

    const fail = (err: any) =>
      this.ngZone.run(() => {
        this.saving = false;
        this.errorMessage =
          err?.graphQLErrors?.[0]?.message || err?.message || 'Errore nel salvataggio';
      });
    const close = (result: ExceptionDialogResult) =>
      this.ngZone.run(() => {
        this.saving = false;
        this.dialogRef.close(result);
      });

    if (this.mode === 'absence') {
      this.absenceService
        .createAbsences({
          operatorIds: this.selectedOperatorIds,
          dateFrom: this.toIso(this.dateFrom),
          dateTo: this.toIso(this.dateTo),
          startTime: this.wholeDay ? undefined : this.startTime,
          endTime: this.wholeDay ? undefined : this.endTime,
          absenceTypeId: this.absenceTypeId || undefined,
          reason: this.reason || undefined,
          weekdays: this.weekdays.length > 0 ? this.weekdays : undefined,
        })
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (r) =>
            close({
              mode: 'absence',
              createdCount: r.exceptions?.length ?? 0,
              conflictCount: r.conflictCount,
              skippedCount: r.skippedOverlaps,
              removedAvailabilityCount: r.removedAvailabilityCount,
            }),
          error: fail,
        });
      return;
    }

    if (this.mode === 'availability') {
      this.absenceService
        .createAvailability({
          operatorIds: this.selectedOperatorIds,
          dateFrom: this.toIso(this.dateFrom),
          dateTo: this.toIso(this.dateTo),
          startTime: this.startTime,
          endTime: this.endTime,
          reason: this.reason || undefined,
          weekdays: this.weekdays.length > 0 ? this.weekdays : undefined,
        })
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (r) =>
            close({
              mode: 'availability',
              createdCount: r.createdCount,
              conflictCount: 0,
              skippedCount: r.blockers?.length ?? 0,
              removedAvailabilityCount: 0,
            }),
          error: fail,
        });
      return;
    }

    this.absenceService
      .createScheduleChange(this.buildScheduleInput())
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (r) =>
          close({
            mode: 'schedule',
            createdCount: r.createdCount,
            conflictCount: r.conflictCount,
            skippedCount: r.blockers?.length ?? 0,
            removedAvailabilityCount: 0,
          }),
        error: fail,
      });
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }

  // ---- formattazione ----

  formatDate(date: string): string {
    const d = String(date).slice(0, 10);
    const [y, m, dd] = d.split('-');
    return `${dd}/${m}/${y}`;
  }

  formatJsDate(date: Date): string {
    return this.formatDate(this.toIso(date));
  }

  shortTime(t: string): string {
    return (t || '').slice(0, 5);
  }

  private toIso(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}
