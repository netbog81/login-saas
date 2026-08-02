/**
 * Slot Group Card Component
 * Layer 1: Dumb Component
 *
 * Responsabilità:
 * - Visualizzare un gruppo di appuntamenti nello stesso slot orario e palestra
 * - Mostrare header con orario, nome palestra, conteggio pazienti / capacità max
 * - Renderizzare PatientSlotCard per ogni appuntamento
 */

import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { SlotGroup } from '../../models/instructor-workspace.model';
import { PatientSlotCardComponent } from '../patient-slot-card/patient-slot-card.component';

@Component({
  selector: 'app-slot-group-card',
  standalone: true,
  imports: [CommonModule, MatIconModule, PatientSlotCardComponent],
  template: `
    <div class="slot-group-card">
      <div class="slot-header">
        <div class="slot-time">
          <mat-icon class="time-icon">schedule</mat-icon>
          <span>{{ slotGroup.startTime }} - {{ slotGroup.endTime }}</span>
        </div>
        <div class="slot-gym" [style.border-color]="slotGroup.gymRoom.color || '#94a3b8'">
          <mat-icon class="gym-icon">fitness_center</mat-icon>
          <span>{{ slotGroup.gymRoom.name }}</span>
        </div>
        <div class="slot-count" [class.full]="slotGroup.appointments.length >= slotGroup.gymRoom.maxCapacity">
          {{ slotGroup.appointments.length }}/{{ slotGroup.gymRoom.maxCapacity }}
        </div>
      </div>
      <div class="slot-patients">
        @for (apt of slotGroup.appointments; track apt.id) {
          <app-patient-slot-card
            [appointment]="apt"
            (openFolder)="openFolder.emit($event)"></app-patient-slot-card>
        }
        @empty {
          <div class="empty-slot">Nessun paziente prenotato</div>
        }
      </div>
    </div>
  `,
  styles: [`
    .slot-group-card {
      background: white;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
      overflow: hidden;
      margin-bottom: 12px;
    }

    .slot-header {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 10px 16px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
    }

    .slot-time {
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: 600;
      font-size: 0.9rem;
      color: #334155;
    }

    .time-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #64748b;
    }

    .slot-gym {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 2px 10px;
      border-radius: 12px;
      background: #f0fdf4;
      border-left: 3px solid;
      font-size: 0.8rem;
      font-weight: 500;
      color: #15803d;
    }

    .gym-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .slot-count {
      margin-left: auto;
      font-size: 0.8rem;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 10px;
      background: #e0f2fe;
      color: #0369a1;
    }

    .slot-count.full {
      background: #fef3c7;
      color: #92400e;
    }

    .slot-patients {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      padding: 12px 16px;
    }

    .empty-slot {
      color: #94a3b8;
      font-size: 0.85rem;
      font-style: italic;
    }

    @media (max-width: 599px) {
      .slot-header {
        flex-wrap: wrap;
        gap: 8px;
      }

      .slot-patients {
        flex-direction: column;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SlotGroupCardComponent {
  @Input({ required: true }) slotGroup!: SlotGroup;

  /** Propaga la richiesta di apertura scheda paziente (patientId). */
  @Output() openFolder = new EventEmitter<string>();
}
