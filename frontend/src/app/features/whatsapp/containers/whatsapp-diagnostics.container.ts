/**
 * Whatsapp Diagnostics Container
 * Layer 2: Smart Component
 *
 * Tiene la finestra temporale, la selezione e il reinvio.
 */

import {
  Component, ChangeDetectionStrategy, ChangeDetectorRef, inject, OnInit, OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject, takeUntil } from 'rxjs';

import { DiagnosticsPanelComponent } from '../components/diagnostics-panel/diagnostics-panel.component';
import { WhatsappDiagnosticsService } from '../services/whatsapp-diagnostics.service';
import {
  PatientNotificationIssues, PhoneNumberIssue, WhatsappDiagnostics,
} from '../models/whatsapp-diagnostics.model';
import {
  ConfirmMatDialogComponent,
} from '../../../shared/components/confirm-mat-dialog/confirm-mat-dialog.component';

@Component({
  selector: 'app-whatsapp-diagnostics',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, DiagnosticsPanelComponent],
  template: `
    <app-diagnostics-panel
      [data]="data"
      [loading]="loading"
      [resending]="resending"
      [error]="error"
      [selected]="selected"
      (windowChange)="onWindow($event)"
      (refresh)="load()"
      (resend)="onResend()"
      (toggleOne)="onToggleOne($event)"
      (toggleGroup)="onToggleGroup($event)"
      (toggleAll)="onToggleAll($event)"
      (openSettings)="goToSettings()"
      (applyRegistryPhone)="onApplyRegistryPhone($event)">
    </app-diagnostics-panel>
  `,
})
export class WhatsappDiagnosticsContainer implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private cdr = inject(ChangeDetectorRef);
  private service = inject(WhatsappDiagnosticsService);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);
  private router = inject(Router);

  data: WhatsappDiagnostics | null = null;
  loading = false;
  resending = false;
  error: string | null = null;
  windowDays = 7;

  /**
   * Ricreato a ogni modifica, mai mutato sul posto: il pannello è OnPush e
   * con lo stesso riferimento non ridisegnerebbe niente — le caselle
   * resterebbero come sono mentre il conteggio cambia.
   */
  selected = new Set<string>();

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  load(): void {
    this.loading = true;
    this.error = null;
    this.cdr.markForCheck();

    this.service.diagnose(this.windowDays).pipe(takeUntil(this.destroy$)).subscribe({
      next: (data) => {
        this.data = data;
        // Una selezione fatta su un elenco che non c'è più manderebbe
        // messaggi a chi nel frattempo è stato sistemato.
        this.selected = new Set<string>();
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err: any) => {
        this.loading = false;
        this.error = err?.graphQLErrors?.[0]?.message || err?.message || 'Errore imprevisto';
        this.cdr.markForCheck();
      },
    });
  }

  onWindow(days: number): void {
    this.windowDays = days;
    this.load();
  }

  onToggleOne(id: string): void {
    const next = new Set(this.selected);
    next.has(id) ? next.delete(id) : next.add(id);
    this.selected = next;
    this.cdr.markForCheck();
  }

  onToggleGroup(g: PatientNotificationIssues): void {
    const ids = g.appointments.filter(a => !a.unreachable).map(a => a.appointmentId);
    const tuttiDentro = ids.every(id => this.selected.has(id));
    const next = new Set(this.selected);
    for (const id of ids) tuttiDentro ? next.delete(id) : next.add(id);
    this.selected = next;
    this.cdr.markForCheck();
  }

  onToggleAll(checked: boolean): void {
    if (!checked) {
      this.selected = new Set<string>();
    } else {
      this.selected = new Set(
        (this.data?.groups ?? [])
          .flatMap(g => g.appointments)
          .filter(a => !a.unreachable)
          .map(a => a.appointmentId),
      );
    }
    this.cdr.markForCheck();
  }

  /**
   * Conferma prima di mandare.
   *
   * Non è una formalità: sono messaggi veri a persone vere, alcune delle
   * quali possono già essere state avvisate al telefono. Il testo dice quante
   * persone e quanti messaggi — che non sono lo stesso numero — e quanto ci
   * vorrà, perché il ritmo lento è voluto e chi guarda non deve pensare che
   * si sia inceppato.
   */
  onResend(): void {
    const ids = [...this.selected];
    if (!ids.length) return;

    const scelti = (this.data?.groups ?? [])
      .flatMap(g => g.appointments)
      .filter(a => this.selected.has(a.appointmentId));

    const gruppiScelti = (this.data?.groups ?? []).filter(
      g => g.appointments.some(a => this.selected.has(a.appointmentId)),
    );
    const persone = gruppiScelti.length;

    // Due modi diversi di non poter essere raggiunti, e vale la pena saperlo
    // prima di aspettarsi che arrivi qualcosa: il numero scritto male fa
    // fallire l'invio con certezza, quello sconosciuto probabilmente.
    const numeroRotto = gruppiScelti.filter(g => g.contactState === 'INVALID').length;
    const senzaNumero = gruppiScelti.filter(g => g.contactState === 'NO_CONTACT').length;

    // Le disdette non ricevono una conferma ma l'avviso di disdetta: dirlo
    // qui, perché "rimanda le conferme" su un appuntamento annullato
    // suonerebbe come stare per dire al paziente l'opposto della verità.
    const disdette = scelti.filter(a => a.kind === 'CANCELLED_NOT_NOTIFIED').length;

    // ~10s fra un messaggio automatico e l'altro, più la finestra di
    // raggruppamento del gateway.
    const minuti = Math.max(1, Math.ceil((persone * 12 + 180) / 60));

    this.dialog
      .open(ConfirmMatDialogComponent, {
        width: '480px',
        data: {
          title: 'Rimandare le conferme?',
          icon: 'send',
          confirmText: 'Rimanda',
          cancelText: 'Annulla',
          message:
            `Verranno riavvisate ${persone} ` +
            `${persone === 1 ? 'persona' : 'persone'} per ${ids.length} ` +
            `${ids.length === 1 ? 'appuntamento' : 'appuntamenti'}.\n\n` +
            'Ognuna riceve un solo riepilogo con tutti i suoi appuntamenti, non ' +
            'un messaggio per appuntamento. I messaggi escono distanziati per non ' +
            `far bloccare il numero: serviranno circa ${minuti} minuti.\n\n` +
            (disdette
              ? `Di questi, ${disdette} ` +
                `${disdette === 1 ? 'è un appuntamento disdetto e riceverà' : 'sono appuntamenti disdetti e riceveranno'} ` +
                'l\'avviso di disdetta, non una conferma.\n\n'
              : '') +
            (numeroRotto
              ? `Attenzione: per ${numeroRotto} ` +
                `${numeroRotto === 1 ? 'persona il telefono sull\'appuntamento non è' : 'persone il telefono sull\'appuntamento non è'} ` +
                'un numero valido. Per loro il reinvio fallirà di sicuro finché ' +
                'non lo correggi sull\'appuntamento.\n\n'
              : '') +
            (senzaNumero
              ? `Per ${senzaNumero} ` +
                `${senzaNumero === 1 ? 'persona in anagrafica non c\'è' : 'persone in anagrafica non c\'è'} ` +
                'nessun numero: il reinvio non può arrivare finché non lo aggiungi.\n\n'
              : '') +
            'Lo stato di ogni appuntamento viene ricontrollato al momento ' +
            'dell\'invio: quelli disdetti o spostati nel frattempo vengono ' +
            'saltati o corretti da soli.\n\n' +
            'Chi è già stato avvisato a voce lo riceverà comunque: se serve, ' +
            'togli la spunta prima di procedere.',
        },
      })
      .afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe((ok) => { if (ok) this.doResend(ids); });
  }

  private doResend(ids: string[]): void {
    this.resending = true;
    this.cdr.markForCheck();

    this.service.resend(ids).pipe(takeUntil(this.destroy$)).subscribe({
      next: (outcome) => {
        this.resending = false;
        const msg = outcome.errors.length
          ? `${outcome.dispatched} accodati, ${outcome.skipped} non riusciti: ${outcome.errors[0]}`
          : `${outcome.dispatched} accodati. Escono nei prossimi minuti.`;
        this.snackBar.open(msg, 'OK', { duration: outcome.errors.length ? 12000 : 7000 });
        // Si ricontrolla: i log ora esistono e le righe riparate spariscono
        // dall'elenco da sole, senza doversi fidare della parola del server.
        this.load();
      },
      error: (err: any) => {
        this.resending = false;
        this.cdr.markForCheck();
        this.snackBar.open(
          err?.graphQLErrors?.[0]?.message || 'Reinvio non riuscito',
          'OK', { duration: 8000 },
        );
      },
    });
  }

  /**
   * Riporta il numero dell'anagrafica su tutti gli appuntamenti futuri.
   *
   * Con conferma perche' e' una scrittura sui dati del paziente, e mostrando
   * entrambi i valori: il numero sbagliato puo' contenerne uno vero e diverso
   * — "349… moglie" e' il numero di un'altra persona — e sostituirlo cambia
   * chi verra' contattato. Va visto prima, non dopo.
   */
  onApplyRegistryPhone(p: PhoneNumberIssue): void {
    this.dialog
      .open(ConfirmMatDialogComponent, {
        width: '480px',
        data: {
          title: 'Usare il numero dell\'anagrafica?',
          icon: 'sync_alt',
          confirmText: 'Sostituisci',
          cancelText: 'Annulla',
          message:
            `Su ${p.appointments} ` +
            `${p.appointments === 1 ? 'appuntamento futuro' : 'appuntamenti futuri'} ` +
            `di ${p.patientName || 'questa persona'}:\n\n` +
            `adesso c'è   "${p.clientPhone}"\n` +
            `diventerà    "${p.registryPhone}"\n\n` +
            'Se i due numeri sono diversi, cambierà anche a chi arrivano i ' +
            'messaggi: controlla che sia quello giusto prima di procedere.\n\n' +
            'Gli appuntamenti già passati non vengono toccati.',
        },
      })
      .afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe((ok) => {
        if (!ok) return;
        this.service.applyRegistryPhone(p.clientPhone)
          .pipe(takeUntil(this.destroy$)).subscribe({
            next: (quanti) => {
              this.snackBar.open(
                `Numero aggiornato su ${quanti} appuntamenti.`, 'OK', { duration: 6000 },
              );
              this.load();
            },
            error: (err: any) => this.snackBar.open(
              err?.graphQLErrors?.[0]?.message || 'Operazione non riuscita',
              'OK', { duration: 8000 },
            ),
          });
      });
  }

  goToSettings(): void {
    this.router.navigate(['/whatsapp/settings']);
  }
}
