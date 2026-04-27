import { Injectable, Injector, computed, signal } from '@angular/core';
import { Observable, firstValueFrom, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { BaseGraphQLService } from './base-graphql.service';
import { MY_PROFILE_QUERY } from '../../graphql/operations/my-profile.queries';

export interface MyProfile {
  appUserId: string;
  userType: string;
  operatorId: string | null;
  permissions: string[];
}

/**
 * Singleton frontend per autorizzazioni e ownership UI.
 *
 * Bootstrap: chiamare `loadProfile()` dopo il login (o in
 * `app-init.service`). Il profilo viene cachato in un signal.
 *
 * Uso nei componenti:
 *   readonly perms = inject(PermissionsService);
 *   readonly canDelete = computed(() => this.perms.canDelete(this.record()));
 *
 * Le decisioni sono "best-effort UI": il backend resta la fonte di verità,
 * ogni mutation è già protetta da AuthorizationGuard + OwnershipGuard.
 */
@Injectable({ providedIn: 'root' })
export class PermissionsService extends BaseGraphQLService {
  private readonly _profile = signal<MyProfile | null>(null);

  readonly profile = computed(() => this._profile());
  readonly appUserId = computed(() => this._profile()?.appUserId ?? null);
  readonly operatorId = computed(() => this._profile()?.operatorId ?? null);
  readonly permissions = computed(() => this._profile()?.permissions ?? []);
  readonly userType = computed(() => this._profile()?.userType ?? null);

  readonly isLoaded = computed(() => this._profile() !== null);

  constructor(injector: Injector) {
    super(injector);
  }

  /**
   * Carica il profilo dal backend. Idempotente: se già caricato non rifa
   * la chiamata salvo `force = true`.
   */
  loadProfile(force = false): Observable<MyProfile | null> {
    if (this._profile() && !force) {
      return of(this._profile());
    }
    return this.query<{ myProfile: MyProfile | null }>(MY_PROFILE_QUERY).pipe(
      map(r => r.myProfile),
      tap(profile => this._profile.set(profile)),
      catchError(() => {
        this._profile.set(null);
        return of(null);
      }),
    );
  }

  /** Versione promise per usi nei guard/init. */
  async ensureLoaded(): Promise<MyProfile | null> {
    if (this._profile()) return this._profile();
    return firstValueFrom(this.loadProfile());
  }

  /** L'utente ha un permesso specifico? */
  has(permission: string): boolean {
    return this.permissions().includes(permission);
  }

  /** L'utente ha almeno uno dei permessi? */
  hasAny(...permissions: string[]): boolean {
    const mine = this.permissions();
    return permissions.some(p => mine.includes(p));
  }

  /** L'utente è admin (ha permesso di bypass su delete trattamenti)? */
  readonly isAdmin = computed(() =>
    this.permissions().includes('treatment_delete_any'),
  );

  /**
   * Può modificare/eliminare un record di proprietà di un operatore?
   *
   * @param recordOwnerAppUserId - appUserId del proprietario, derivato
   *   sul frontend da `record.operator.appUserId` (per Treatment) o
   *   `record.primaryOperator.appUserId` (per TherapeuticPath).
   * @param requiredOwnPermission - permesso richiesto per agire sui propri
   *   (es. 'treatment_delete_own')
   * @param adminBypassPermission - permesso che bypassa l'ownership
   *   (es. 'treatment_delete_any')
   */
  canActOnRecord(
    recordOwnerAppUserId: string | null | undefined,
    requiredOwnPermission: string,
    adminBypassPermission: string,
  ): boolean {
    if (this.has(adminBypassPermission)) return true;
    if (!this.has(requiredOwnPermission)) return false;
    if (!recordOwnerAppUserId) return false;
    return this.appUserId() === recordOwnerAppUserId;
  }

  // ─── Shortcuts comuni ─────────────────────────────────────────

  canDeleteTreatment(ownerAppUserId: string | null | undefined): boolean {
    return this.canActOnRecord(
      ownerAppUserId,
      'treatment_delete_own',
      'treatment_delete_any',
    );
  }

  canDeleteTherapeuticPath(ownerAppUserId: string | null | undefined): boolean {
    return this.canActOnRecord(
      ownerAppUserId,
      'therapeutic_path_delete_own',
      'therapeutic_path_delete_any',
    );
  }

  /**
   * Operatore creatore: può modificare/completare/riaprire i propri
   * trattamenti. Stesso criterio di delete (own + bypass admin).
   */
  canEditTreatment(ownerAppUserId: string | null | undefined): boolean {
    if (this.has('treatment_delete_any')) return true;
    if (!this.has('treatment_write')) return false;
    if (!ownerAppUserId) return false;
    return this.appUserId() === ownerAppUserId;
  }

  canForceCloseTreatment(): boolean {
    return this.has('treatment_force_close');
  }

  canViewRecycleBin(): boolean {
    return this.has('recycle_bin_view');
  }

  canPurgeRecycleBin(): boolean {
    return this.has('recycle_bin_purge');
  }

  canManageRetention(): boolean {
    return this.has('recycle_bin_settings_manage');
  }

  /** Pulisce il profilo (es. al logout). */
  clear(): void {
    this._profile.set(null);
  }
}
