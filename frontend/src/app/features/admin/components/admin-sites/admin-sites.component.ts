import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Observable, Subject, takeUntil } from 'rxjs';

import { SiteService } from '../../../sites/services/site.service';
import { Site } from '../../../sites/models/site.model';

/**
 * Sedi operative dello studio.
 *
 * Qui è il posto giusto perché il clinico è il **master** delle sedi: sono
 * loro a comparire negli eventi delle prestazioni, e da lì arrivano ai
 * documenti di accounting, che ne tiene una replica di sola lettura con lo
 * stesso identificativo.
 *
 * La colonna che conta è **Predefinita**: lato contabile quella sede usa la
 * numerazione GENERALE invece di una serie propria. Con una sede sola è
 * sempre lei, ed è la ragione per cui il flag esiste — due contatori per lo
 * stesso tipo di documento hanno già prodotto ricevute con lo stesso numero.
 */
@Component({
  selector: 'app-admin-sites',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatSnackBarModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sites-admin">
      <div class="header">
        <mat-icon class="header-icon">apartment</mat-icon>
        <div class="header-text">
          <h3>Sedi</h3>
          <p>
            Le sedi nascono qui e vengono replicate in contabilità con lo stesso
            identificativo. La sede <strong>predefinita</strong> è quella che, in
            contabilità, usa la numerazione generale dei documenti.
          </p>
        </div>
        <button mat-stroked-button [disabled]="resyncing"
                matTooltip="Ripubblica tutte le sedi verso il modulo contabilità (riallineamento)"
                (click)="resync()">
          <mat-icon>sync</mat-icon>
          Riallinea contabilità
        </button>
      </div>

      @if (loading) {
        <div class="loading"><mat-spinner diameter="36"></mat-spinner></div>
      } @else {
        <table mat-table [dataSource]="sites" class="sites-table">
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef>Nome</th>
            <td mat-cell *matCellDef="let s">
              @if (editingId === s.id) {
                <mat-form-field appearance="outline" subscriptSizing="dynamic" class="edit-field">
                  <input matInput [(ngModel)]="editingName" maxlength="255"
                         (keyup.enter)="saveName(s)" (keyup.escape)="cancelEdit()" />
                </mat-form-field>
              } @else {
                {{ s.name }}
              }
            </td>
          </ng-container>

          <ng-container matColumnDef="default">
            <th mat-header-cell *matHeaderCellDef style="width:230px">Numerazione contabile</th>
            <td mat-cell *matCellDef="let s">
              @if (s.isDefault) {
                <span class="badge-default">
                  <mat-icon class="badge-icon">star</mat-icon>
                  Predefinita &middot; serie generale
                </span>
              } @else {
                <button mat-button [disabled]="!s.isActive || saving"
                        matTooltip="Rendi questa la sede predefinita: userà la numerazione generale"
                        (click)="setDefault(s)">
                  Rendi predefinita
                </button>
              }
            </td>
          </ng-container>

          <ng-container matColumnDef="state">
            <th mat-header-cell *matHeaderCellDef style="width:130px">Stato</th>
            <td mat-cell *matCellDef="let s">
              <span [class.inactive]="!s.isActive">{{ s.isActive ? 'Attiva' : 'Disattivata' }}</span>
            </td>
          </ng-container>

          <ng-container matColumnDef="id">
            <th mat-header-cell *matHeaderCellDef>Identificativo</th>
            <td mat-cell *matCellDef="let s" class="mono">{{ s.id }}</td>
          </ng-container>

          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef style="width:120px"></th>
            <td mat-cell *matCellDef="let s" class="right">
              @if (editingId === s.id) {
                <button mat-icon-button color="primary" matTooltip="Salva" (click)="saveName(s)">
                  <mat-icon>check</mat-icon>
                </button>
                <button mat-icon-button matTooltip="Annulla" (click)="cancelEdit()">
                  <mat-icon>close</mat-icon>
                </button>
              } @else {
                <button mat-icon-button matTooltip="Rinomina" (click)="startEdit(s)">
                  <mat-icon>edit</mat-icon>
                </button>
                @if (s.isActive) {
                  <button mat-icon-button
                          [matTooltip]="s.isDefault
                            ? 'La sede predefinita non si disattiva: designane prima un\\'altra'
                            : 'Disattiva la sede'"
                          [disabled]="s.isDefault || saving"
                          (click)="setActive(s, false)">
                    <mat-icon>block</mat-icon>
                  </button>
                } @else {
                  <button mat-icon-button matTooltip="Riattiva la sede"
                          [disabled]="saving" (click)="setActive(s, true)">
                    <mat-icon>undo</mat-icon>
                  </button>
                }
              }
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr mat-row *matRowDef="let row; columns: columns"></tr>
        </table>

        <div class="new-site">
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Nuova sede</mat-label>
            <input matInput [(ngModel)]="newName" maxlength="255"
                   placeholder="es. Studio di Cuneo" (keyup.enter)="create()" />
          </mat-form-field>
          <button mat-flat-button color="primary"
                  [disabled]="!newName.trim() || saving" (click)="create()">
            <mat-icon>add</mat-icon>
            Aggiungi
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    .sites-admin { padding: 4px 0 16px; }
    .header { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 16px; }
    .header-icon { color: #1d4ed8; }
    .header-text { flex: 1; }
    .header-text h3 { margin: 0 0 4px; font-size: 16px; font-weight: 600; }
    .header-text p { margin: 0; font-size: 13px; color: #4b5563; max-width: 780px; }
    .loading { display: flex; justify-content: center; padding: 32px 0; }
    .sites-table { width: 100%; }
    .mono { font-family: monospace; font-size: 11px; color: #6b7280; }
    .right { text-align: right; }
    .inactive { color: #9ca3af; }
    .edit-field { width: 100%; }
    .badge-default {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 2px 8px; border-radius: 999px;
      background: #fef3c7; color: #92400e; font-size: 12px; font-weight: 500;
    }
    .badge-icon { font-size: 16px; width: 16px; height: 16px; }
    .new-site { display: flex; align-items: center; gap: 12px; margin-top: 20px; }
  `],
})
export class AdminSitesComponent implements OnInit, OnDestroy {
  private readonly siteService = inject(SiteService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();

  readonly columns = ['name', 'default', 'state', 'id', 'actions'];

  sites: Site[] = [];
  loading = true;
  saving = false;
  resyncing = false;

  editingId: string | null = null;
  editingName = '';
  newName = '';

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private load(): void {
    this.loading = true;
    this.siteService
      .getSites()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (sites) => {
          this.sites = sites;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.loading = false;
          this.fail(err, 'Errore nel caricamento delle sedi');
        },
      });
  }

  startEdit(site: Site): void {
    this.editingId = site.id;
    this.editingName = site.name;
  }

  cancelEdit(): void {
    this.editingId = null;
    this.editingName = '';
  }

  saveName(site: Site): void {
    const name = this.editingName.trim();
    if (!name || name === site.name) {
      this.cancelEdit();
      return;
    }
    this.run(this.siteService.updateSite(site.id, { name }), 'Sede rinominata', () =>
      this.cancelEdit(),
    );
  }

  setActive(site: Site, isActive: boolean): void {
    this.run(
      this.siteService.updateSite(site.id, { isActive }),
      isActive ? 'Sede riattivata' : 'Sede disattivata',
    );
  }

  setDefault(site: Site): void {
    this.run(this.siteService.setDefaultSite(site.id), `"${site.name}" è ora la sede predefinita`);
  }

  create(): void {
    const name = this.newName.trim();
    if (!name) return;
    this.run(this.siteService.createSite(name), 'Sede creata', () => (this.newName = ''));
  }

  resync(): void {
    this.resyncing = true;
    this.siteService
      .resyncToAccounting()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (n) => {
          this.resyncing = false;
          this.snackBar.open(`${n} sedi ripubblicate verso la contabilità.`, 'OK', {
            duration: 4000,
          });
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.resyncing = false;
          this.fail(err, 'Riallineamento fallito');
        },
      });
  }

  /** Ogni scrittura ricarica: la predefinita ne cambia sempre due insieme. */
  private run(op: Observable<unknown>, okMessage: string, after?: () => void): void {
    this.saving = true;
    op.pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.saving = false;
          after?.();
          this.snackBar.open(okMessage, 'OK', { duration: 3000 });
          this.load();
        },
        error: (err: unknown) => {
          this.saving = false;
          this.fail(err, 'Operazione fallita');
        },
      });
  }

  private fail(err: unknown, fallback: string): void {
    const message =
      (err as { message?: string })?.message?.replace(/^GraphQL error:\s*/, '') ?? fallback;
    this.snackBar.open(message || fallback, 'OK', { duration: 6000 });
    this.cdr.markForCheck();
  }
}
