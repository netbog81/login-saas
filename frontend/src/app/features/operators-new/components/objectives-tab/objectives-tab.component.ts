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
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';

import { AnamnesisComplete, Obiettivo, TestSpecifico } from '../../models/anamnesis.model';
import {
  ObjectiveType,
  ObjectiveWithProgress,
  TestWithEvaluations,
  ObjectiveProgressEntry,
  TestEvaluationEntry,
  ObjectiveProgressChangeEvent,
  TestEvaluationAddedEvent,
  TestEvaluationEditedEvent,
  TestResetEvent,
  TestDeleteEvent
} from '../../models/objectives-tracking.model';
import { ObjectiveProgressItemComponent } from '../objective-progress-item/objective-progress-item.component';
import { TestEvaluationItemComponent } from '../test-evaluation-item/test-evaluation-item.component';

@Component({
  selector: 'app-objectives-tab',
  standalone: true,
  imports: [
    CommonModule,
    MatExpansionModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatDividerModule,
    ObjectiveProgressItemComponent,
    TestEvaluationItemComponent
  ],
  template: `
    <div class="objectives-tab">
      <!-- Header -->
      <div class="objectives-header">
        <div class="header-row">
          <h3>Valutazione percorso terapeutico</h3>
          @if (showExpandButton) {
            <button mat-icon-button
                    matTooltip="Espandi vista"
                    (click)="onExpand()">
              <mat-icon>open_in_full</mat-icon>
            </button>
          }
        </div>
        <div class="progress-summary">
          <span class="objectives-count">
            <mat-icon>flag</mat-icon>
            {{ getCompletedObjectivesCount() }}/{{ getTotalObjectivesCount() }} obiettivi completati
          </span>
          <span class="tests-count">
            <mat-icon>assignment</mat-icon>
            {{ getEvaluatedTestsCount() }}/{{ getTotalTestsCount() }} test valutati
          </span>
        </div>
      </div>

      <!-- Content scrollabile -->
      <div class="objectives-content">
        @if (hasObjectives() || hasTests()) {
          <mat-accordion multi>

            <!-- SEZIONE OBIETTIVI -->
            @if (hasObjectives()) {
              <!-- Obiettivi Breve Termine -->
              @if (getShortTermObjectives().length) {
                <mat-expansion-panel [expanded]="true">
                  <mat-expansion-panel-header>
                    <mat-panel-title>
                      <mat-icon>flag</mat-icon>
                      Obiettivi Breve Termine
                    </mat-panel-title>
                    <mat-panel-description>
                      {{ getCompletedCount('breve') }}/{{ getShortTermObjectives().length }}
                    </mat-panel-description>
                  </mat-expansion-panel-header>

                  <div class="objectives-list">
                    @for (obj of getShortTermObjectives(); track obj.id) {
                      <app-objective-progress-item
                        [objective]="obj"
                        [readonly]="readonly"
                        (progressChange)="onObjectiveProgressChange(obj.id, $event)"
                        (viewHistory)="onViewObjectiveHistory(obj)">
                      </app-objective-progress-item>
                    }
                  </div>
                </mat-expansion-panel>
              }

              <!-- Obiettivi Medio Termine -->
              @if (getMediumTermObjectives().length) {
                <mat-expansion-panel>
                  <mat-expansion-panel-header>
                    <mat-panel-title>
                      <mat-icon>trending_up</mat-icon>
                      Obiettivi Medio Termine
                    </mat-panel-title>
                    <mat-panel-description>
                      {{ getCompletedCount('medio') }}/{{ getMediumTermObjectives().length }}
                    </mat-panel-description>
                  </mat-expansion-panel-header>

                  <div class="objectives-list">
                    @for (obj of getMediumTermObjectives(); track obj.id) {
                      <app-objective-progress-item
                        [objective]="obj"
                        [readonly]="readonly"
                        (progressChange)="onObjectiveProgressChange(obj.id, $event)"
                        (viewHistory)="onViewObjectiveHistory(obj)">
                      </app-objective-progress-item>
                    }
                  </div>
                </mat-expansion-panel>
              }

              <!-- Obiettivi Lungo Termine -->
              @if (getLongTermObjectives().length) {
                <mat-expansion-panel>
                  <mat-expansion-panel-header>
                    <mat-panel-title>
                      <mat-icon>emoji_events</mat-icon>
                      Obiettivi Lungo Termine
                    </mat-panel-title>
                    <mat-panel-description>
                      {{ getCompletedCount('lungo') }}/{{ getLongTermObjectives().length }}
                    </mat-panel-description>
                  </mat-expansion-panel-header>

                  <div class="objectives-list">
                    @for (obj of getLongTermObjectives(); track obj.id) {
                      <app-objective-progress-item
                        [objective]="obj"
                        [readonly]="readonly"
                        (progressChange)="onObjectiveProgressChange(obj.id, $event)"
                        (viewHistory)="onViewObjectiveHistory(obj)">
                      </app-objective-progress-item>
                    }
                  </div>
                </mat-expansion-panel>
              }
            }

            <!-- SEZIONE TEST -->
            @if (hasTests()) {
              <mat-expansion-panel
                [expanded]="isTestPanelExpanded()"
                (opened)="onTestPanelToggle(true)"
                (closed)="onTestPanelToggle(false)">
                <mat-expansion-panel-header>
                  <mat-panel-title>
                    <mat-icon>assignment</mat-icon>
                    Test di Valutazione
                  </mat-panel-title>
                  <mat-panel-description>
                    {{ getEvaluatedTestsCount() }}/{{ getTotalTestsCount() }} valutati
                  </mat-panel-description>
                </mat-expansion-panel-header>

                <div class="tests-list">
                  @for (test of getTests(); track test.id) {
                    <app-test-evaluation-item
                      [test]="test"
                      [readonly]="readonly"
                      [canDelete]="getTotalTestsCount() > 1"
                      [anamnesisId]="anamnesisComplete?.id || ''"
                      (addEvaluation)="onAddTestEvaluation(test.id, $event)"
                      (editEvaluation)="onEditTestEvaluation(test.id, $event)"
                      (resetEvaluation)="onResetTestEvaluation(test.id)"
                      (deleteTest)="onDeleteTest(test.id)"
                      (viewHistory)="onViewTestHistory(test)">
                    </app-test-evaluation-item>
                  }
                </div>
              </mat-expansion-panel>
            }
          </mat-accordion>
        } @else {
          <!-- Empty state -->
          <div class="empty-state">
            <mat-icon>track_changes</mat-icon>
            <p>Nessun obiettivo o test definito</p>
            <span>Compila prima la scheda anamnesi per aggiungere obiettivi e test</span>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
    }

    .objectives-tab {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;
    }

    .objectives-header {
      padding: 16px;
      border-bottom: 1px solid #e2e8f0;
      background: #f8fafc;

      .header-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 8px;

        h3 {
          margin: 0;
          font-size: 1rem;
          font-weight: 600;
          color: #1e293b;
        }

        button {
          color: #64748b;

          &:hover {
            color: #667eea;
          }
        }
      }

      .progress-summary {
        display: flex;
        gap: 16px;
        font-size: 0.8125rem;
        color: #64748b;

        span {
          display: flex;
          align-items: center;
          gap: 4px;

          mat-icon {
            font-size: 16px;
            width: 16px;
            height: 16px;
          }
        }

        .objectives-count mat-icon {
          color: #667eea;
        }

        .tests-count mat-icon {
          color: #10b981;
        }
      }
    }

    .objectives-content {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      padding: 16px;

      &::-webkit-scrollbar { width: 6px; }
      &::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 3px; }
      &::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
      &::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
    }

    .objectives-list, .tests-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px 24px;
      text-align: center;

      mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        color: #cbd5e1;
        margin-bottom: 16px;
      }

      p {
        margin: 0;
        font-size: 1rem;
        font-weight: 500;
        color: #64748b;
      }

      span {
        margin-top: 8px;
        font-size: 0.875rem;
        color: #94a3b8;
      }
    }

    mat-expansion-panel {
      margin-bottom: 12px;
      border-radius: 8px !important;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1) !important;

      mat-panel-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 500;

        mat-icon {
          color: #667eea;
        }
      }

      mat-panel-description {
        color: #64748b;
        font-size: 0.8125rem;
      }
    }

    @media (max-width: 599px) {
      .objectives-header {
        padding: 12px;
      }
      .progress-summary {
        flex-direction: column;
        gap: 4px !important;
      }
      .objectives-content {
        padding: 12px;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ObjectivesTabComponent {
  @Input() anamnesisComplete: AnamnesisComplete | null = null;
  @Input() objectivesWithProgress: ObjectiveWithProgress[] = [];
  @Input() testsWithEvaluations: TestWithEvaluations[] = [];
  @Input() readonly = false;
  @Input() showExpandButton = true;

  @Output() objectiveProgressChanged = new EventEmitter<ObjectiveProgressChangeEvent>();
  @Output() testEvaluationAdded = new EventEmitter<TestEvaluationAddedEvent>();
  @Output() testEvaluationEdited = new EventEmitter<TestEvaluationEditedEvent>();
  @Output() testReset = new EventEmitter<TestResetEvent>();
  @Output() testDeleted = new EventEmitter<TestDeleteEvent>();
  @Output() openTestHistory = new EventEmitter<TestWithEvaluations>();
  @Output() expand = new EventEmitter<void>();

  // Stato pannello test (null = usa default, true/false = stato utente)
  private testPanelExpandedState: boolean | null = null;

  // Getter per lo stato di espansione del pannello test
  isTestPanelExpanded(): boolean {
    // Se l'utente ha interagito, usa lo stato memorizzato
    if (this.testPanelExpandedState !== null) {
      return this.testPanelExpandedState;
    }
    // Default: aperto se non ci sono obiettivi
    return !this.hasObjectives();
  }

  // Handler per quando l'utente apre/chiude il pannello test
  onTestPanelToggle(expanded: boolean): void {
    this.testPanelExpandedState = expanded;
  }

  // === Obiettivi helpers ===

  hasObjectives(): boolean {
    return this.objectivesWithProgress.length > 0;
  }

  getTotalObjectivesCount(): number {
    return this.objectivesWithProgress.length;
  }

  getCompletedObjectivesCount(): number {
    return this.objectivesWithProgress.filter(o => o.progressLevel === 5).length;
  }

  getShortTermObjectives(): ObjectiveWithProgress[] {
    return this.objectivesWithProgress.filter(o => o.tipo === ObjectiveType.BREVE_TERMINE);
  }

  getMediumTermObjectives(): ObjectiveWithProgress[] {
    return this.objectivesWithProgress.filter(o => o.tipo === ObjectiveType.MEDIO_TERMINE);
  }

  getLongTermObjectives(): ObjectiveWithProgress[] {
    return this.objectivesWithProgress.filter(o => o.tipo === ObjectiveType.LUNGO_TERMINE);
  }

  getCompletedCount(tipo: 'breve' | 'medio' | 'lungo'): number {
    let objectives: ObjectiveWithProgress[];
    switch (tipo) {
      case 'breve':
        objectives = this.getShortTermObjectives();
        break;
      case 'medio':
        objectives = this.getMediumTermObjectives();
        break;
      case 'lungo':
        objectives = this.getLongTermObjectives();
        break;
    }
    return objectives.filter(o => o.progressLevel === 5).length;
  }

  // === Test helpers ===

  hasTests(): boolean {
    return this.testsWithEvaluations.length > 0;
  }

  getTotalTestsCount(): number {
    return this.testsWithEvaluations.length;
  }

  getEvaluatedTestsCount(): number {
    return this.testsWithEvaluations.filter(t => t.evaluationHistory && t.evaluationHistory.length > 0).length;
  }

  getTests(): TestWithEvaluations[] {
    return this.testsWithEvaluations;
  }

  // === Event handlers ===

  onObjectiveProgressChange(objectiveId: string, event: { newLevel: number; note?: string }): void {
    this.objectiveProgressChanged.emit({
      objectiveId,
      newLevel: event.newLevel,
      note: event.note
    });
  }

  onViewObjectiveHistory(objective: ObjectiveWithProgress): void {
    // TODO: Open dialog with history
    console.log('View objective history:', objective.progressHistory);
  }

  onAddTestEvaluation(testId: string, event: { level: number; note?: string }): void {
    this.testEvaluationAdded.emit({
      testId,
      level: event.level,
      note: event.note
    });
  }

  onEditTestEvaluation(testId: string, event: { level: number; note?: string }): void {
    this.testEvaluationEdited.emit({
      testId,
      level: event.level,
      note: event.note
    });
  }

  onResetTestEvaluation(testId: string): void {
    this.testReset.emit({ testId });
  }

  onDeleteTest(testId: string): void {
    this.testDeleted.emit({
      testId,
      anamnesisId: this.anamnesisComplete?.id || ''
    });
  }

  onViewTestHistory(test: TestWithEvaluations): void {
    this.openTestHistory.emit(test);
  }

  onExpand(): void {
    this.expand.emit();
  }
}
