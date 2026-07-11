/**
 * Patient Header Component
 * Layer 1: Dumb Component (Presentational)
 *
 * Responsabilità:
 * - Visualizzare intestazione paziente (avatar, nome, stats)
 * - Azioni rapide (vedi dettagli, crea percorso)
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
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { Patient } from '../../../../models/patient.model';

@Component({
  selector: 'app-patient-header',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatChipsModule
  ],
  template: `
    <div class="patient-header" [class.no-patient]="!patient">
      @if (!patient) {
        <div class="empty-state">
          <mat-icon>person_off</mat-icon>
          <span>Nessun paziente selezionato</span>
        </div>
      } @else {
        <!-- Avatar e info principale -->
        <div class="patient-main-info">
          <div class="avatar" [class.male]="isMale()" [class.female]="isFemale()">
            <mat-icon>{{ isFemale() ? 'face_3' : 'face' }}</mat-icon>
          </div>

          <div class="info">
            <h2 class="patient-name">{{ patient.nome }} {{ patient.cognome }}</h2>
            <div class="patient-details">
              @if (patient.codiceFiscale) {
                <span class="cf">{{ patient.codiceFiscale }}</span>
              }
              @if (getAge()) {
                <span class="age">{{ getAge() }} anni</span>
              }
            </div>
          </div>
        </div>

        <!-- Stats -->
        <div class="patient-stats">
          <div class="stat" matTooltip="Percorsi terapeutici">
            <mat-icon>route</mat-icon>
            <span class="value">{{ pathsCount }}</span>
            <span class="label">Percorsi</span>
          </div>
          <div class="stat active" matTooltip="Percorsi attivi">
            <mat-icon>play_circle</mat-icon>
            <span class="value">{{ activePathsCount }}</span>
            <span class="label">Attivi</span>
          </div>
          <div class="stat" matTooltip="Trattamenti totali">
            <mat-icon>medical_services</mat-icon>
            <span class="value">{{ totalTreatmentsCount }}</span>
            <span class="label">Trattamenti</span>
          </div>
          <!-- Anamnesi remota: riquadro cliccabile che apre la scheda anamnesi
               sotto, indipendentemente dall'esistenza di percorsi. -->
          <button
            type="button"
            class="stat stat-anamnesi"
            [class.compiled]="anamnesisExists"
            [matTooltip]="anamnesisExists ? 'Visualizza anamnesi remota' : 'Anamnesi remota non ancora compilata'"
            (click)="onViewAnamnesis()">
            <mat-icon>{{ anamnesisExists ? 'history_edu' : 'note_add' }}</mat-icon>
            <span class="value">{{ anamnesisExists ? '✓' : '—' }}</span>
            <span class="label">Anamnesi</span>
          </button>
        </div>

        <!-- Actions -->
        <div class="patient-actions">
          <button mat-icon-button matTooltip="Vedi dettagli paziente" (click)="onViewDetails()">
            <mat-icon>visibility</mat-icon>
          </button>
          @if (registrySubjectUrl) {
            <a mat-icon-button
               matTooltip="Modifica anagrafica completa nel registry"
               [href]="registrySubjectUrl"
               target="_blank"
               rel="noopener noreferrer">
              <mat-icon>open_in_new</mat-icon>
            </a>
          }
          <button mat-flat-button color="primary" (click)="onCreatePath()">
            <mat-icon>add</mat-icon>
            Nuova Valutazione
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    .patient-header {
      display: flex;
      align-items: center;
      gap: 24px;
      padding: 20px 24px;
      background: linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%);
      border-radius: 16px 16px 0 0;
      border-bottom: 1px solid #e2e8f0;

      &.no-patient {
        justify-content: center;
        min-height: 100px;
      }
    }

    .empty-state {
      display: flex;
      align-items: center;
      gap: 12px;
      color: #94a3b8;

      mat-icon {
        font-size: 32px;
        width: 32px;
        height: 32px;
      }

      span {
        font-size: 0.9375rem;
      }
    }

    .patient-main-info {
      display: flex;
      align-items: center;
      gap: 16px;
      flex: 1;
    }

    .avatar {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;

      mat-icon {
        font-size: 36px;
        width: 36px;
        height: 36px;
        color: white;
      }

      &.male {
        background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
      }

      &.female {
        background: linear-gradient(135deg, #ec4899 0%, #be185d 100%);
      }
    }

    .info {
      flex: 1;
      min-width: 0;
    }

    .patient-name {
      margin: 0 0 4px;
      font-size: 1.375rem;
      font-weight: 600;
      color: #1e293b;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .patient-details {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;

      .cf {
        font-family: 'SF Mono', 'Roboto Mono', monospace;
        font-size: 0.75rem;
        color: #64748b;
        background: #e2e8f0;
        padding: 2px 8px;
        border-radius: 4px;
      }

      .age {
        font-size: 0.8125rem;
        color: #64748b;
      }
    }

    .patient-stats {
      display: flex;
      gap: 20px;
    }

    .stat {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      padding: 8px 12px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
      min-width: 70px;

      mat-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
        color: #64748b;
      }

      .value {
        font-size: 1.25rem;
        font-weight: 700;
        color: #1e293b;
      }

      .label {
        font-size: 0.6875rem;
        color: #94a3b8;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      &.active {
        background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);

        mat-icon {
          color: #16a34a;
        }

        .value {
          color: #166534;
        }
      }
    }

    /* Riquadro anamnesi: è un <button> resettato per apparire come .stat */
    button.stat-anamnesi {
      border: none;
      cursor: pointer;
      font-family: inherit;
      transition: all 0.2s;

      &:hover {
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        transform: translateY(-1px);
      }

      &.compiled {
        background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);

        mat-icon {
          color: #2563eb;
        }

        .value {
          color: #1e40af;
        }
      }

      &:not(.compiled) {
        .value {
          color: #94a3b8;
        }
      }
    }

    .patient-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    /* Responsive */
    @media (max-width: 1023px) {
      .patient-header {
        flex-wrap: wrap;
        gap: 16px;
      }

      .patient-stats {
        order: 3;
        width: 100%;
        justify-content: center;
      }
    }

    @media (max-width: 599px) {
      .patient-header {
        flex-direction: column;
        align-items: stretch;
        padding: 16px;
      }

      .patient-main-info {
        justify-content: center;
        text-align: center;
        flex-direction: column;
      }

      .patient-details {
        justify-content: center;
      }

      .patient-stats {
        justify-content: space-around;
      }

      .patient-actions {
        justify-content: center;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientHeaderComponent {
  @Input() patient: Patient | null = null;
  @Input() pathsCount = 0;
  @Input() activePathsCount = 0;
  @Input() totalTreatmentsCount = 0;
  /** True se il paziente ha già un'anamnesi remota compilata. */
  @Input() anamnesisExists = false;

  @Output() viewDetails = new EventEmitter<void>();
  @Output() createPath = new EventEmitter<void>();
  /** Richiesta di visualizzare/aprire la scheda anamnesi remota. */
  @Output() viewAnamnesis = new EventEmitter<void>();

  /**
   * URL per la modifica avanzata del subject, nella sezione Anagrafiche
   * della suite unificata (es. bdq.curandis.cloud →
   * https://gestione.bdq.curandis.cloud/anagrafiche/subjects/{id}).
   * Vedi frontend/CLAUDE.md sezione "Link cross-modulo".
   */
  get registrySubjectUrl(): string | null {
    if (!this.patient?.id) return null;
    const alias = this.tenantAliasFromHost();
    if (!alias) return null;
    return `https://gestione.${alias}.curandis.cloud/anagrafiche/subjects/${this.patient.id}`;
  }

  private tenantAliasFromHost(): string | null {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') return null;
    const parts = hostname.split('.');
    if (parts.length < 3) return null;
    const sub = parts[0].toLowerCase();
    const NON_TENANT = new Set(['api', 'auth', 'tenants', 'my', 'www', 'agenda', 'registry', 'accounting']);
    return NON_TENANT.has(sub) ? null : sub;
  }

  onViewDetails(): void {
    this.viewDetails.emit();
  }

  onCreatePath(): void {
    this.createPath.emit();
  }

  onViewAnamnesis(): void {
    this.viewAnamnesis.emit();
  }

  getAge(): number | null {
    if (!this.patient?.dataNascita) return null;

    const birthDate = new Date(this.patient.dataNascita);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    return age > 0 ? age : null;
  }

  isMale(): boolean {
    return this.patient?.genere === 'MASCHIO';
  }

  isFemale(): boolean {
    return this.patient?.genere === 'FEMMINA';
  }
}
