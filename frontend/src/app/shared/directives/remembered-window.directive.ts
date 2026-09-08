/**
 * Ricorda posizione e dimensione di una finestra trascinabile.
 *
 * Le finestre del gestionale (Trattamenti, Gestisci Appuntamenti, Scheda
 * Paziente, appuntamento…) si trascinano e si ridimensionano, ma alla
 * riapertura tornavano al centro con la misura di default: chi lavora tutto il
 * giorno con due riquadri affiancati doveva risistemarli ogni volta.
 *
 * Va messa sullo stesso elemento del `cdkDrag` della barra del titolo:
 *
 *   <div class="dialog-title-bar" cdkDrag
 *        cdkDragRootElement=".xyz-pane"
 *        appRememberedWindow="appuntamenti" rememberedWindowPane=".xyz-pane">
 *
 * La memoria è per utente e per finestra: su un PC di segreteria condiviso,
 * chi entra dopo trova il proprio ingombro, non quello del collega.
 */

import {
  Directive, Input, AfterViewInit, OnDestroy, inject, NgZone, Injector,
  afterNextRender,
} from '@angular/core';
import { CdkDrag } from '@angular/cdk/drag-drop';
import { AuthService } from '../../core/auth/auth.service';

interface WindowGeometry {
  x: number;
  y: number;
  width?: number;
  height?: number;
}

const STORAGE_PREFIX = 'curandis.window';
/** Margine minimo dal bordo: una finestra non deve poter sparire fuori schermo. */
const VIEWPORT_MARGIN = 8;

@Directive({
  selector: '[appRememberedWindow]',
  standalone: true,
})
export class RememberedWindowDirective implements AfterViewInit, OnDestroy {
  /** Nome della finestra: identifica la memoria. */
  @Input('appRememberedWindow') windowKey = '';
  /** Selettore del pane dell'overlay (lo stesso di cdkDragRootElement). */
  @Input() rememberedWindowPane = '';

  private readonly drag = inject(CdkDrag, { optional: true });
  private readonly zone = inject(NgZone);
  private readonly auth = inject(AuthService);
  private readonly injector = inject(Injector);

  private pane: HTMLElement | null = null;
  private resizeObserver?: ResizeObserver;
  private saveTimer?: ReturnType<typeof setTimeout>;
  private dragSub?: { unsubscribe(): void };

  ngAfterViewInit(): void {
    if (!this.windowKey || !this.rememberedWindowPane) return;
    this.pane = document.querySelector<HTMLElement>(this.rememberedWindowPane);
    if (!this.pane) return;

    // L'ingombro si può applicare subito: tocca il pane direttamente.
    this.restoreSize();

    // La POSIZIONE no. `CdkDrag` risolve `cdkDragRootElement` dentro un
    // `afterNextRender`, non nel proprio `ngAfterViewInit`: qui la sua root è
    // ancora la barra del titolo, e `setFreeDragPosition` scriverebbe la
    // trasformazione SULLA BARRA. Il cambio di root che avviene subito dopo
    // NON ripulisce quella trasformazione (`withRootElement` sostituisce
    // l'elemento e basta), quindi la barra resta scollata dal riquadro per
    // tutta la sessione — l'effetto che si vedeva sulla finestra Trattamenti
    // di chi l'aveva spostata almeno una volta.
    afterNextRender(() => this.restorePositionWhenRootReady(), {
      injector: this.injector,
    });

    // Salvataggio a fine trascinamento: durante il drag sarebbe una scrittura
    // in localStorage a ogni frame.
    this.dragSub = this.drag?.ended.subscribe(() => this.scheduleSave());

    // Il ridimensionamento è quello nativo del browser (CSS `resize`): non
    // emette eventi, si osserva l'elemento. Fuori da Angular perché non
    // cambia nulla di ciò che è renderizzato.
    if (typeof ResizeObserver !== 'undefined') {
      this.zone.runOutsideAngular(() => {
        this.resizeObserver = new ResizeObserver(() => this.scheduleSave());
        this.resizeObserver.observe(this.pane!);
      });
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.dragSub?.unsubscribe();
    if (this.saveTimer) clearTimeout(this.saveTimer);
  }

  private get storageKey(): string {
    const userId = this.auth.currentUser()?.userId ?? 'anon';
    return `${STORAGE_PREFIX}.${userId}.${this.windowKey}`;
  }

  private restoreSize(): void {
    const stored = this.read();
    if (!stored || !this.pane) return;

    if (stored.width) this.pane.style.width = `${stored.width}px`;
    if (stored.height) this.pane.style.height = `${stored.height}px`;
  }

  /**
   * Ripristina la posizione solo quando la root del drag è la finestra.
   * Se dopo qualche giro non lo è, si rinuncia: una finestra che riapre al
   * centro è un fastidio, una barra del titolo staccata dal riquadro sembra
   * l'applicazione rotta.
   */
  private restorePositionWhenRootReady(attempt = 0): void {
    if (!this.pane || !this.drag) return;

    if (this.drag.getRootElement() !== this.pane) {
      if (attempt >= 3) return;
      afterNextRender(() => this.restorePositionWhenRootReady(attempt + 1), {
        injector: this.injector,
      });
      return;
    }

    const stored = this.read();
    if (!stored) return;

    // La posizione salvata può venire da uno schermo più grande: si riporta
    // dentro la viewport corrente invece di lasciare la finestra irraggiungibile.
    // Le misure si leggono dal pane (già ridimensionato da `restoreSize` e
    // limitato dai max-width/max-height del CSS), non dai valori salvati.
    const maxX = Math.max(0, window.innerWidth - this.pane.offsetWidth - VIEWPORT_MARGIN);
    const maxY = Math.max(0, window.innerHeight - this.pane.offsetHeight - VIEWPORT_MARGIN);

    this.drag.setFreeDragPosition({
      x: Math.min(Math.max(stored.x, -maxX), maxX),
      y: Math.min(Math.max(stored.y, 0), maxY),
    });
  }

  /** Raggruppa le scritture: il resize nativo emette molti eventi di fila. */
  private scheduleSave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.save(), 300);
  }

  private save(): void {
    if (!this.pane) return;
    const position = this.drag?.getFreeDragPosition() ?? { x: 0, y: 0 };
    // Le finestre minimizzate hanno un'altezza fittizia: salvarla farebbe
    // riaprire il riquadro schiacciato sulla sola barra del titolo.
    if (this.pane.classList.contains('minimized')) return;

    this.write({
      x: Math.round(position.x),
      y: Math.round(position.y),
      width: Math.round(this.pane.offsetWidth),
      height: Math.round(this.pane.offsetHeight),
    });
  }

  private read(): WindowGeometry | null {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as WindowGeometry;
      return typeof parsed?.x === 'number' && typeof parsed?.y === 'number' ? parsed : null;
    } catch {
      return null;
    }
  }

  private write(geometry: WindowGeometry): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(geometry));
    } catch {
      // Quota piena o storage negato: la finestra funziona lo stesso, si
      // riapre solo alla posizione di default.
    }
  }
}
