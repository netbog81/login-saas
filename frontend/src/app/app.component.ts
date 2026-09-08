import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatBadgeModule } from '@angular/material/badge';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ContextPreservationService } from './core/services/context-preservation.service';
import { OidcAuthService } from './core/auth/oidc-auth.service';
import { TenantResolverService } from './core/auth/tenant-resolver.service';
import { TaskMessageNotificationService } from './features/task-messages/services/task-message-notification.service';
import { TaskMessageDialogComponent } from './features/task-messages/containers/task-message-dialog.component';
import { ConflictService } from './features/conflicts/services/conflict.service';
import { NavigationSettingsService } from './services/navigation-settings.service';
import { WhatsappChatHostContainer } from './features/whatsapp-chat/containers/whatsapp-chat-host.container';
import { WhatsappChatStateService } from './features/whatsapp-chat/services/whatsapp-chat-state.service';
import {
  NewChatDialogComponent,
  NewChatDialogResult,
} from './features/whatsapp-chat/components/new-chat-dialog/new-chat-dialog.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    MatDividerModule,
    MatBadgeModule,
    MatDialogModule,
    MatTooltipModule,
    WhatsappChatHostContainer,
  ],
  template: `
    <div class="app-container">
      @if (authService.isAuthenticated()) {
        <nav class="app-nav">
          <div class="nav-brand">
            <h1>Curandis</h1>
          </div>
          <div class="nav-menu">
            @if (authService.hasRole(SEGRETERIA_ROLES)) {
              <a class="nav-item" routerLink="/calendar" routerLinkActive="active">
                Calendario
              </a>
            }
            @if (!authService.hasRole(SEGRETERIA_ROLES) && authService.hasRole(SELF_CALENDAR_ROLES)) {
              <a class="nav-item" routerLink="/calendar" routerLinkActive="active">
                Il mio calendario
              </a>
            }
            @if (registryUrl && navSettings.showRegistryLink() && authService.hasRole(SEGRETERIA_ROLES)) {
              <a class="nav-item" [href]="registryUrl" target="_blank" rel="noopener noreferrer">
                Anagrafiche
              </a>
            }
            @if (accountingUrl && navSettings.showAccountingLink() && authService.hasRole(SEGRETERIA_ROLES)) {
              <a class="nav-item" [href]="accountingUrl" target="_blank" rel="noopener noreferrer">
                Contabilità
              </a>
            }
            @if (authService.hasRole(SEGRETERIA_ROLES)) {
              <a class="nav-item" routerLink="/trattamenti" routerLinkActive="active">
                Trattamenti
              </a>
              <a class="nav-item" routerLink="/patients" routerLinkActive="active">
                Pazienti
              </a>
            }
            @if (authService.hasRole(OPERATORE_ROLES)) {
              <a class="nav-item" routerLink="/operatori-new" routerLinkActive="active">
                Operatori
              </a>
            }
            @if (authService.hasRole(ISTRUTTORE_ROLES)) {
              <a class="nav-item" routerLink="/istruttori" routerLinkActive="active">
                Istruttori
              </a>
            }
            @if (authService.hasRole(MEDICO_ROLES)) {
              <a class="nav-item" routerLink="/medico" routerLinkActive="active">
                Dashboard
              </a>
            }
            @if (authService.hasRole(SEGRETERIA_ROLES)) {
              <a class="nav-item" routerLink="/statistiche" routerLinkActive="active">
                Statistiche
              </a>
              <a class="nav-item" routerLink="/gestione-assenze" routerLinkActive="active">
                Assenze e disponibilità
              </a>
              <a class="nav-item" routerLink="/availability" routerLinkActive="active">
                Configurazioni
              </a>
              <a class="nav-item" routerLink="/conflicts" routerLinkActive="active">
                Conflitti
              </a>
            }
            @if (authService.hasRole(ADMIN_ROLES)) {
              <a class="nav-item" routerLink="/admin" routerLinkActive="active">
                Admin
              </a>
            }
            @if (authService.hasRole(SEGRETERIA_ROLES)) {
              <a class="nav-item" routerLink="/settings" routerLinkActive="active">
                Impostazioni
              </a>
            }
            @if (authService.hasRole(SEGRETERIA_ROLES)) {
              <a class="nav-item" routerLink="/whatsapp" routerLinkActive="active">
                WhatsApp
              </a>
            }
          </div>
          <div class="nav-actions">
            <button class="nav-item message-btn" (click)="openTaskMessages()"
              [matBadge]="taskMessageUnreadCount"
              [matBadgeHidden]="taskMessageUnreadCount === 0"
              matBadgeColor="warn"
              matBadgeSize="small"
              matBadgeOverlap="true">
              <mat-icon class="msg-icon">mail</mat-icon>
              <span class="msg-label">Messaggi</span>
            </button>

            <!-- Chat WhatsApp: sempre raggiungibile, anche dove la barra
                 laterale del calendario (che ospita "Chat in corso") non c'è. -->
            @if (authService.hasRole(SEGRETERIA_ROLES)) {
              <button class="nav-item message-btn" [matMenuTriggerFor]="chatMenu"
                [matBadge]="chatState.unreadTotal()"
                [matBadgeHidden]="chatState.unreadTotal() === 0"
                matBadgeColor="warn"
                matBadgeSize="small"
                matBadgeOverlap="true">
                <mat-icon class="msg-icon">forum</mat-icon>
                <span class="msg-label">Chat</span>
              </button>
              <mat-menu #chatMenu="matMenu" class="chat-quick-menu">
                <div class="chat-menu-title" (click)="$event.stopPropagation()">Chat in corso</div>
                @if (chatState.panelConversations().length === 0) {
                  <div class="chat-menu-empty" (click)="$event.stopPropagation()">
                    Nessuna chat in corso
                  </div>
                } @else {
                  @for (conversation of chatState.panelConversations(); track conversation.id) {
                    <div class="chat-menu-row">
                      <button mat-menu-item (click)="chatState.openConversation(conversation)">
                        <mat-icon>chat</mat-icon>
                        <span>{{ conversation.patientName || conversation.contactName || conversation.phoneNumber }}</span>
                        @if (conversation.unreadCount > 0) {
                          <span class="chat-menu-badge">{{ conversation.unreadCount }}</span>
                        }
                      </button>
                      <!-- Fuori dal mat-menu-item: un bottone dentro l'altro non
                           è valido e il click finirebbe comunque sulla voce. -->
                      <button class="chat-menu-remove" type="button"
                        [matTooltip]="conversation.unreadCount > 0
                          ? 'Segna come letta e togli dall\\'elenco'
                          : 'Togli dalle chat in corso'"
                        (click)="chatState.removeFromPanel(conversation); $event.stopPropagation()">
                        <mat-icon>close</mat-icon>
                      </button>
                    </div>
                  }
                }
                <mat-divider></mat-divider>
                <button mat-menu-item (click)="onNewChat()">
                  <mat-icon>add_comment</mat-icon>
                  <span>Nuova chat</span>
                </button>
                @if (chatState.panelConversations().length > 0) {
                  <button mat-menu-item (click)="onClearChatPanel()">
                    <mat-icon>playlist_remove</mat-icon>
                    <span>Svuota chat in corso</span>
                  </button>
                }
                <button mat-menu-item routerLink="/whatsapp">
                  <mat-icon>open_in_new</mat-icon>
                  <span>Apri tutte le conversazioni</span>
                </button>
              </mat-menu>
            }
          </div>
          <div class="nav-user">
            <button mat-button [matMenuTriggerFor]="userMenu" class="user-button">
              <mat-icon>account_circle</mat-icon>
              <span class="user-name">{{ authService.currentUser()?.name }}</span>
              <mat-icon>arrow_drop_down</mat-icon>
            </button>
            <mat-menu #userMenu="matMenu">
              <div class="menu-header" (click)="$event.stopPropagation()">
                <div class="menu-user-name">{{ authService.currentUser()?.name }}</div>
                <div class="menu-user-email">{{ authService.currentUser()?.email }}</div>
                <div class="menu-user-roles">
                  @for (role of authService.currentUser()?.roles; track role) {
                    <span class="role-chip">{{ role }}</span>
                  }
                </div>
              </div>
              <mat-divider></mat-divider>
              <button mat-menu-item (click)="onLogout()">
                <mat-icon>logout</mat-icon>
                <span>Esci</span>
              </button>
            </mat-menu>
          </div>
        </nav>
      }

      <main class="app-content">
        <router-outlet></router-outlet>
      </main>

      <!-- Finestre di chat WhatsApp: montate nella shell, non in una rotta,
           così cambiando pagina le conversazioni aperte non si chiudono. -->
      @if (authService.isAuthenticated() && authService.hasRole(SEGRETERIA_ROLES)) {
        <app-whatsapp-chat-host></app-whatsapp-chat-host>
      }
    </div>
  `,
  styles: [`
    .app-container {
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: auto;
    }

    .app-nav {
      background: #2c3e50;
      color: white;
      padding: 0 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      flex-shrink: 0;
      z-index: 100;
    }

    .nav-brand h1 {
      margin: 0;
      font-size: 20px;
      font-weight: 500;
    }

    .nav-menu {
      display: flex;
      gap: 0;
    }

    .nav-item {
      display: inline-block;
      background: none;
      border: none;
      color: rgba(255,255,255,0.8);
      padding: 10px 18px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      text-decoration: none;
      transition: all 0.2s;
      position: relative;
    }

    .nav-item:hover {
      background: rgba(255,255,255,0.1);
      color: white;
    }

    .nav-item.active {
      color: white;
      background: rgba(255,255,255,0.15);
    }

    .nav-item.active::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: #3498db;
    }

    .nav-actions {
      display: flex;
      align-items: center;
      margin-left: auto;
    }

    .message-btn {
      display: flex !important;
      align-items: center;
      gap: 4px;
    }
    .msg-icon { font-size: 20px; width: 20px; height: 20px; }

    /* Menu rapido chat WhatsApp */
    .chat-menu-title {
      padding: 10px 16px 4px;
      font-size: 12px;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .chat-menu-empty {
      padding: 4px 16px 10px;
      font-size: 13px;
      color: #94a3b8;
    }

    /* La X convive con la voce di menu: la voce si prende lo spazio, la X sta
       a destra e resta cliccabile senza aprire la chat. */
    .chat-menu-row {
      display: flex;
      align-items: center;

      .mat-mdc-menu-item {
        flex: 1 1 auto;
        min-width: 0;
      }
    }

    .chat-menu-remove {
      flex: 0 0 auto;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 30px;
      height: 30px;
      margin-right: 6px;
      padding: 0;
      border: none;
      border-radius: 50%;
      background: transparent;
      cursor: pointer;

      &:hover { background: rgba(0, 0, 0, 0.06); }

      mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
        color: #94a3b8;
      }
    }

    .chat-menu-badge {
      margin-left: auto;
      background: #25d366;
      color: #08312a;
      border-radius: 10px;
      min-width: 18px;
      height: 18px;
      padding: 0 5px;
      font-size: 11px;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .nav-user {
      flex-shrink: 0;
    }

    .user-button {
      color: rgba(255,255,255,0.9) !important;
    }

    .user-name {
      margin: 0 4px;
      font-size: 14px;
    }

    .menu-header {
      padding: 12px 16px;
    }

    .menu-user-name {
      font-weight: 500;
      font-size: 15px;
    }

    .menu-user-email {
      color: #666;
      font-size: 13px;
      margin-top: 2px;
    }

    .menu-user-roles {
      margin-top: 8px;
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
    }

    .role-chip {
      display: inline-block;
      background: #e3f2fd;
      color: #1565c0;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 11px;
      font-weight: 500;
    }

    .app-content {
      flex: 1;
      background: #f5f5f5;
      overflow-y: auto;
      min-height: 0;
    }

    @media (max-width: 768px) {
      .nav-brand h1 { font-size: 18px; }
      .nav-item { padding: 16px 12px; font-size: 13px; }
      .user-name { display: none; }
      .msg-label { display: none; }
    }
  `],
})
export class AppComponent implements OnInit, OnDestroy {
  readonly authService = inject(OidcAuthService);
  private readonly contextService = inject(ContextPreservationService);
  private readonly tenantResolver = inject(TenantResolverService);
  private readonly notificationService = inject(TaskMessageNotificationService);
  private readonly dialog = inject(MatDialog);
  private readonly conflictService = inject(ConflictService);
  readonly navSettings = inject(NavigationSettingsService);
  /** Stato delle chat WhatsApp: badge in barra e voci del menu rapido. */
  readonly chatState = inject(WhatsappChatStateService);
  private cleanupContext: (() => void) | null = null;

  taskMessageUnreadCount = 0;

  /**
   * Gruppi di ruoli per la visibilità dei link di navigazione.
   * `admin`/`amministratore`/`superadmin` sono trattati come admin globale
   * (vedono tutto) e quindi inclusi in ogni gruppo. Devono restare allineati
   * ai `data.roles` delle rispettive route in app.routes.ts.
   */
  readonly ADMIN_ROLES = ['admin', 'amministratore', 'superadmin', 'it_manager'];
  readonly SEGRETERIA_ROLES = ['segreteria', 'admin', 'amministratore', 'superadmin'];
  readonly OPERATORE_ROLES = ['operatore', 'admin', 'amministratore', 'superadmin'];
  readonly ISTRUTTORE_ROLES = ['istruttore', 'admin', 'amministratore', 'superadmin'];
  readonly MEDICO_ROLES = ['medico', 'admin', 'amministratore', 'superadmin'];
  /** Ruoli che vedono il proprio calendario read-only come home (/calendar). */
  readonly SELF_CALENDAR_ROLES = ['operatore', 'medico', 'istruttore'];

  /**
   * URL della sezione Contabilità nella suite unificata.
   * Es: tenant "bdq" -> https://gestione.bdq.curandis.cloud/contabilita
   * Null se non siamo su un sottodominio tenant valido (es: api., www., ...).
   *
   * NB: i link UI verso registry/accounting puntano alla SUITE
   * (gestione.{tenant}.curandis.cloud/anagrafiche|contabilita/...), non ai
   * moduli standalone: l'utente naviga tutto in un'unica interfaccia.
   * Vedi frontend/CLAUDE.md sezione "Link cross-modulo".
   */
  readonly accountingUrl: string | null = (() => {
    const alias = this.tenantResolver.getTenantAlias();
    return alias ? `https://gestione.${alias}.curandis.cloud/contabilita` : null;
  })();

  /**
   * URL della sezione Anagrafiche (registry) nella suite unificata.
   * Es: tenant "bdq" -> https://gestione.bdq.curandis.cloud/anagrafiche
   * Il registry resta il punto autoritativo per individui e organizzazioni:
   * clinico/contabilità ne prelevano i dati ma la creazione/modifica
   * avanzata si fa lì.
   */
  readonly registryUrl: string | null = (() => {
    const alias = this.tenantResolver.getTenantAlias();
    return alias ? `https://gestione.${alias}.curandis.cloud/anagrafiche` : null;
  })();

  ngOnInit(): void {
    this.cleanupContext = this.contextService.preserveContext('AppComponent');

    // Start polling for task message notifications when authenticated
    if (this.authService.isAuthenticated()) {
      this.notificationService.startPolling();

      // Visibilità dei link cross-modulo nel menu (impostazione per-tenant).
      this.navSettings.load();

      // Check pigro revalidazione conflitti: fire-and-forget, esegue solo
      // se sono passate ≥ 2h dall'ultimo check. Gira nel contesto HTTP del
      // tenant corrente (search_path corretto).
      this.conflictService
        .revalidateIfNeeded()
        .subscribe({
          next: (r) => {
            if (!r.skipped && r.resolved > 0) {
              console.log(`[Conflicts] Revalidazione: ${r.resolved} conflitti risolti automaticamente`);
            }
          },
          error: () => {}, // Silenzioso — non blocca il caricamento
        });
    }

    this.notificationService.unreadCount$.subscribe((count) => {
      this.taskMessageUnreadCount = count;
    });
  }

  ngOnDestroy(): void {
    this.cleanupContext?.();
  }

  private taskMessageDialogRef: import('@angular/material/dialog').MatDialogRef<any> | null = null;

  openTaskMessages(): void {
    if (this.taskMessageDialogRef) {
      return;
    }
    this.taskMessageDialogRef = this.dialog.open(TaskMessageDialogComponent, {
      width: '700px',
      height: '600px',
      hasBackdrop: false,
      panelClass: 'task-message-dialog-panel',
    });
    this.taskMessageDialogRef.afterClosed().subscribe(() => {
      this.taskMessageDialogRef = null;
    });
  }

  /** Apre la ricerca paziente e, scelto il paziente, ne apre la chat. */
  onNewChat(): void {
    this.dialog
      .open(NewChatDialogComponent, { autoFocus: false })
      .afterClosed()
      .subscribe((result: NewChatDialogResult | undefined) => {
        if (!result) return;
        this.chatState.openForPhone(result);
      });
  }

  /** Svuota le chat in corso, previa conferma: l'elenco non è recuperabile. */
  onClearChatPanel(): void {
    const count = this.chatState.panelConversations().length;
    if (count === 0) return;
    if (!confirm(`Vuoi togliere tutte le ${count} chat dall'elenco delle chat in corso?`)) return;
    this.chatState.clearPanel();
  }

  onLogout(): void {
    this.authService.logout();
  }
}
