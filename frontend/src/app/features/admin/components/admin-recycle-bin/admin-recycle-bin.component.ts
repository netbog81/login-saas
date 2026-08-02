import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatMenuModule } from '@angular/material/menu';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatDividerModule } from '@angular/material/divider';
import { firstValueFrom } from 'rxjs';
import {
  RecycleBinService,
  RecycleBinItem,
  RecycleBinEntityType,
  RecycleBinSettings,
} from './recycle-bin.service';
import { PermissionsService } from '../../../../core/services/permissions.service';
import { ConfirmDeleteDialogComponent } from '../../../../core/components/confirm-delete-dialog/confirm-delete-dialog.component';

const ENTITY_LABELS: Record<RecycleBinEntityType, string> = {
  therapeutic_path: 'Percorso',
  treatment: 'Trattamento',
  patient_evaluation: 'Valutazione',
  patient_document: 'Documento',
};

const ENTITY_ICONS: Record<RecycleBinEntityType, string> = {
  therapeutic_path: 'route',
  treatment: 'medical_services',
  patient_evaluation: 'fact_check',
  patient_document: 'folder',
};

@Component({
  selector: 'app-admin-recycle-bin',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatDialogModule,
    MatSnackBarModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTableModule,
    MatMenuModule,
    MatSlideToggleModule,
    MatDividerModule,
  ],
  template: `
    <div class="recycle-bin-container">
      <mat-card class="header-card">
        <mat-card-header>
          <mat-icon mat-card-avatar>delete_sweep</mat-icon>
          <mat-card-title>Cestino</mat-card-title>
          <mat-card-subtitle>
            @if (settings()?.retentionDays !== null && settings()?.retentionDays !== undefined) {
              Retention: {{ settings()!.retentionDays }} giorni
            } @else {
              Retention indefinita (svuotamento solo manuale)
            }
          </mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <div class="filters">
            <mat-form-field appearance="outline" class="filter-search">
              <mat-label>Cerca</mat-label>
              <input
                matInput
                [(ngModel)]="searchText"
                (ngModelChange)="onSearchChange()"
                placeholder="Nome paziente, percorso..." />
              <mat-icon matSuffix>search</mat-icon>
            </mat-form-field>

            <mat-form-field appearance="outline" class="filter-types">
              <mat-label>Tipo</mat-label>
              <mat-select
                [(ngModel)]="selectedTypes"
                (ngModelChange)="reload()"
                multiple>
                <mat-option value="therapeutic_path">Percorsi</mat-option>
                <mat-option value="treatment">Trattamenti</mat-option>
                <mat-option value="patient_evaluation">Valutazioni</mat-option>
                <mat-option value="patient_document">Documenti</mat-option>
              </mat-select>
            </mat-form-field>

            <button mat-stroked-button (click)="reload()" matTooltip="Ricarica">
              <mat-icon>refresh</mat-icon>
              Ricarica
            </button>

            @if (perms.canPurgeRecycleBin()) {
              <span class="filters-spacer"></span>
              <button
                mat-stroked-button
                color="warn"
                [matMenuTriggerFor]="emptyMenu"
                [disabled]="items().length === 0">
                <mat-icon>delete_forever</mat-icon>
                Svuota cestino
              </button>
              <mat-menu #emptyMenu="matMenu">
                <button mat-menu-item (click)="emptyApplyRetention()">
                  <mat-icon>schedule</mat-icon>
                  Applica retention ora
                </button>
                <button mat-menu-item (click)="emptyForce()">
                  <mat-icon>warning</mat-icon>
                  Svuota tutto (ignora retention)
                </button>
              </mat-menu>
            }
          </div>
        </mat-card-content>
      </mat-card>

      @if (perms.canManageRetention()) {
        <mat-card class="settings-card">
          <mat-card-header>
            <mat-icon mat-card-avatar>schedule</mat-icon>
            <mat-card-title>Impostazioni retention</mat-card-title>
            <mat-card-subtitle>
              Periodo di conservazione automatica degli elementi nel cestino prima dell'eliminazione definitiva.
            </mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <div class="settings-row">
              <mat-slide-toggle
                [(ngModel)]="retentionIndefinite"
                (ngModelChange)="onRetentionIndefiniteChange($event)">
                Retention indefinita (svuotamento solo manuale)
              </mat-slide-toggle>
            </div>

            <div class="settings-row">
              <mat-form-field appearance="outline" class="retention-field">
                <mat-label>Giorni di retention</mat-label>
                <input
                  matInput
                  type="number"
                  min="30"
                  step="1"
                  [(ngModel)]="retentionDaysInput"
                  [disabled]="retentionIndefinite" />
                <span matTextSuffix>giorni</span>
                <mat-hint>Minimo 30 giorni</mat-hint>
                @if (retentionError()) {
                  <mat-error>{{ retentionError() }}</mat-error>
                }
              </mat-form-field>
            </div>

            <mat-divider></mat-divider>

            <div class="settings-actions">
              <span class="settings-meta">
                @if (settings()?.updatedAt) {
                  Ultimo aggiornamento: {{ settings()!.updatedAt | date:'dd/MM/yyyy HH:mm' }}
                }
              </span>
              <span class="filters-spacer"></span>
              <button
                mat-stroked-button
                (click)="resetSettingsForm()"
                [disabled]="!isSettingsDirty() || savingSettings()">
                Annulla
              </button>
              <button
                mat-raised-button
                color="primary"
                (click)="saveSettings()"
                [disabled]="!isSettingsDirty() || !!retentionError() || savingSettings()">
                @if (savingSettings()) {
                  <mat-spinner diameter="18"></mat-spinner>
                } @else {
                  <mat-icon>save</mat-icon>
                }
                Salva
              </button>
            </div>
          </mat-card-content>
        </mat-card>
      }

      <mat-card class="list-card">
        <mat-card-content>
          @if (loading()) {
            <div class="state-empty">
              <mat-spinner diameter="32"></mat-spinner>
              <p>Caricamento...</p>
            </div>
          } @else if (items().length === 0) {
            <div class="state-empty">
              <mat-icon>delete_outline</mat-icon>
              <p>Il cestino è vuoto</p>
            </div>
          } @else {
            <table mat-table [dataSource]="items()" class="recycle-table">
              <ng-container matColumnDef="type">
                <th mat-header-cell *matHeaderCellDef>Tipo</th>
                <td mat-cell *matCellDef="let item">
                  <mat-chip class="type-chip">
                    <mat-icon class="chip-icon">{{ iconFor(item.entityType) }}</mat-icon>
                    {{ labelFor(item.entityType) }}
                  </mat-chip>
                </td>
              </ng-container>

              <ng-container matColumnDef="title">
                <th mat-header-cell *matHeaderCellDef>Elemento</th>
                <td mat-cell *matCellDef="let item">
                  <div class="cell-title">{{ item.title }}</div>
                  @if (item.subtitle) {
                    <div class="cell-subtitle">{{ item.subtitle }}</div>
                  }
                  @if (item.childrenCount && item.childrenCount > 0) {
                    <div class="cell-children">
                      <mat-icon class="inline-icon">subdirectory_arrow_right</mat-icon>
                      {{ item.childrenCount }} elementi collegati
                    </div>
                  }
                </td>
              </ng-container>

              <ng-container matColumnDef="owner">
                <th mat-header-cell *matHeaderCellDef>Proprietario</th>
                <td mat-cell *matCellDef="let item">
                  {{ item.ownerName || '—' }}
                </td>
              </ng-container>

              <ng-container matColumnDef="deletedBy">
                <th mat-header-cell *matHeaderCellDef>Eliminato da</th>
                <td mat-cell *matCellDef="let item">
                  {{ item.deletedByName || '—' }}
                  <div class="cell-when">
                    {{ item.deletedAt | date:'dd/MM/yyyy HH:mm' }}
                  </div>
                </td>
              </ng-container>

              <ng-container matColumnDef="purgeAt">
                <th mat-header-cell *matHeaderCellDef>Eliminazione automatica</th>
                <td mat-cell *matCellDef="let item">
                  @if (item.scheduledPurgeAt) {
                    <span [matTooltip]="item.scheduledPurgeAt | date:'dd/MM/yyyy HH:mm'">
                      {{ daysUntil(item.scheduledPurgeAt) }}
                    </span>
                  } @else {
                    <span class="muted">Indefinito</span>
                  }
                </td>
              </ng-container>

              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef class="actions-header">Azioni</th>
                <td mat-cell *matCellDef="let item" class="actions-cell">
                  <button
                    mat-icon-button
                    color="primary"
                    (click)="onRestore(item)"
                    matTooltip="Ripristina">
                    <mat-icon>restore_from_trash</mat-icon>
                  </button>
                  @if (perms.canPurgeRecycleBin()) {
                    <button
                      mat-icon-button
                      color="warn"
                      (click)="onPurge(item)"
                      matTooltip="Elimina definitivamente">
                      <mat-icon>delete_forever</mat-icon>
                    </button>
                  }
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
            </table>
          }
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [
    `
      .recycle-bin-container {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .header-card,
      .settings-card,
      .list-card {
        background: white;
      }
      .settings-row {
        margin: 12px 0;
      }
      .retention-field {
        max-width: 280px;
      }
      .settings-actions {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
        margin-top: 16px;
      }
      .settings-meta {
        font-size: 0.85rem;
        color: rgba(0, 0, 0, 0.55);
      }
      .filters {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
        margin-top: 8px;
      }
      .filters-spacer {
        flex: 1;
      }
      .filter-search {
        min-width: 280px;
        flex: 1 1 280px;
      }
      .filter-types {
        min-width: 200px;
      }
      .recycle-table {
        width: 100%;
      }
      .type-chip {
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }
      .chip-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
      }
      .cell-title {
        font-weight: 500;
      }
      .cell-subtitle {
        font-size: 0.85rem;
        color: rgba(0, 0, 0, 0.6);
      }
      .cell-children {
        font-size: 0.8rem;
        color: rgba(0, 0, 0, 0.5);
        display: inline-flex;
        align-items: center;
        gap: 4px;
        margin-top: 2px;
      }
      .inline-icon {
        font-size: 14px;
        width: 14px;
        height: 14px;
      }
      .cell-when {
        font-size: 0.8rem;
        color: rgba(0, 0, 0, 0.55);
      }
      .muted {
        color: rgba(0, 0, 0, 0.4);
        font-style: italic;
      }
      .actions-header,
      .actions-cell {
        text-align: right;
        width: 110px;
      }
      .state-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
        padding: 48px 24px;
        color: rgba(0, 0, 0, 0.55);
      }
      .state-empty mat-icon {
        font-size: 40px;
        width: 40px;
        height: 40px;
        opacity: 0.4;
      }
    `,
  ],
})
export class AdminRecycleBinComponent implements OnInit {
  readonly perms = inject(PermissionsService);
  private readonly recycleBin = inject(RecycleBinService);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);

  readonly loading = signal(false);
  readonly items = signal<RecycleBinItem[]>([]);
  readonly settings = signal<RecycleBinSettings | null>(null);

  // ─── Settings form state ─────────────────────────────────────────
  retentionDaysInput: number = 30;
  retentionIndefinite = false;
  readonly savingSettings = signal(false);

  searchText = '';
  selectedTypes: RecycleBinEntityType[] = [];

  readonly displayedColumns = [
    'type',
    'title',
    'owner',
    'deletedBy',
    'purgeAt',
    'actions',
  ];

  private searchDebounce?: ReturnType<typeof setTimeout>;

  async ngOnInit(): Promise<void> {
    await this.perms.ensureLoaded();
    await this.loadSettings();
    await this.reload();
  }

  iconFor(t: RecycleBinEntityType): string {
    return ENTITY_ICONS[t];
  }

  labelFor(t: RecycleBinEntityType): string {
    return ENTITY_LABELS[t];
  }

  async loadSettings(): Promise<void> {
    try {
      const s = await firstValueFrom(this.recycleBin.getSettings());
      this.settings.set(s);
      this.syncSettingsForm(s);
    } catch {
      this.settings.set(null);
    }
  }

  /** Allinea i campi form ai valori correnti dalle settings backend. */
  private syncSettingsForm(s: RecycleBinSettings | null): void {
    if (s?.retentionDays === null || s?.retentionDays === undefined) {
      this.retentionIndefinite = true;
      this.retentionDaysInput = 30;
    } else {
      this.retentionIndefinite = false;
      this.retentionDaysInput = s.retentionDays;
    }
  }

  /** Toggle retention indefinita: se attivata, ignoriamo l'input numerico. */
  onRetentionIndefiniteChange(checked: boolean): void {
    if (checked) {
      // Ripristina il valore minimo nell'input ma resta disabilitato
      this.retentionDaysInput = this.settings()?.retentionDays ?? 30;
    }
  }

  /** Errore di validazione corrente sull'input retention, o null se valido. */
  retentionError(): string | null {
    if (this.retentionIndefinite) return null;
    const v = Number(this.retentionDaysInput);
    if (!Number.isFinite(v) || !Number.isInteger(v)) {
      return 'Inserisci un numero intero di giorni';
    }
    if (v < 30) return 'Minimo 30 giorni';
    return null;
  }

  /** True se i campi form differiscono dal valore corrente settings. */
  isSettingsDirty(): boolean {
    const current = this.settings();
    const formValue: number | null = this.retentionIndefinite
      ? null
      : Number(this.retentionDaysInput);
    const currentValue = current?.retentionDays ?? null;
    return formValue !== currentValue;
  }

  resetSettingsForm(): void {
    this.syncSettingsForm(this.settings());
  }

  async saveSettings(): Promise<void> {
    if (this.retentionError()) return;
    this.savingSettings.set(true);
    try {
      const newValue: number | null = this.retentionIndefinite
        ? null
        : Number(this.retentionDaysInput);
      const updated = await firstValueFrom(
        this.recycleBin.updateSettings(newValue),
      );
      this.settings.set(updated);
      this.syncSettingsForm(updated);
      this.snack.open('Impostazioni cestino aggiornate', 'Chiudi', {
        duration: 3000,
      });
      // Le righe in lista hanno scheduledPurgeAt calcolato lato backend con
      // la retention nuova: ricarico per riflettere il cambiamento.
      await this.reload();
    } catch (err: any) {
      this.snack.open(
        `Salvataggio fallito: ${err?.message ?? err}`,
        'Chiudi',
        { duration: 5000 },
      );
    } finally {
      this.savingSettings.set(false);
    }
  }

  async reload(): Promise<void> {
    this.loading.set(true);
    try {
      const result = await firstValueFrom(
        this.recycleBin.list({
          entityTypes:
            this.selectedTypes.length > 0 ? this.selectedTypes : undefined,
          search: this.searchText.trim() || undefined,
        }),
      );
      this.items.set(result);
    } catch (err: any) {
      this.snack.open(
        `Errore caricamento cestino: ${err?.message ?? err}`,
        'Chiudi',
        { duration: 5000 },
      );
      this.items.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  onSearchChange(): void {
    if (this.searchDebounce) clearTimeout(this.searchDebounce);
    this.searchDebounce = setTimeout(() => this.reload(), 300);
  }

  daysUntil(iso: string): string {
    const target = new Date(iso).getTime();
    const ms = target - Date.now();
    if (ms <= 0) return 'imminente';
    const days = Math.ceil(ms / (24 * 60 * 60 * 1000));
    if (days === 1) return 'tra 1 giorno';
    return `tra ${days} giorni`;
  }

  async onRestore(item: RecycleBinItem): Promise<void> {
    const ref = this.dialog.open(ConfirmDeleteDialogComponent, {
      data: {
        title: 'Ripristina elemento',
        message: `Vuoi ripristinare "${item.title}" dal cestino?`,
        confirmLabel: 'Ripristina',
        destructive: false,
      },
    });
    const ok = await firstValueFrom(ref.afterClosed());
    if (!ok) return;

    try {
      await firstValueFrom(this.recycleBin.restore(item.entityType, item.id));
      this.snack.open('Elemento ripristinato', 'Chiudi', { duration: 3000 });
      await this.reload();
    } catch (err: any) {
      this.snack.open(
        `Ripristino fallito: ${err?.message ?? err}`,
        'Chiudi',
        { duration: 5000 },
      );
    }
  }

  async onPurge(item: RecycleBinItem): Promise<void> {
    const ref = this.dialog.open(ConfirmDeleteDialogComponent, {
      data: {
        title: 'Eliminazione definitiva',
        message: `Stai per eliminare definitivamente "${item.title}".`,
        warning:
          'Operazione irreversibile. Il record e tutti i dati collegati saranno cancellati definitivamente dal database.',
        confirmLabel: 'Elimina definitivamente',
        destructive: true,
      },
    });
    const ok = await firstValueFrom(ref.afterClosed());
    if (!ok) return;

    try {
      await firstValueFrom(this.recycleBin.purge(item.entityType, item.id));
      this.snack.open('Elemento eliminato definitivamente', 'Chiudi', {
        duration: 3000,
      });
      await this.reload();
    } catch (err: any) {
      this.snack.open(
        `Eliminazione fallita: ${err?.message ?? err}`,
        'Chiudi',
        { duration: 5000 },
      );
    }
  }

  async emptyApplyRetention(): Promise<void> {
    const ref = this.dialog.open(ConfirmDeleteDialogComponent, {
      data: {
        title: 'Applica retention ora',
        message:
          'Eliminare definitivamente tutti gli elementi del cestino più vecchi della retention configurata.',
        warning: 'Operazione irreversibile.',
        confirmLabel: 'Applica retention',
        destructive: true,
      },
    });
    const ok = await firstValueFrom(ref.afterClosed());
    if (!ok) return;
    await this.runEmpty(false);
  }

  async emptyForce(): Promise<void> {
    const ref = this.dialog.open(ConfirmDeleteDialogComponent, {
      data: {
        title: 'Svuota tutto il cestino',
        message:
          'Eliminare definitivamente TUTTI gli elementi del cestino, ignorando la retention configurata.',
        warning:
          'Operazione irreversibile. Anche elementi cancellati di recente saranno eliminati.',
        confirmLabel: 'Svuota tutto',
        destructive: true,
      },
    });
    const ok = await firstValueFrom(ref.afterClosed());
    if (!ok) return;
    await this.runEmpty(true);
  }

  private async runEmpty(force: boolean): Promise<void> {
    try {
      const purged = await firstValueFrom(this.recycleBin.empty(force));
      this.snack.open(
        `${purged} elementi eliminati definitivamente`,
        'Chiudi',
        { duration: 4000 },
      );
      await this.reload();
    } catch (err: any) {
      this.snack.open(
        `Operazione fallita: ${err?.message ?? err}`,
        'Chiudi',
        { duration: 5000 },
      );
    }
  }
}
