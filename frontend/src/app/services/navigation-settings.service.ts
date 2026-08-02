import { Injectable, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { SettingsService } from './settings.service';

/** Chiavi general_settings per la visibilità dei link cross-modulo nel menu. */
export const NAV_SHOW_REGISTRY_KEY = 'navigation.showRegistryLink';
export const NAV_SHOW_ACCOUNTING_KEY = 'navigation.showAccountingLink';

/**
 * Visibilità per-tenant dei link cross-modulo (Anagrafiche / Contabilità)
 * nel menu principale. Stesso principio del toggle sidebar del registry
 * (`ui.show_dashboard_links`): fonte di verità unica nelle impostazioni
 * backend del modulo, il menu è solo consumer.
 *
 * Default true (link visibili): chiave assente o errore di caricamento non
 * nascondono mai le voci. La pagina Impostazioni chiama `apply()` dopo il
 * salvataggio così il menu si aggiorna senza reload.
 */
@Injectable({ providedIn: 'root' })
export class NavigationSettingsService {
  private readonly settings = inject(SettingsService);

  readonly showRegistryLink = signal(true);
  readonly showAccountingLink = signal(true);

  private loaded = false;

  /** Carica i valori dal backend, una sola volta per sessione. */
  load(): void {
    if (this.loaded) return;
    this.loaded = true;
    forkJoin({
      registry: this.settings.getSetting(NAV_SHOW_REGISTRY_KEY),
      accounting: this.settings.getSetting(NAV_SHOW_ACCOUNTING_KEY),
    }).subscribe({
      next: ({ registry, accounting }) => {
        if (registry) this.showRegistryLink.set(registry.value !== false);
        if (accounting) this.showAccountingLink.set(accounting.value !== false);
      },
      error: () => undefined,
    });
  }

  /** Applica i nuovi valori (dopo un salvataggio riuscito). */
  apply(showRegistryLink: boolean, showAccountingLink: boolean): void {
    this.showRegistryLink.set(showRegistryLink);
    this.showAccountingLink.set(showAccountingLink);
  }
}
