import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { QuickReply } from '../chat-composer/chat-composer.component';

/**
 * Layer 1 — Dumb Component.
 *
 * Editor delle risposte rapide proposte nella chat WhatsApp. Lavora su una
 * copia locale e la restituisce al salvataggio: il container decide quando e
 * come persisterla.
 */
@Component({
  selector: 'app-quick-replies-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
  ],
  template: `
    <p class="editor-hint">
      Compaiono nella chat premendo l'icona ⚡ accanto alla casella di scrittura.
      L'etichetta è quella che vede l'operatore, il testo è quello che finisce
      nel messaggio.
    </p>

    @if (draft.length === 0) {
      <p class="editor-empty">Nessuna risposta rapida configurata.</p>
    }

    @for (reply of draft; track $index) {
      <div class="reply-row">
        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="label-field">
          <mat-label>Etichetta</mat-label>
          <input matInput [(ngModel)]="reply.label" maxlength="40"
                 placeholder="Es. Confermiamo">
        </mat-form-field>

        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="text-field">
          <mat-label>Testo</mat-label>
          <textarea matInput rows="2" [(ngModel)]="reply.text" maxlength="1000"
                    placeholder="Testo inserito nel messaggio"></textarea>
        </mat-form-field>

        <div class="row-actions">
          <button mat-icon-button type="button" matTooltip="Sposta su"
                  [disabled]="$index === 0" (click)="move($index, -1)">
            <mat-icon>arrow_upward</mat-icon>
          </button>
          <button mat-icon-button type="button" matTooltip="Sposta giù"
                  [disabled]="$index === draft.length - 1" (click)="move($index, 1)">
            <mat-icon>arrow_downward</mat-icon>
          </button>
          <button mat-icon-button type="button" matTooltip="Elimina" color="warn"
                  (click)="remove($index)">
            <mat-icon>delete</mat-icon>
          </button>
        </div>
      </div>
    }

    <div class="editor-actions">
      <button mat-stroked-button type="button" (click)="add()">
        <mat-icon>add</mat-icon>
        Aggiungi risposta
      </button>
      <button mat-flat-button color="primary" type="button"
              [disabled]="saving || !isValid"
              (click)="save.emit(cleaned)">
        {{ saving ? 'Salvataggio…' : 'Salva risposte rapide' }}
      </button>
      @if (!isValid) {
        <span class="editor-error">Etichetta e testo sono obbligatori su ogni riga.</span>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }

    .editor-hint {
      margin: 0 0 12px;
      font-size: 13px;
      color: #64748b;
      line-height: 1.45;
    }

    .editor-empty {
      margin: 0 0 12px;
      font-size: 13px;
      color: #94a3b8;
    }

    .reply-row {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      margin-bottom: 12px;
    }

    .label-field { flex: 0 0 180px; }
    .text-field { flex: 1 1 auto; }

    .row-actions {
      display: flex;
      align-items: center;
      padding-top: 4px;
    }

    .editor-actions {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
      margin-top: 8px;
    }

    .editor-error {
      font-size: 12px;
      color: #b91c1c;
    }
  `],
})
export class QuickRepliesEditorComponent {
  /**
   * Il set arriva dal container. Si lavora su una COPIA: modificare gli
   * oggetti in ingresso vorrebbe dire cambiare quelli già in uso dalle
   * finestre di chat aperte, prima ancora di salvare.
   */
  @Input()
  set quickReplies(value: QuickReply[]) {
    this.draft = (value ?? []).map((r) => ({ ...r }));
  }

  @Input() saving = false;

  @Output() save = new EventEmitter<QuickReply[]>();

  draft: QuickReply[] = [];

  get cleaned(): QuickReply[] {
    return this.draft.map((r) => ({ label: r.label.trim(), text: r.text.trim() }));
  }

  get isValid(): boolean {
    return this.draft.every((r) => r.label?.trim() && r.text?.trim());
  }

  add(): void {
    this.draft = [...this.draft, { label: '', text: '' }];
  }

  remove(index: number): void {
    this.draft = this.draft.filter((_, i) => i !== index);
  }

  move(index: number, delta: number): void {
    const target = index + delta;
    if (target < 0 || target >= this.draft.length) return;
    const next = [...this.draft];
    [next[index], next[target]] = [next[target], next[index]];
    this.draft = next;
  }
}
