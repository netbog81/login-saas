import { Injectable, computed, inject, signal } from '@angular/core';
import { takeUntil, Subject } from 'rxjs';
import { SseService } from '../../../services/sse.service';
import { SettingsService } from '../../../services/settings.service';
import { WhatsappChatService } from './whatsapp-chat.service';
import {
  QuickReply,
  MIN_INPUT_HEIGHT,
} from '../components/chat-composer/chat-composer.component';
import {
  OpenWhatsappConversationInput,
  WhatsappConversation,
} from '../models/whatsapp-chat.model';

/**
 * Chiave in `general_settings` delle risposte rapide della chat: array di
 * oggetti { label, text }. Modificabile da Impostazioni WhatsApp.
 */
export const QUICK_REPLIES_SETTING_KEY = 'whatsapp.quickReplies';

/**
 * Stato di una finestra di chat aperta sullo schermo.
 *
 * La posizione e' relativa al viewport; `zIndex` serve a portare in primo piano
 * la finestra su cui si sta scrivendo quando ce ne sono piu' d'una sovrapposte.
 */
export interface ChatWindowState {
  conversationId: string;
  minimized: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  /** Testo non ancora inviato: non va perso minimizzando o parcheggiando. */
  draft: string;
  /** Altezza della casella di scrittura scelta dall'operatore, in px. */
  inputHeight: number;
}

/** Chiave localStorage delle chat parcheggiate in barra laterale. */
const PARKED_STORAGE_KEY = 'whatsapp-chat-parked';

/** Ingombro iniziale di una finestra di chat. */
const DEFAULT_WIDTH = 360;
const DEFAULT_HEIGHT = 480;
/** Sfalsamento a cascata fra finestre aperte in sequenza. */
const CASCADE_STEP = 32;

@Injectable({ providedIn: 'root' })
export class WhatsappChatStateService {
  private readonly chatService = inject(WhatsappChatService);
  private readonly sseService = inject(SseService);
  private readonly settingsService = inject(SettingsService);
  private readonly destroy$ = new Subject<void>();

  /** Finestre attualmente aperte sullo schermo. */
  readonly windows = signal<ChatWindowState[]>([]);

  /**
   * Conversazioni parcheggiate nel pannello laterale: restano a portata di
   * mano senza occupare spazio a schermo. Persistite in localStorage, cosi'
   * sopravvivono al ricaricamento della pagina.
   */
  readonly parked = signal<WhatsappConversation[]>([]);

  /** Conversazioni caricate, indicizzate per id (fonte per finestre e pannello). */
  readonly conversations = signal<Map<string, WhatsappConversation>>(new Map());

  /** Totale messaggi non letti, per il badge globale. */
  readonly unreadTotal = signal(0);

  /**
   * Risposte rapide configurate in Impostazioni WhatsApp. Caricate una volta
   * sola e condivise da tutte le finestre.
   */
  readonly quickReplies = signal<QuickReply[]>([]);

  /**
   * Segnale che scatta a ogni evento di chat ricevuto via SSE: le finestre
   * aperte lo osservano per ricaricare i messaggi. Contiene l'id della
   * conversazione toccata (o null per un refresh generico).
   */
  readonly lastChangedConversationId = signal<{ id: string | null; at: number }>({
    id: null,
    at: 0,
  });

  readonly hasWindows = computed(() => this.windows().length > 0);

  /**
   * Cosa mostra il pannello "Chat in corso".
   *
   * È esattamente l'elenco parcheggiato: una conversazione ci entra o perché
   * la segreteria l'ha messa da parte, o da sola all'arrivo di un messaggio
   * (vedi `refreshInbox`). Da lì NON esce leggendola — leggere spegne solo il
   * pallino rosso — ma solo con la X. Farla sparire alla lettura significava
   * perdere di vista una chat appena aperta.
   */
  readonly panelConversations = computed(() =>
    [...this.parked()].sort((a, b) =>
      (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? ''),
    ),
  );

  private started = false;

  /**
   * Le finestre stanno SOPRA il contenitore degli overlay CDK (z-index 1500):
   * sotto, qualsiasi elemento posizionato del calendario le copriva e i click
   * finivano sulla cella sottostante invece che nella chat.
   *
   * Conseguenza: nessun componente dentro la finestra può usare overlay CDK
   * (menu, tooltip), perché resterebbero dietro — infatti le risposte rapide
   * sono un pannello interno e i tooltip sono nativi. I dialog aperti DALLA
   * chat usano `sendToBack()` per il tempo in cui restano aperti.
   */
  private static readonly BASE_Z_INDEX = 1600;
  /** Impilamento usato quando la finestra deve passare dietro a un dialog. */
  private static readonly BEHIND_OVERLAY_Z_INDEX = 900;

  private topZIndex = WhatsappChatStateService.BASE_Z_INDEX;

  /**
   * Avvia l'ascolto realtime e ricostruisce le chat parcheggiate.
   * Idempotente: la chiama l'host globale al primo mount.
   */
  start(): void {
    if (this.started) return;
    this.started = true;

    this.restoreParked();
    this.refreshInbox();
    this.loadQuickReplies();

    this.sseService.getEvents().pipe(takeUntil(this.destroy$)).subscribe((event) => {
      if (event.type === 'whatsapp_chat_changed') {
        this.lastChangedConversationId.set({
          id: event.conversationId ?? null,
          at: Date.now(),
        });
        this.refreshInbox();
      } else if (event.type === 'stream_connected') {
        // Riconnessione: durante la disconnessione possono essere arrivati
        // messaggi che non abbiamo visto.
        this.refreshInbox();
      }
    });
  }

  stop(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.started = false;
  }

  // ==================== APERTURA ====================

  /**
   * Apre (o porta in primo piano) la chat di un numero. Se la conversazione non
   * esiste ancora viene creata lato server.
   */
  openForPhone(input: OpenWhatsappConversationInput): void {
    this.chatService.openConversation(input).subscribe({
      next: (conversation) => this.openConversation(conversation),
      error: (err) => console.error('[WhatsappChat] Apertura conversazione fallita:', err),
    });
  }

  /** Apre (o porta in primo piano) la finestra di una conversazione nota. */
  openConversation(conversation: WhatsappConversation): void {
    this.cacheConversation(conversation);

    const existing = this.windows().find((w) => w.conversationId === conversation.id);
    if (existing) {
      // Gia' aperta: la si ripristina e la si porta davanti, invece di
      // duplicarla.
      this.updateWindow(conversation.id, { minimized: false, zIndex: ++this.topZIndex });
      return;
    }

    // Una chat parcheggiata resta nel pannello anche mentre e' aperta: cosi'
    // chiudendo il riquadro non la si perde. Dal pannello si toglie solo con
    // la sua X.
    const index = this.windows().length;
    this.windows.update((list) => [
      ...list,
      {
        conversationId: conversation.id,
        minimized: false,
        ...this.initialPosition(index),
        width: DEFAULT_WIDTH,
        height: DEFAULT_HEIGHT,
        zIndex: ++this.topZIndex,
        draft: '',
        inputHeight: MIN_INPUT_HEIGHT,
      },
    ]);

    if (conversation.unreadCount > 0) this.markAsRead(conversation.id);
  }

  /**
   * Posizione iniziale a cascata dall'angolo in basso a destra, cosi' finestre
   * aperte in sequenza non si coprono a vicenda.
   */
  private initialPosition(index: number): { x: number; y: number } {
    const offset = (index % 6) * CASCADE_STEP;
    const x = Math.max(16, window.innerWidth - DEFAULT_WIDTH - 24 - offset);
    const y = Math.max(16, window.innerHeight - DEFAULT_HEIGHT - 24 - offset);
    return { x, y };
  }

  // ==================== GESTIONE FINESTRE ====================

  closeWindow(conversationId: string): void {
    this.windows.update((list) => list.filter((w) => w.conversationId !== conversationId));
  }

  toggleMinimized(conversationId: string): void {
    const current = this.windows().find((w) => w.conversationId === conversationId);
    if (!current) return;
    this.updateWindow(conversationId, { minimized: !current.minimized });
  }

  bringToFront(conversationId: string): void {
    this.updateWindow(conversationId, { zIndex: ++this.topZIndex });
  }

  /**
   * Manda la finestra DIETRO al contenitore degli overlay CDK, per il tempo in
   * cui un dialog aperto dalla chat resta a schermo: altrimenti la finestra,
   * che di norma sta sopra, coprirebbe il dialog che ha appena aperto.
   */
  sendToBack(conversationId: string): void {
    this.updateWindow(conversationId, {
      zIndex: WhatsappChatStateService.BEHIND_OVERLAY_Z_INDEX,
    });
  }

  updateWindow(conversationId: string, patch: Partial<ChatWindowState>): void {
    this.windows.update((list) =>
      list.map((w) => (w.conversationId === conversationId ? { ...w, ...patch } : w)),
    );
  }

  /** Bozza di risposta: sopravvive a minimizzazione e parcheggio. */
  setDraft(conversationId: string, draft: string): void {
    this.updateWindow(conversationId, { draft });
  }

  getWindow(conversationId: string): ChatWindowState | undefined {
    return this.windows().find((w) => w.conversationId === conversationId);
  }

  // ==================== PARCHEGGIO ====================

  /**
   * Sposta la chat nel pannello "Chat in corso": sparisce dallo schermo ma
   * resta a un click di distanza.
   */
  park(conversationId: string): void {
    const conversation = this.conversations().get(conversationId);
    if (conversation) {
      this.addToPanel(conversation);
      this.closeWindow(conversationId);
      return;
    }

    // Non in cache: la si recupera invece di uscire in silenzio, altrimenti il
    // pulsante "parcheggia" non farebbe nulla senza spiegare perché.
    this.closeWindow(conversationId);
    this.chatService.getConversation(conversationId).subscribe({
      next: (fetched) => {
        this.cacheConversation(fetched);
        this.addToPanel(fetched);
      },
      error: (err) => console.warn('[WhatsappChat] Parcheggio non riuscito:', err),
    });
  }

  /** Toglie la chat dal pannello laterale. */
  unpark(conversationId: string, options?: { silent?: boolean }): void {
    const wasParked = this.parked().some((c) => c.id === conversationId);
    if (!wasParked) return;
    this.parked.update((list) => list.filter((c) => c.id !== conversationId));
    this.persistParked();
    if (!options?.silent) {
      const conversation = this.conversations().get(conversationId);
      if (conversation) this.openConversation(conversation);
    }
  }

  isParked(conversationId: string): boolean {
    return this.parked().some((c) => c.id === conversationId);
  }

  /**
   * La X di una voce nelle chat in corso: la toglie dall'elenco e, se aveva
   * messaggi non letti, li segna letti — lasciare un pallino su una chat che
   * non si vede più significherebbe un badge che non si spegne mai.
   *
   * Sta qui e non nei container perché le chat in corso si vedono in due punti
   * (menu della barra in alto e pannello del calendario) e devono comportarsi
   * allo stesso modo.
   */
  removeFromPanel(conversation: { id: string; unreadCount?: number }): void {
    if (conversation.unreadCount && conversation.unreadCount > 0) {
      this.markAsRead(conversation.id);
    }
    this.unpark(conversation.id, { silent: true });
  }

  /** Svuota le chat in corso: come premere la X su ognuna. */
  clearPanel(): void {
    // Copia: removeFromPanel modifica `parked` mentre si itera.
    for (const conversation of [...this.parked()]) {
      this.removeFromPanel(conversation);
    }
  }

  // ==================== DATI ====================

  /**
   * Segna letta la conversazione: sparisce il PALLINO rosso, non la voce dal
   * pannello. La chat resta lì finché la segreteria non la toglie con la X.
   */
  markAsRead(conversationId: string): void {
    // Azzeramento ottimistico del solo contatore, senza aspettare il server:
    // il pallino deve spegnersi nell'istante in cui si apre la chat.
    this.setUnreadCount(conversationId, 0);

    this.chatService.markAsRead(conversationId).subscribe({
      next: (conversation) => {
        this.cacheConversation(conversation);
        this.syncParked(conversation);
        this.refreshUnreadTotal();
      },
      error: (err) => {
        console.warn('[WhatsappChat] markAsRead fallita:', err);
        // Non riuscita: il contatore vero torna dal server, altrimenti
        // resterebbe spento su una chat con messaggi ancora da leggere.
        this.refreshInbox();
      },
    });
  }

  /** Aggiorna il contatore non letti di una conversazione ovunque sia mostrata. */
  private setUnreadCount(conversationId: string, unreadCount: number): void {
    const cached = this.conversations().get(conversationId);
    if (cached) this.cacheConversation({ ...cached, unreadCount });
    this.parked.update((list) =>
      list.map((c) => (c.id === conversationId ? { ...c, unreadCount } : c)),
    );
    // Il badge globale scala di quanto abbiamo appena marcato letto, così non
    // resta acceso nell'attesa della risposta del server.
    const delta = (cached?.unreadCount ?? 0) - unreadCount;
    if (delta > 0) this.unreadTotal.update((total) => Math.max(0, total - delta));
  }

  /** Solo il badge globale, senza toccare l'elenco del pannello. */
  private refreshUnreadTotal(): void {
    this.chatService.getUnreadCount().subscribe({
      next: (count) => this.unreadTotal.set(count),
      error: () => { /* badge non critico */ },
    });
  }

  /**
   * Rilegge le risposte rapide dalle impostazioni. Da richiamare dopo averle
   * modificate, così le finestre già aperte si allineano senza ricaricare.
   */
  loadQuickReplies(): void {
    this.settingsService.getSetting(QUICK_REPLIES_SETTING_KEY).subscribe({
      next: (setting) => {
        const value = setting?.value;
        if (!Array.isArray(value)) {
          this.quickReplies.set([]);
          return;
        }
        // Filtro difensivo: il valore è JSON libero in `general_settings`,
        // una riga malformata non deve rompere il compositore.
        this.quickReplies.set(
          value
            .filter((r: any) => r && typeof r.label === 'string' && typeof r.text === 'string')
            .map((r: any) => ({ label: r.label, text: r.text })),
        );
      },
      error: () => this.quickReplies.set([]),
    });
  }

  /**
   * Riallinea badge, elenco non lette e chat parcheggiate. È il punto unico
   * chiamato a ogni evento realtime: un messaggio in arrivo cambia tutte e tre
   * le cose insieme.
   */
  refreshInbox(): void {
    this.refreshUnreadTotal();

    // Una conversazione con messaggi non letti entra da sola nel pannello e ci
    // RESTA: viene parcheggiata come se l'avesse messa lì la segreteria. Senza
    // questo, sparirebbe nel momento in cui la si apre (i non letti vanno a
    // zero) proprio mentre ci si sta lavorando.
    this.chatService.listConversations({ status: 'OPEN', unreadOnly: true }).subscribe({
      next: (conversations) => {
        conversations.forEach((conversation) => {
          this.cacheConversation(conversation);
          this.addToPanel(conversation);
        });
      },
      error: () => { /* si riprova al prossimo evento */ },
    });

    this.refreshParked();
  }

  /** Aggiunge la conversazione al pannello se non c'è già. */
  private addToPanel(conversation: WhatsappConversation): void {
    if (this.parked().some((c) => c.id === conversation.id)) {
      this.syncParked(conversation);
      return;
    }
    this.parked.update((list) => [...list, conversation]);
    this.persistParked();
  }

  /** @deprecated Usa `refreshInbox()`: il badge da solo non basta più. */
  refreshUnreadCount(): void {
    this.refreshInbox();
  }

  /** Ricarica i dati delle conversazioni parcheggiate (anteprima, non letti). */
  refreshParked(): void {
    const ids = this.parked().map((c) => c.id);
    if (ids.length === 0) return;
    ids.forEach((id) => {
      this.chatService.getConversation(id).subscribe({
        next: (conversation) => {
          this.cacheConversation(conversation);
          this.syncParked(conversation);
        },
        error: () => {
          // Conversazione sparita (cancellata o non piu' accessibile): esce
          // dal pannello invece di restare come voce morta.
          this.parked.update((list) => list.filter((c) => c.id !== id));
          this.persistParked();
        },
      });
    });
  }

  cacheConversation(conversation: WhatsappConversation): void {
    this.conversations.update((map) => {
      const next = new Map(map);
      next.set(conversation.id, conversation);
      return next;
    });
  }

  private syncParked(conversation: WhatsappConversation): void {
    if (!this.parked().some((c) => c.id === conversation.id)) return;
    this.parked.update((list) =>
      list.map((c) => (c.id === conversation.id ? conversation : c)),
    );
    this.persistParked();
  }

  // ==================== PERSISTENZA ====================

  private persistParked(): void {
    try {
      const ids = this.parked().map((c) => c.id);
      localStorage.setItem(PARKED_STORAGE_KEY, JSON.stringify(ids));
    } catch {
      /* quota piena o storage disabilitato: il parcheggio resta in memoria */
    }
  }

  /**
   * Ricostruisce le chat parcheggiate rileggendole dal server: in
   * localStorage stanno solo gli id, mai nome o numero del paziente.
   */
  private restoreParked(): void {
    let ids: string[] = [];
    try {
      ids = JSON.parse(localStorage.getItem(PARKED_STORAGE_KEY) || '[]');
    } catch {
      ids = [];
    }
    if (!Array.isArray(ids) || ids.length === 0) return;

    ids.forEach((id) => {
      this.chatService.getConversation(id).subscribe({
        next: (conversation) => {
          this.cacheConversation(conversation);
          if (!this.parked().some((c) => c.id === conversation.id)) {
            this.parked.update((list) => [...list, conversation]);
          }
        },
        error: () => {
          this.parked.update((list) => list.filter((c) => c.id !== id));
          this.persistParked();
        },
      });
    });
  }
}
