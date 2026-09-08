import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';

import {
  PermissionsAdminService, PermissionRow, RoleWithPermissions, DenialSummary,
} from './permissions.service';

/** Finestre offerte dal monitoraggio. Oltre i 90 giorni la retention ha già potato. */
const WINDOWS = [1, 7, 30, 90] as const;

/**
 * Permessi e accessi negati.
 *
 * Due metà della stessa domanda, e per questo stanno nella stessa scheda:
 * sopra "chi può fare cosa", sotto "chi ha provato e non ha potuto". Separarle
 * significherebbe leggere un rifiuto in una pagina e doverne aprire un'altra
 * per rimediare.
 *
 * La matrice è ruoli in colonna e permessi in riga: i ruoli sono otto e stabili,
 * i permessi crescono a ogni funzione nuova. Mettere i permessi in riga vuol
 * dire che la tabella si allunga, non che sfugge di lato.
 */
@Component({
  selector: 'app-admin-permissions',
  standalone: true,
  imports: [
    CommonModule, MatIconModule, MatButtonModule, MatCheckboxModule,
    MatProgressSpinnerModule, MatButtonToggleModule, MatTooltipModule,
  ],
  template: `
    <div class="perm-page">

      <!-- ── Matrice ruoli × permessi ─────────────────────────────── -->
      <section class="card">
        <header class="card-head">
          <div>
            <h3>Chi può fare cosa</h3>
            <p class="sub">
              Ogni casella è un permesso dato a un ruolo. Vale subito, per tutti
              gli utenti che hanno quel ruolo: non serve che rifacciano l'accesso.
            </p>
          </div>
          <button mat-stroked-button (click)="reloadMatrix()" [disabled]="loadingMatrix()">
            <mat-icon>refresh</mat-icon> Ricarica
          </button>
        </header>

        @if (loadingMatrix()) {
          <div class="state"><mat-spinner diameter="28"></mat-spinner></div>
        } @else if (matrixError()) {
          <div class="state error">
            <mat-icon>error_outline</mat-icon>
            <span>{{ matrixError() }}</span>
          </div>
        } @else {
          <div class="matrix-scroll">
            <table class="matrix">
              <thead>
                <tr>
                  <th class="perm-col">Permesso</th>
                  @for (role of roles(); track role.id) {
                    <th class="role-col" [matTooltip]="role.description || ''">
                      {{ role.name }}
                    </th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (perm of permissions(); track perm.id) {
                  <tr [class.orphan]="isOrphan(perm)">
                    <td class="perm-col">
                      <span class="perm-name">{{ perm.name }}</span>
                      @if (perm.description) {
                        <span class="perm-desc">{{ perm.description }}</span>
                      }
                      @if (isOrphan(perm)) {
                        <span class="perm-warn">
                          <mat-icon>report_problem</mat-icon>
                          Nessun ruolo lo ha: chi serve non può fare questa cosa
                        </span>
                      }
                    </td>
                    @for (role of roles(); track role.id) {
                      <td class="cell">
                        <mat-checkbox
                          [checked]="has(role.id, perm.id)"
                          [disabled]="busy().has(key(role.id, perm.id))"
                          (change)="onToggle(role, perm, $event.checked)">
                        </mat-checkbox>
                      </td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <p class="note">
            <mat-icon>info</mat-icon>
            <span>
              I permessi non si creano da qui: uno nuovo serve solo se il codice
              lo controlla, e nasce insieme a quel codice. Qui si decide chi ce l'ha.
            </span>
          </p>
        }
      </section>

      <!-- ── Monitoraggio dei rifiuti ─────────────────────────────── -->
      <section class="card">
        <header class="card-head">
          <div>
            <h3>Accessi negati</h3>
            <p class="sub">
              Chi ha provato a fare qualcosa e si è visto rifiutare. Raggruppati
              per persona e permesso: righe ripetute sono una persona bloccata,
              non tanti problemi diversi.
            </p>
          </div>
          <div class="head-actions">
            <mat-button-toggle-group [value]="days()" (change)="onDaysChange($event.value)">
              @for (w of windows; track w) {
                <mat-button-toggle [value]="w">{{ w }}g</mat-button-toggle>
              }
            </mat-button-toggle-group>
            <button mat-stroked-button (click)="reloadDenials()" [disabled]="loadingDenials()">
              <mat-icon>refresh</mat-icon>
            </button>
          </div>
        </header>

        @if (loadingDenials()) {
          <div class="state"><mat-spinner diameter="28"></mat-spinner></div>
        } @else if (denialsError()) {
          <div class="state error">
            <mat-icon>error_outline</mat-icon>
            <span>{{ denialsError() }}</span>
          </div>
        } @else if (denials().length === 0) {
          <div class="state empty">
            <mat-icon>check_circle</mat-icon>
            <span>Nessun accesso negato negli ultimi {{ days() }} giorni.</span>
          </div>
        } @else {
          <table class="denials">
            <thead>
              <tr>
                <th>Utente</th>
                <th>Permesso mancante</th>
                <th class="num">Volte</th>
                <th>Ultima</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (d of denials(); track d.keycloakId + d.permission) {
                <tr>
                  <td>
                    <span class="who">{{ d.email || d.keycloakId || '—' }}</span>
                    @if (d.reason === 'user_not_found') {
                      <span class="tag warn" matTooltip="Il token è valido ma in questo studio non esiste un utente collegato">
                        utente non collegato
                      </span>
                    }
                  </td>
                  <td><code>{{ d.permission }}</code></td>
                  <td class="num">{{ d.count }}</td>
                  <td>{{ d.lastOccurredAt | date:'dd/MM/yyyy HH:mm' }}</td>
                  <td class="right">
                    <button mat-icon-button (click)="toggleDetail(d)"
                            [matTooltip]="isOpen(d) ? 'Chiudi' : 'Dove ha sbattuto'">
                      <mat-icon>{{ isOpen(d) ? 'expand_less' : 'expand_more' }}</mat-icon>
                    </button>
                  </td>
                </tr>
                @if (isOpen(d)) {
                  <tr class="detail-row">
                    <td colspan="5">
                      <ul class="ops">
                        @for (op of d.operations; track op.operation) {
                          <li><code>{{ op.operation }}</code> <span class="times">{{ op.count }}×</span></li>
                        }
                      </ul>
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>

          <p class="note">
            <mat-icon>schedule</mat-icon>
            <span>Lo storico si conserva 90 giorni, poi viene potato da solo.</span>
          </p>
        }
      </section>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .perm-page { display: flex; flex-direction: column; gap: 16px; padding: 4px; }

    .card {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 16px;
    }
    .card-head {
      display: flex; align-items: flex-start; justify-content: space-between;
      gap: 16px; margin-bottom: 12px; flex-wrap: wrap;
    }
    .card-head h3 { margin: 0; font-size: 1.05rem; color: #0f172a; }
    .sub { margin: 4px 0 0; font-size: .82rem; color: #64748b; max-width: 62ch; line-height: 1.45; }
    .head-actions { display: flex; align-items: center; gap: 8px; }

    .state {
      display: flex; align-items: center; justify-content: center; gap: 8px;
      padding: 28px; color: #64748b; font-size: .88rem;
    }
    .state.error { color: #b91c1c; }
    .state.empty { color: #15803d; }

    .matrix-scroll { overflow-x: auto; }
    .matrix { border-collapse: collapse; width: 100%; font-size: .84rem; }
    .matrix th, .matrix td { border-bottom: 1px solid #eef2f7; padding: 8px 6px; }
    .matrix thead th {
      position: sticky; top: 0; background: #f8fafc; z-index: 1;
      font-weight: 600; color: #334155; text-align: center; white-space: nowrap;
    }
    .matrix .perm-col {
      text-align: left; min-width: 260px;
      position: sticky; left: 0; background: #fff; z-index: 2;
    }
    .matrix thead .perm-col { background: #f8fafc; z-index: 3; }
    .matrix .role-col { min-width: 92px; }
    .matrix .cell { text-align: center; }
    .matrix tbody tr:hover .perm-col,
    .matrix tbody tr:hover { background: #f8fafc; }

    .perm-name { display: block; font-family: monospace; color: #0f172a; }
    .perm-desc { display: block; font-size: .74rem; color: #64748b; margin-top: 1px; }
    .perm-warn {
      display: inline-flex; align-items: center; gap: 4px;
      font-size: .72rem; color: #b45309; margin-top: 3px;
    }
    .perm-warn mat-icon { font-size: 14px; width: 14px; height: 14px; }
    tr.orphan .perm-name { color: #b45309; }

    .denials { width: 100%; border-collapse: collapse; font-size: .85rem; }
    .denials th {
      text-align: left; font-weight: 600; color: #334155;
      border-bottom: 1px solid #e2e8f0; padding: 8px 6px;
    }
    .denials td { border-bottom: 1px solid #f1f5f9; padding: 8px 6px; vertical-align: middle; }
    .denials .num { text-align: right; width: 70px; }
    .denials .right { text-align: right; width: 48px; }
    .who { color: #0f172a; }
    .tag {
      display: inline-block; margin-left: 6px; padding: 1px 7px;
      border-radius: 10px; font-size: .7rem;
    }
    .tag.warn { background: #fef3c7; color: #92400e; }
    .detail-row td { background: #f8fafc; }
    .ops { margin: 0; padding: 4px 0 4px 18px; }
    .ops li { padding: 2px 0; color: #475569; }
    .times { color: #94a3b8; margin-left: 6px; }
    code { font-family: monospace; font-size: .82rem; color: #1e293b; }

    .note {
      display: flex; align-items: flex-start; gap: 6px;
      font-size: .76rem; color: #475569; background: #f1f5f9;
      border-radius: 6px; padding: 8px 10px; margin: 12px 0 0;
    }
    .note mat-icon { font-size: 17px; width: 17px; height: 17px; flex: 0 0 auto; }
  `],
})
export class AdminPermissionsComponent implements OnInit {
  private readonly service = inject(PermissionsAdminService);
  private readonly snackBar = inject(MatSnackBar);

  readonly windows = WINDOWS;

  roles = signal<RoleWithPermissions[]>([]);
  permissions = signal<PermissionRow[]>([]);
  /** Coppie attive, come `roleId|permissionId`. */
  granted = signal<Set<string>>(new Set());
  /** Caselle con una chiamata in volo: si disattivano per non farne partire due. */
  busy = signal<Set<string>>(new Set());
  loadingMatrix = signal(false);
  matrixError = signal<string | null>(null);

  denials = signal<DenialSummary[]>([]);
  loadingDenials = signal(false);
  denialsError = signal<string | null>(null);
  days = signal<number>(7);
  private openRows = signal<Set<string>>(new Set());

  /** Permessi che nessun ruolo porta: quasi sempre un permesso nuovo mai assegnato. */
  private orphans = computed(() => {
    const used = new Set<string>();
    for (const k of this.granted()) used.add(k.split('|')[1]);
    return new Set(this.permissions().filter(p => !used.has(p.id)).map(p => p.id));
  });

  ngOnInit(): void {
    this.reloadMatrix();
    this.reloadDenials();
  }

  key(roleId: string, permissionId: string): string {
    return `${roleId}|${permissionId}`;
  }

  has(roleId: string, permissionId: string): boolean {
    return this.granted().has(this.key(roleId, permissionId));
  }

  isOrphan(perm: PermissionRow): boolean {
    return this.orphans().has(perm.id);
  }

  async reloadMatrix(): Promise<void> {
    this.loadingMatrix.set(true);
    this.matrixError.set(null);
    try {
      const data = await firstValueFrom(this.service.getMatrix());
      this.roles.set(data.roles);
      this.permissions.set([...data.permissions].sort((a, b) => a.name.localeCompare(b.name)));
      const set = new Set<string>();
      for (const role of data.roles) {
        for (const rp of role.rolePermissions ?? []) {
          if (rp?.permission) set.add(this.key(role.id, rp.permission.id));
        }
      }
      this.granted.set(set);
    } catch (err: any) {
      this.matrixError.set(err?.message || 'Impossibile leggere permessi e ruoli');
    } finally {
      this.loadingMatrix.set(false);
    }
  }

  /**
   * La casella cambia subito e si rimette a posto da sola se il server rifiuta.
   * Aspettare la risposta per una spunta darebbe l'impressione che sia rotta.
   */
  async onToggle(role: RoleWithPermissions, perm: PermissionRow, checked: boolean): Promise<void> {
    const k = this.key(role.id, perm.id);
    this.setGranted(k, checked);
    this.setBusy(k, true);
    try {
      if (checked) {
        await firstValueFrom(this.service.grant(role.id, perm.id));
      } else {
        await firstValueFrom(this.service.revoke(role.id, perm.id));
      }
      this.snackBar.open(
        checked
          ? `${role.name} adesso ha ${perm.name}`
          : `${role.name} non ha più ${perm.name}`,
        'OK', { duration: 3000 },
      );
    } catch (err: any) {
      this.setGranted(k, !checked);
      this.snackBar.open(err?.message || 'Modifica non riuscita', 'OK', { duration: 6000 });
    } finally {
      this.setBusy(k, false);
    }
  }

  onDaysChange(value: number): void {
    this.days.set(value);
    this.reloadDenials();
  }

  async reloadDenials(): Promise<void> {
    this.loadingDenials.set(true);
    this.denialsError.set(null);
    try {
      this.denials.set(await firstValueFrom(this.service.getDenials(this.days())));
    } catch (err: any) {
      this.denialsError.set(err?.message || 'Impossibile leggere lo storico');
    } finally {
      this.loadingDenials.set(false);
    }
  }

  isOpen(d: DenialSummary): boolean {
    return this.openRows().has(this.rowKey(d));
  }

  toggleDetail(d: DenialSummary): void {
    const next = new Set(this.openRows());
    const k = this.rowKey(d);
    next.has(k) ? next.delete(k) : next.add(k);
    this.openRows.set(next);
  }

  private rowKey(d: DenialSummary): string {
    return `${d.keycloakId ?? d.email ?? ''}|${d.permission}`;
  }

  private setGranted(k: string, on: boolean): void {
    const next = new Set(this.granted());
    on ? next.add(k) : next.delete(k);
    this.granted.set(next);
  }

  private setBusy(k: string, on: boolean): void {
    const next = new Set(this.busy());
    on ? next.add(k) : next.delete(k);
    this.busy.set(next);
  }
}
