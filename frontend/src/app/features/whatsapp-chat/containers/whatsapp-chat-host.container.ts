import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WhatsappChatWindowContainer } from './whatsapp-chat-window.container';
import { WhatsappChatStateService } from '../services/whatsapp-chat-state.service';

/**
 * Layer 2 — Smart Container.
 *
 * Ospita tutte le finestre di chat aperte. Va montato UNA volta nella shell
 * dell'applicazione (`app.component`), non dentro una rotta: le chat devono
 * sopravvivere al cambio di pagina, altrimenti passare dal calendario alla
 * fatturazione chiuderebbe le conversazioni in corso.
 */
@Component({
  selector: 'app-whatsapp-chat-host',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, WhatsappChatWindowContainer],
  template: `
    @for (window of state.windows(); track window.conversationId) {
      <app-whatsapp-chat-window-container [conversationId]="window.conversationId">
      </app-whatsapp-chat-window-container>
    }
  `,
  styles: [`
    :host {
      display: contents;
    }
  `],
})
export class WhatsappChatHostContainer implements OnInit {
  readonly state = inject(WhatsappChatStateService);

  ngOnInit(): void {
    this.state.start();
  }
}
