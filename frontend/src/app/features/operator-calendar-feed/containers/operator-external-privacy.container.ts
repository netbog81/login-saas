/**
 * Operator External Privacy Container
 * Layer 2: Smart Component
 *
 * Coordina il blocco "Cosa vede l'operatore nel suo calendario", che vale sia
 * per il feed ICS sia per Google Calendar.
 *
 * Gli avvisi di riservatezza stanno qui e non nel pannello dumb perché sono
 * una decisione, non una resa grafica: chi accetta deve sapere cosa comporta,
 * e la conferma è ciò che rende la scelta consapevole.
 */

import {
  Component, Input, ChangeDetectionStrategy, ChangeDetectorRef, inject,
  OnInit, OnChanges, OnDestroy, SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject, takeUntil } from 'rxjs';

import {
  OperatorExternalPrivacyPanelComponent,
} from '../components/operator-external-privacy-panel/operator-external-privacy-panel.component';
import { OperatorCalendarFeedService } from '../services/operator-calendar-feed.service';
import { OperatorCalendarFeedStatus } from '../models/operator-calendar-feed.model';
import {
  ConfirmMatDialogComponent, ConfirmMatDialogData,
} from '../../../shared/components/confirm-mat-dialog/confirm-mat-dialog.component';

@Component({
  selector: 'app-operator-external-privacy',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, OperatorExternalPrivacyPanelComponent],
  template: `
    <app-operator-external-privacy-panel
      [showPatientName]="!!status?.showPatientName"
      [showPatientPhone]="!!status?.showPatientPhone"
      [loading]="loading"
      (patientNameToggle)="onPatientNameToggle($event)"
      (patientPhoneToggle)="onPatientPhoneToggle($event)">
    </app-operator-external-privacy-panel>
  `,
})
export class OperatorExternalPrivacyContainer implements OnInit, OnChanges, OnDestroy {
  @Input() operatorId: string | null = null;

  private destroy$ = new Subject<void>();
  private cdr = inject(ChangeDetectorRef);
  private feedService = inject(OperatorCalendarFeedService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);

  status: OperatorCalendarFeedStatus | null = null;
  loading = false;

  ngOnInit(): void {
    this.load();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['operatorId'] && !changes['operatorId'].firstChange) this.load();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private load(): void {
    if (!this.operatorId) return;
    this.loading = true;
    this.cdr.markForCheck();
    this.feedService.getStatus(this.operatorId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (status) => this.apply(status),
        error: () => {
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
  }

  /**
   * Nome del paziente nel calendario esterno.
   *
   * L'avviso copre entrambi i canali, che hanno rischi diversi e vanno detti
   * tutti e due: il feed ICS viaggia su un indirizzo senza password, Google
   * conserva i dati sui propri server. Disattivare non chiede nulla: verso il
   * più prudente non serve attrito.
   */
  async onPatientNameToggle(show: boolean): Promise<void> {
    if (!this.operatorId) return;

    if (show && !(await this.confirm({
      title: 'Mostrare il nome del paziente?',
      message:
        "I nomi dei pazienti finiranno nel calendario personale dell'operatore, "
        + 'e da lì nei backup del suo telefono e in ogni servizio con cui quel '
        + 'calendario è sincronizzato o condiviso.\n\n'
        + "Se usa il feed ICS, l'indirizzo del calendario non ha password: "
        + "chiunque lo abbia legge l'agenda con i nomi.\n"
        + 'Se usa Google Calendar, i dati vengono conservati sui server di Google.\n\n'
        + 'Sono dati sanitari. La scelta è a rischio e responsabilità '
        + "dell'operatore.\n\nVuoi attivarla comunque?",
      confirmText: 'Attiva, me ne assumo la responsabilità',
      cancelText: 'Lascia solo il servizio',
      confirmColor: 'warn',
      icon: 'privacy_tip',
    }))) {
      // Annullato: niente è stato inviato, il valore vero resta "spento".
      // Riferimento nuovo per far riallineare l'interruttore, che al clic si
      // era acceso da solo.
      this.status = this.status ? { ...this.status, showPatientName: false } : null;
      this.cdr.markForCheck();
      return;
    }

    this.run(
      this.feedService.setShowPatientName(this.operatorId, show),
      show ? 'Nome paziente attivato' : 'Nome paziente rimosso',
    );
  }

  /**
   * Telefono del paziente.
   *
   * Avviso separato da quello del nome perché è un'esposizione diversa: il
   * nome dice CHI, il numero permette di RAGGIUNGERLO, e insieme fanno del
   * calendario una rubrica di persone legate a uno studio sanitario.
   */
  async onPatientPhoneToggle(show: boolean): Promise<void> {
    if (!this.operatorId) return;

    if (show && !(await this.confirm({
      title: 'Mostrare i numeri di telefono?',
      message:
        'Cellulare e fisso compariranno nei dettagli degli appuntamenti futuri, '
        + "così l'operatore può chiamare il paziente direttamente dall'agenda.\n\n"
        + 'Pesa più del nome: chi avesse accesso a quel calendario si troverebbe '
        + 'in mano nomi e recapiti di persone che si rivolgono a uno studio '
        + 'sanitario.\n\n'
        + "La scelta è a rischio e responsabilità dell'operatore.\n\n"
        + 'Vuoi attivarla comunque?',
      confirmText: 'Attiva, me ne assumo la responsabilità',
      cancelText: 'Niente numeri',
      confirmColor: 'warn',
      icon: 'phone_disabled',
    }))) {
      this.status = this.status ? { ...this.status, showPatientPhone: false } : null;
      this.cdr.markForCheck();
      return;
    }

    this.run(
      this.feedService.setShowPatientPhone(this.operatorId, show),
      show ? 'Telefoni attivati' : 'Telefoni rimossi',
    );
  }

  private run(
    action: import('rxjs').Observable<OperatorCalendarFeedStatus>,
    message: string,
  ): void {
    this.loading = true;
    this.cdr.markForCheck();
    action.pipe(takeUntil(this.destroy$)).subscribe({
      next: (status) => {
        this.apply(status);
        // Il backend riporta subito la modifica anche su Google: l'operatore
        // non deve ricordarsi di premere "Sincronizza adesso".
        this.snackBar.open(`${message} — calendari aggiornati`, 'OK', { duration: 4000 });
      },
      error: (err: any) => {
        this.loading = false;
        this.cdr.markForCheck();
        this.snackBar.open(
          err?.graphQLErrors?.[0]?.message || 'Operazione non riuscita',
          'OK', { duration: 5000 },
        );
      },
    });
  }

  private apply(status: OperatorCalendarFeedStatus): void {
    this.status = status;
    this.loading = false;
    this.cdr.markForCheck();
  }

  private async confirm(data: ConfirmMatDialogData): Promise<boolean> {
    const ref = this.dialog.open(ConfirmMatDialogComponent, { width: '480px', data });
    const result = await new Promise<boolean | undefined>(resolve => {
      ref.afterClosed().pipe(takeUntil(this.destroy$)).subscribe(r => resolve(r));
    });
    return !!result;
  }
}
