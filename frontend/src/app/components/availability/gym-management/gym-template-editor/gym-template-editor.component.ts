import { Component, OnInit, OnDestroy, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DragDropModule, CdkDragDrop } from '@angular/cdk/drag-drop';
import { Subject, takeUntil } from 'rxjs';

import { GymPatternGroupService, GymPatternGroup, GymTemplatePattern, CreateGymPatternGroupInput, CreateGymTemplatePatternInput } from '../../../../services/gym-pattern-group.service';
import { OperatorService } from '../../../../services/operator.service';
import { Operator, OperatorMacroCategory } from '../../../../graphql/generated/types';

interface TimeSlot {
  time: string;
  label: string;
}

interface PatternCell {
  dayIndex: number;
  time: string;
  pattern: GymTemplatePattern | null;
}

@Component({
  selector: 'app-gym-template-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule],
  templateUrl: './gym-template-editor.component.html',
  styleUrls: ['./gym-template-editor.component.scss'],
})
export class GymTemplateEditorComponent implements OnInit, OnDestroy, OnChanges {
  private destroy$ = new Subject<void>();

  @Input() gymRoom: { id: string; name: string; slotDuration: number; defaultStartTime?: string; defaultEndTime?: string } | null = null;

  // Data
  patternGroups: GymPatternGroup[] = [];
  selectedPatternGroup: GymPatternGroup | null = null;
  operators: Operator[] = [];
  loading = false;
  error: string | null = null;

  // Days
  days = [
    { index: 0, name: 'Lunedì', short: 'LUN' },
    { index: 1, name: 'Martedì', short: 'MAR' },
    { index: 2, name: 'Mercoledì', short: 'MER' },
    { index: 3, name: 'Giovedì', short: 'GIO' },
    { index: 4, name: 'Venerdì', short: 'VEN' },
    { index: 5, name: 'Sabato', short: 'SAB' },
    { index: 6, name: 'Domenica', short: 'DOM' },
  ];

  // Time slots (generated based on gym hours)
  timeSlots: TimeSlot[] = [];

  // Pattern by day
  patternsByDay: Map<number, GymTemplatePattern[]> = new Map();

  // View mode
  viewMode: 'list' | 'editor' = 'list';

  // Form state
  showPatternForm = false;
  editingPattern: Partial<CreateGymTemplatePatternInput> & { id?: string } = {};
  selectedDayIndex: number = 0;

  // Create template form
  showCreateTemplateForm = false;
  newTemplateName = '';

  // Edit template name
  showRenameForm = false;
  renameTemplateName = '';

  constructor(
    private patternGroupService: GymPatternGroupService,
    private operatorService: OperatorService,
  ) {}

  ngOnInit() {
    this.loadOperators();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['gymRoom'] && this.gymRoom) {
      this.generateTimeSlots();
      this.loadPatternGroups();
    }
  }

  generateTimeSlots() {
    this.timeSlots = [];
    const startTime = this.gymRoom?.defaultStartTime || '07:00';
    const endTime = this.gymRoom?.defaultEndTime || '21:00';

    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);

    let currentHour = startHour;
    let currentMin = startMin;

    while (currentHour < endHour || (currentHour === endHour && currentMin < endMin)) {
      const time = `${currentHour.toString().padStart(2, '0')}:${currentMin.toString().padStart(2, '0')}`;
      this.timeSlots.push({
        time,
        label: time,
      });

      // Increment by slot duration (default 60 min)
      currentMin += this.gymRoom?.slotDuration || 60;
      while (currentMin >= 60) {
        currentMin -= 60;
        currentHour++;
      }
    }
  }

  loadOperators() {
    this.operatorService.getOperators(OperatorMacroCategory.GymInstructor, undefined, true)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (operators) => {
          this.operators = operators;
        },
        error: (error) => {
          console.error('Error loading operators:', error);
        },
      });
  }

  loadPatternGroups() {
    if (!this.gymRoom) return;

    this.loading = true;
    this.patternGroupService.getByGymRoom(this.gymRoom.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (groups) => {
          this.patternGroups = groups;
          // Select current if available, otherwise first
          const current = groups.find(g => g.isCurrent && g.isActive);
          this.selectedPatternGroup = current || groups[0] || null;
          this.buildPatternsByDay();
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading pattern groups:', error);
          this.error = 'Errore nel caricamento dei template';
          this.loading = false;
        },
      });
  }

  buildPatternsByDay() {
    this.patternsByDay.clear();
    for (let i = 0; i < 7; i++) {
      this.patternsByDay.set(i, []);
    }

    if (this.selectedPatternGroup?.patterns) {
      for (const pattern of this.selectedPatternGroup.patterns) {
        const dayPatterns = this.patternsByDay.get(pattern.dayInPattern) || [];
        dayPatterns.push(pattern);
        this.patternsByDay.set(pattern.dayInPattern, dayPatterns);
      }
    }
  }

  onPatternGroupChange() {
    this.buildPatternsByDay();
  }

  // Normalizza orario a formato HH:mm (rimuove secondi se presenti)
  private normalizeTime(time: string): string {
    if (!time) return time;
    const parts = time.split(':');
    return `${parts[0]}:${parts[1]}`;
  }

  getPatternAtTime(dayIndex: number, time: string): GymTemplatePattern | null {
    const dayPatterns = this.patternsByDay.get(dayIndex) || [];
    const normalizedTime = this.normalizeTime(time);
    return dayPatterns.find(p => {
      const start = this.normalizeTime(p.startTime);
      const end = this.normalizeTime(p.endTime);
      return start <= normalizedTime && end > normalizedTime;
    }) || null;
  }

  getPatternStyle(pattern: GymTemplatePattern, time: string): { [key: string]: string } {
    // Calculate height based on duration
    const [startH, startM] = pattern.startTime.split(':').map(Number);
    const [endH, endM] = pattern.endTime.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    const duration = endMinutes - startMinutes;
    const slotDuration = this.gymRoom?.slotDuration || 60;
    const spans = Math.ceil(duration / slotDuration);

    // Only show on first time slot
    const [timeH, timeM] = time.split(':').map(Number);
    const timeMinutes = timeH * 60 + timeM;
    if (timeMinutes !== startMinutes) {
      return { display: 'none' };
    }

    return {
      height: `calc(${spans * 100}% + ${(spans - 1) * 1}px)`,
      backgroundColor: pattern.operator?.color || '#4A90E2',
    };
  }

  isPatternStart(pattern: GymTemplatePattern, time: string): boolean {
    return this.normalizeTime(pattern.startTime) === this.normalizeTime(time);
  }

  // Drag and Drop
  onOperatorDrop(event: CdkDragDrop<any>, dayIndex: number, time: string) {
    const operator = event.item.data as Operator;
    this.openPatternForm(dayIndex, time, operator);
  }

  openPatternForm(dayIndex: number, time: string, operator?: Operator) {
    this.selectedDayIndex = dayIndex;
    const slotDuration = this.gymRoom?.slotDuration || 60;
    const [h, m] = time.split(':').map(Number);
    const endMinutes = h * 60 + m + slotDuration;
    const endH = Math.floor(endMinutes / 60);
    const endM = endMinutes % 60;

    this.editingPattern = {
      operatorId: operator?.id || '',
      dayInPattern: dayIndex,
      startTime: time,
      endTime: `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`,
    };
    this.showPatternForm = true;
    this.error = null;
  }

  editPattern(pattern: GymTemplatePattern, dayIndex: number) {
    this.selectedDayIndex = dayIndex;
    this.editingPattern = {
      id: pattern.id,
      operatorId: pattern.operatorId,
      dayInPattern: pattern.dayInPattern,
      startTime: pattern.startTime,
      endTime: pattern.endTime,
    };
    this.showPatternForm = true;
    this.error = null;
  }

  closePatternForm() {
    this.showPatternForm = false;
    this.editingPattern = {};
    this.error = null;
  }

  savePattern() {
    if (!this.selectedPatternGroup) {
      this.error = 'Nessun template selezionato';
      return;
    }

    if (!this.editingPattern.operatorId || this.editingPattern.operatorId.trim() === '') {
      this.error = 'Seleziona un operatore';
      return;
    }

    if (!this.editingPattern.startTime || !this.editingPattern.endTime) {
      this.error = 'Inserisci orario di inizio e fine';
      return;
    }

    if (this.editingPattern.startTime >= this.editingPattern.endTime) {
      this.error = 'L\'orario di inizio deve essere prima dell\'orario di fine';
      return;
    }

    // For now, we need to update the entire pattern group
    // In a real implementation, we'd have separate CRUD for patterns
    this.loading = true;

    const patterns: CreateGymTemplatePatternInput[] = [];

    // Add existing patterns (except the one being edited)
    if (this.selectedPatternGroup.patterns) {
      for (const p of this.selectedPatternGroup.patterns) {
        if (this.editingPattern.id && p.id === this.editingPattern.id) {
          continue; // Skip the one being edited
        }
        patterns.push({
          operatorId: p.operatorId,
          dayInPattern: p.dayInPattern,
          startTime: this.normalizeTime(p.startTime),
          endTime: this.normalizeTime(p.endTime),
        });
      }
    }

    // Add the new/edited pattern
    patterns.push({
      operatorId: this.editingPattern.operatorId!,
      dayInPattern: this.editingPattern.dayInPattern!,
      startTime: this.normalizeTime(this.editingPattern.startTime!),
      endTime: this.normalizeTime(this.editingPattern.endTime!),
    });

    // Debug: log what we're sending
    console.log('Saving patterns:', patterns);
    console.log('Pattern group ID:', this.selectedPatternGroup.id);

    this.patternGroupService.update(this.selectedPatternGroup.id, { patterns })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updated) => {
          this.selectedPatternGroup = updated;
          this.buildPatternsByDay();
          this.closePatternForm();
          this.loading = false;
        },
        error: (error) => {
          console.error('Error saving pattern:', error);
          // Mostra dettagli errore se disponibili
          const errorMessage = error?.graphQLErrors?.[0]?.message ||
                               error?.message ||
                               'Errore nel salvataggio del pattern';
          this.error = errorMessage;
          this.loading = false;
        },
      });
  }

  deletePattern(pattern: GymTemplatePattern) {
    if (!this.selectedPatternGroup) return;
    if (!confirm('Sei sicuro di voler eliminare questa fascia oraria?')) return;

    this.loading = true;

    const patterns: CreateGymTemplatePatternInput[] = [];
    if (this.selectedPatternGroup.patterns) {
      for (const p of this.selectedPatternGroup.patterns) {
        if (p.id === pattern.id) continue;
        patterns.push({
          operatorId: p.operatorId,
          dayInPattern: p.dayInPattern,
          startTime: p.startTime,
          endTime: p.endTime,
        });
      }
    }

    this.patternGroupService.update(this.selectedPatternGroup.id, { patterns })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updated) => {
          this.selectedPatternGroup = updated;
          this.buildPatternsByDay();
          this.loading = false;
        },
        error: (error) => {
          console.error('Error deleting pattern:', error);
          this.error = 'Errore nell\'eliminazione del pattern';
          this.loading = false;
        },
      });
  }

  // Template management
  openCreateTemplateForm() {
    this.newTemplateName = '';
    this.showCreateTemplateForm = true;
    this.error = null;
  }

  closeCreateTemplateForm() {
    this.showCreateTemplateForm = false;
    this.newTemplateName = '';
    this.error = null;
  }

  createTemplate() {
    if (!this.gymRoom) return;

    const name = this.newTemplateName.trim();
    if (!name) {
      this.error = 'Il nome del template è obbligatorio';
      return;
    }

    this.loading = true;
    // Date fields use YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];

    const input: CreateGymPatternGroupInput = {
      gymRoomId: this.gymRoom.id,
      name,
      patternDuration: 7,
      patternStartDate: today,
      validFrom: today,
      patterns: [],
    };

    this.patternGroupService.create(input)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (created) => {
          this.closeCreateTemplateForm();
          // Ricarica la lista dei template
          this.loadPatternGroups();
        },
        error: (error) => {
          console.error('Error creating template:', error);
          this.error = 'Errore nella creazione del template';
          this.loading = false;
        },
      });
  }

  activateTemplate() {
    if (!this.selectedPatternGroup) return;

    this.loading = true;
    this.patternGroupService.activate(this.selectedPatternGroup.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.loadPatternGroups();
        },
        error: (error) => {
          console.error('Error activating template:', error);
          this.error = 'Errore nell\'attivazione del template';
          this.loading = false;
        },
      });
  }

  duplicateTemplate() {
    if (!this.selectedPatternGroup) return;

    const name = prompt('Nome del nuovo template:', `${this.selectedPatternGroup.name} (copia)`);
    if (!name) return;

    this.loading = true;
    this.patternGroupService.duplicate(this.selectedPatternGroup.id, name)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.loadPatternGroups();
        },
        error: (error) => {
          console.error('Error duplicating template:', error);
          this.error = 'Errore nella duplicazione del template';
          this.loading = false;
        },
      });
  }

  deleteTemplate() {
    if (!this.selectedPatternGroup) return;

    // Template corrente non può essere eliminato direttamente
    if (this.selectedPatternGroup.isCurrent) {
      this.error = 'Il template attivo non può essere eliminato. Disattivalo prima o attiva un altro template.';
      return;
    }

    if (!confirm(`Sei sicuro di voler eliminare il template "${this.selectedPatternGroup.name}"?`)) return;

    this.loading = true;
    this.patternGroupService.delete(this.selectedPatternGroup.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.loadPatternGroups();
        },
        error: (error) => {
          console.error('Error deleting template:', error);
          this.error = error.message || 'Errore nell\'eliminazione del template';
          this.loading = false;
        },
      });
  }

  deactivateTemplate() {
    if (!this.selectedPatternGroup) return;

    if (!confirm(`Vuoi disattivare il template "${this.selectedPatternGroup.name}"?\n\nDopo la disattivazione potrai eliminarlo.`)) return;

    this.loading = true;
    this.patternGroupService.deactivate(this.selectedPatternGroup.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.loadPatternGroups();
        },
        error: (error) => {
          console.error('Error deactivating template:', error);
          this.error = 'Errore nella disattivazione del template';
          this.loading = false;
        },
      });
  }

  compareGymRooms(a: any, b: any): boolean {
    return a && b && a.id === b.id;
  }

  // Navigation between views
  openEditor(template: GymPatternGroup) {
    this.selectedPatternGroup = template;
    this.buildPatternsByDay();
    this.viewMode = 'editor';
    // Debug: log patterns
    console.log('Opening editor for template:', template.name);
    console.log('Patterns:', template.patterns);
    console.log('PatternsByDay:', this.patternsByDay);
    console.log('TimeSlots:', this.timeSlots);
  }

  backToList() {
    this.viewMode = 'list';
    this.selectedPatternGroup = null;
    this.loadPatternGroups();
  }

  // Rename template
  openRenameForm() {
    if (!this.selectedPatternGroup) return;
    this.renameTemplateName = this.selectedPatternGroup.name;
    this.showRenameForm = true;
    this.error = null;
  }

  closeRenameForm() {
    this.showRenameForm = false;
    this.renameTemplateName = '';
    this.error = null;
  }

  renameTemplate() {
    if (!this.selectedPatternGroup) return;

    const name = this.renameTemplateName.trim();
    if (!name) {
      this.error = 'Il nome del template è obbligatorio';
      return;
    }

    this.loading = true;
    this.patternGroupService.update(this.selectedPatternGroup.id, { name })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updated) => {
          this.selectedPatternGroup = updated;
          this.closeRenameForm();
          this.loading = false;
        },
        error: (error) => {
          console.error('Error renaming template:', error);
          this.error = 'Errore nel salvataggio del nome';
          this.loading = false;
        },
      });
  }

  // Get pattern count for a template
  getPatternCount(template: GymPatternGroup): number {
    return template.patterns?.length || 0;
  }

  // Get unique operators count for a template
  getOperatorCount(template: GymPatternGroup): number {
    if (!template.patterns || template.patterns.length === 0) return 0;
    const uniqueOperators = new Set(template.patterns.map(p => p.operatorId));
    return uniqueOperators.size;
  }
}
