import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Editor } from '@tiptap/core';

import {
  DEFAULT_PAGE_SETTINGS,
  MergeFieldDef,
  TEMPLATE_FONT_OPTIONS,
  TemplateDocument,
  TemplatePageSettings,
} from './models/template-editor.model';
import { logoBlockCss, templateContentCss, templateExtensions } from './template-render.util';

/** Dimensione massima del logo dopo il ridimensionamento (base64 nel template). */
const LOGO_MAX_DATAURL_BYTES = 300 * 1024;
const LOGO_RESIZE_MAX_HEIGHT_PX = 240;

/** Limiti per le immagini libere nel corpo del documento. */
const BODY_IMAGE_MAX_DATAURL_BYTES = 500 * 1024;
const BODY_IMAGE_RESIZE_MAX_WIDTH_PX = 1400;

const SHARED_CONTENT_STYLE_ID = 'tpl-shared-content-css';

const A4_HEIGHT_MM = 297;
/** In CSS 1in = 96px per definizione, indipendentemente dallo zoom. */
const mmToPx = (mm: number): number => (mm / 25.4) * 96;

/**
 * Inietta in `document.head` le regole di contenuto del foglio, scopate su
 * `.tpl-page`: sono la stessa stringa che finisce nella pagina di stampa
 * (templateContentCss), quindi le due superfici non possono divergere.
 *
 * Va in `<head>` a runtime — non nei `styles` del componente — sia perché la
 * stringa è calcolata da una funzione, sia per finire dopo Tailwind Preflight
 * e vincere a parità di specificità.
 */
function ensureSharedContentStyles(): void {
  if (document.getElementById(SHARED_CONTENT_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = SHARED_CONTENT_STYLE_ID;
  style.textContent = templateContentCss('.tpl-page');
  document.head.appendChild(style);
}

interface MergeFieldGroup {
  name: string;
  fields: MergeFieldDef[];
}

/**
 * Editor WYSIWYG di template documento (TipTap + Angular Material).
 *
 * Componente RIUSABILE e autocontenuto (vedi models/template-editor.model.ts):
 * comunica solo via Input/Output, nessuna dipendenza da servizi applicativi.
 * La superficie di editing riproduce il foglio A4 con le impostazioni di
 * pagina applicate: ciò che si vede è ciò che verrà stampato
 * (template-render.util usa lo stesso HTML/CSS).
 */
@Component({
  selector: 'app-template-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  // ViewEncapsulation.None: il contenuto ProseMirror è DOM generato a
  // runtime, gli stili devono raggiungerlo. Tutte le classi sono
  // prefissate `tpl-` per non inquinare il resto dell'app.
  encapsulation: ViewEncapsulation.None,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    MatExpansionModule,
    MatDividerModule,
    MatSnackBarModule,
  ],
  template: `
    <div class="tpl-shell">
      <!-- ==================== AREA EDITOR ==================== -->
      <div class="tpl-main">
        <div class="tpl-toolbar mat-elevation-z1">
          <mat-form-field appearance="outline" class="tpl-block-select" subscriptSizing="dynamic">
            <mat-select [value]="currentBlock" (selectionChange)="setBlock($event.value)">
              <mat-option value="p">Paragrafo</mat-option>
              <mat-option value="h1">Titolo 1</mat-option>
              <mat-option value="h2">Titolo 2</mat-option>
              <mat-option value="h3">Titolo 3</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="tpl-size-select" subscriptSizing="dynamic"
                          matTooltip="Dimensione del testo selezionato">
            <mat-select [value]="currentFontSize" (selectionChange)="setFontSize($event.value)">
              <mat-option value="">Auto</mat-option>
              @for (size of fontSizes; track size) {
                <mat-option [value]="size + 'pt'">{{ size }} pt</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <label class="tpl-text-color" matTooltip="Colore del testo selezionato">
            <mat-icon>format_color_text</mat-icon>
            <input type="color" [value]="currentTextColor" (input)="setTextColor($event)" />
          </label>
          <label class="tpl-text-color" matTooltip="Evidenziazione (sfondo del testo selezionato)">
            <mat-icon>format_color_fill</mat-icon>
            <input type="color" [value]="currentHighlight" (input)="setHighlight($event)" />
          </label>
          <label class="tpl-text-color" matTooltip="Sfondo riga (banda colorata a tutta larghezza)">
            <mat-icon>format_paint</mat-icon>
            <input type="color" [value]="currentBandColor" (input)="setBandColor($event)" />
          </label>
          <button mat-icon-button matTooltip="Rimuovi colori (testo, evidenziazione, sfondo riga)"
                  (click)="clearColors()">
            <mat-icon>format_color_reset</mat-icon>
          </button>

          <span class="tpl-toolbar-sep"></span>

          <button mat-icon-button matTooltip="Grassetto" [class.tpl-active]="isActive('bold')" (click)="cmd('bold')">
            <mat-icon>format_bold</mat-icon>
          </button>
          <button mat-icon-button matTooltip="Corsivo" [class.tpl-active]="isActive('italic')" (click)="cmd('italic')">
            <mat-icon>format_italic</mat-icon>
          </button>
          <button mat-icon-button matTooltip="Sottolineato" [class.tpl-active]="isActive('underline')" (click)="cmd('underline')">
            <mat-icon>format_underlined</mat-icon>
          </button>

          <span class="tpl-toolbar-sep"></span>

          <button mat-icon-button matTooltip="Allinea a sinistra" [class.tpl-active]="isAligned('left')" (click)="align('left')">
            <mat-icon>format_align_left</mat-icon>
          </button>
          <button mat-icon-button matTooltip="Centra" [class.tpl-active]="isAligned('center')" (click)="align('center')">
            <mat-icon>format_align_center</mat-icon>
          </button>
          <button mat-icon-button matTooltip="Allinea a destra" [class.tpl-active]="isAligned('right')" (click)="align('right')">
            <mat-icon>format_align_right</mat-icon>
          </button>
          <button mat-icon-button matTooltip="Giustifica" [class.tpl-active]="isAligned('justify')" (click)="align('justify')">
            <mat-icon>format_align_justify</mat-icon>
          </button>

          <span class="tpl-toolbar-sep"></span>

          <button mat-icon-button matTooltip="Elenco puntato" [class.tpl-active]="isActive('bulletList')" (click)="cmd('bulletList')">
            <mat-icon>format_list_bulleted</mat-icon>
          </button>
          <button mat-icon-button matTooltip="Elenco numerato" [class.tpl-active]="isActive('orderedList')" (click)="cmd('orderedList')">
            <mat-icon>format_list_numbered</mat-icon>
          </button>
          <button mat-icon-button matTooltip="Linea separatrice" (click)="cmd('hr')">
            <mat-icon>horizontal_rule</mat-icon>
          </button>
          <button mat-icon-button matTooltip="Inserisci immagine" (click)="bodyImageInput.click()">
            <mat-icon>image</mat-icon>
          </button>
          <input #bodyImageInput type="file" accept="image/png,image/jpeg,image/svg+xml"
                 hidden (change)="onBodyImageSelected($event)" />

          <span class="tpl-toolbar-sep"></span>

          <button mat-icon-button matTooltip="Annulla" (click)="cmd('undo')">
            <mat-icon>undo</mat-icon>
          </button>
          <button mat-icon-button matTooltip="Ripristina" (click)="cmd('redo')">
            <mat-icon>redo</mat-icon>
          </button>
        </div>

        <!-- Barra contestuale: visibile quando una linea separatrice è selezionata -->
        @if (isActive('horizontalRule')) {
          <div class="tpl-toolbar tpl-image-toolbar mat-elevation-z1">
            <span class="tpl-image-toolbar-label">
              <mat-icon>horizontal_rule</mat-icon>
              Linea:
            </span>
            <label class="tpl-text-color" matTooltip="Colore della linea">
              <input type="color" [value]="currentRuleColor" (input)="setRuleColor($event)" />
            </label>
            <mat-form-field appearance="outline" class="tpl-thickness-select" subscriptSizing="dynamic">
              <mat-select [value]="currentRuleThickness" (selectionChange)="setRuleThickness($event.value)">
                <mat-option [value]="1">Sottile (1px)</mat-option>
                <mat-option [value]="2">Media (2px)</mat-option>
                <mat-option [value]="3">Spessa (3px)</mat-option>
                <mat-option [value]="5">Molto spessa (5px)</mat-option>
              </mat-select>
            </mat-form-field>
            <button mat-icon-button matTooltip="Colore automatico (colore Titoli del foglio)"
                    (click)="resetRuleColor()">
              <mat-icon>format_color_reset</mat-icon>
            </button>

            <span class="tpl-toolbar-sep"></span>

            <button mat-icon-button color="warn" matTooltip="Elimina linea"
                    (click)="deleteSelectedImage()">
              <mat-icon>delete</mat-icon>
            </button>
          </div>
        }

        <!-- Barra contestuale: visibile quando un'immagine è selezionata -->
        @if (isActive('image')) {
          <div class="tpl-toolbar tpl-image-toolbar mat-elevation-z1">
            <span class="tpl-image-toolbar-label">
              <mat-icon>image</mat-icon>
              Immagine:
            </span>

            <mat-form-field appearance="outline" class="tpl-image-layout-select" subscriptSizing="dynamic">
              <mat-select [value]="imageLayout" (selectionChange)="setImageLayout($event.value)">
                <mat-option value="float-left">A sinistra, testo a fianco</mat-option>
                <mat-option value="float-right">A destra, testo a fianco</mat-option>
                <mat-option value="block-left">Blocco a sinistra</mat-option>
                <mat-option value="block-center">Blocco centrato</mat-option>
                <mat-option value="block-right">Blocco a destra</mat-option>
              </mat-select>
            </mat-form-field>

            <span class="tpl-toolbar-sep"></span>

            <label class="tpl-image-width">
              Larghezza
              <input type="number" min="10" max="100" step="5"
                     [ngModel]="imageWidthPercent"
                     (ngModelChange)="setImageWidth($event)" />
              %
            </label>

            <span class="tpl-toolbar-sep"></span>

            <button mat-icon-button color="warn" matTooltip="Elimina immagine"
                    (click)="deleteSelectedImage()">
              <mat-icon>delete</mat-icon>
            </button>
          </div>
        }

        @if (overflowMm > 0) {
          <div class="tpl-overflow-warn">
            <mat-icon>warning</mat-icon>
            Il contenuto supera l'altezza di un foglio A4 di circa {{ overflowMm }} mm:
            in stampa finirà su una seconda pagina. Togli una riga vuota o riduci il margine inferiore.
          </div>
        }

        <div class="tpl-page-scroll">
          <div #pageEl class="tpl-page"
               [style.backgroundColor]="settings.backgroundColor"
               [style.padding]="pagePadding"
               [style.fontFamily]="settings.fontFamily"
               [style.fontSize.pt]="settings.fontSize"
               [style.color]="settings.textColor"
               [style.--tpl-accent]="settings.accentColor">
            <!-- Dove il browser spezzerà il foglio in stampa. Senza questo
                 riferimento la superficie di editing cresce all'infinito e
                 non mostra mai che il documento non entra in una pagina. -->
            <div class="tpl-page-break" [style.top]="pageBreakTop" aria-hidden="true">
              <span>fine pagina 1</span>
            </div>
            @if (settings.logoDataUrl) {
              <div class="tpl-logo" [ngStyle]="logoBlockStyle">
                <img [src]="settings.logoDataUrl" [style.height.px]="settings.logoHeight" alt="Logo" />
              </div>
            }
            <div #editorHost class="tpl-editor-host"></div>
          </div>
        </div>
      </div>

      <!-- ==================== SIDEBAR ==================== -->
      <aside class="tpl-sidebar">
        <mat-accordion multi>
          <mat-expansion-panel expanded>
            <mat-expansion-panel-header>
              <mat-panel-title>
                <mat-icon class="tpl-panel-icon">data_object</mat-icon>
                Campi dinamici
              </mat-panel-title>
            </mat-expansion-panel-header>
            <p class="tpl-hint">
              Clicca un campo per inserirlo nel punto in cui si trova il cursore.
              Alla generazione verrà sostituito col dato reale.
            </p>
            @for (group of fieldGroups; track group.name) {
              <div class="tpl-field-group">
                <div class="tpl-field-group-name">{{ group.name }}</div>
                <div class="tpl-field-chips">
                  @for (f of group.fields; track f.key) {
                    <button type="button" class="tpl-field-chip"
                            [matTooltip]="f.example ? 'Es.: ' + f.example : ''"
                            (click)="insertField(f)">
                      {{ f.label }}
                    </button>
                  }
                </div>
              </div>
            }
          </mat-expansion-panel>

          <mat-expansion-panel expanded>
            <mat-expansion-panel-header>
              <mat-panel-title>
                <mat-icon class="tpl-panel-icon">palette</mat-icon>
                Aspetto del foglio
              </mat-panel-title>
            </mat-expansion-panel-header>

            <!-- Logo -->
            <div class="tpl-setting-label">Logo</div>
            @if (settings.logoDataUrl) {
              <div class="tpl-logo-row">
                <img [src]="settings.logoDataUrl" alt="Logo" class="tpl-logo-thumb" />
                <button mat-icon-button color="warn" matTooltip="Rimuovi logo" (click)="removeLogo()">
                  <mat-icon>delete</mat-icon>
                </button>
              </div>
              <mat-form-field appearance="outline" class="tpl-w100" subscriptSizing="dynamic">
                <mat-label>Altezza logo (px)</mat-label>
                <input matInput type="number" min="24" max="200"
                       [ngModel]="settings.logoHeight"
                       (ngModelChange)="patchSettings({ logoHeight: clamp($event, 24, 200) })" />
              </mat-form-field>
              <mat-form-field appearance="outline" class="tpl-w100" subscriptSizing="dynamic">
                <mat-label>Posizione logo</mat-label>
                <mat-select [ngModel]="settings.logoAlignment"
                            (ngModelChange)="patchSettings({ logoAlignment: $event })">
                  <mat-option value="left">Sinistra (testo sotto)</mat-option>
                  <mat-option value="center">Centro (testo sotto)</mat-option>
                  <mat-option value="right">Destra (testo sotto)</mat-option>
                  <mat-option value="float-left">Sinistra, testo a fianco</mat-option>
                  <mat-option value="float-right">Destra, testo a fianco</mat-option>
                </mat-select>
              </mat-form-field>
            } @else {
              <button mat-stroked-button class="tpl-w100" (click)="logoInput.click()">
                <mat-icon>add_photo_alternate</mat-icon>
                Carica logo
              </button>
            }
            <input #logoInput type="file" accept="image/png,image/jpeg,image/svg+xml"
                   hidden (change)="onLogoSelected($event)" />

            <mat-divider class="tpl-divider"></mat-divider>

            <!-- Font -->
            <mat-form-field appearance="outline" class="tpl-w100" subscriptSizing="dynamic">
              <mat-label>Carattere</mat-label>
              <mat-select [ngModel]="settings.fontFamily"
                          (ngModelChange)="patchSettings({ fontFamily: $event })">
                @for (f of fontOptions; track f.value) {
                  <mat-option [value]="f.value" [style.fontFamily]="f.value">{{ f.label }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline" class="tpl-w100" subscriptSizing="dynamic">
              <mat-label>Dimensione testo base (pt)</mat-label>
              <input matInput type="number" min="8" max="16"
                     [ngModel]="settings.fontSize"
                     (ngModelChange)="patchSettings({ fontSize: clamp($event, 8, 16) })" />
            </mat-form-field>

            <!-- Colori -->
            <div class="tpl-color-row">
              <label>Testo
                <input type="color" [ngModel]="settings.textColor"
                       (ngModelChange)="patchSettings({ textColor: $event })" />
              </label>
              <label>Titoli
                <input type="color" [ngModel]="settings.accentColor"
                       (ngModelChange)="patchSettings({ accentColor: $event })" />
              </label>
              <label>Sfondo
                <input type="color" [ngModel]="settings.backgroundColor"
                       (ngModelChange)="patchSettings({ backgroundColor: $event })" />
              </label>
            </div>

            <mat-divider class="tpl-divider"></mat-divider>

            <!-- Margini -->
            <div class="tpl-setting-label">Margini pagina (mm)</div>
            <div class="tpl-margin-grid">
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>Sopra</mat-label>
                <input matInput type="number" min="5" max="50"
                       [ngModel]="settings.marginTop"
                       (ngModelChange)="patchSettings({ marginTop: clamp($event, 5, 50) })" />
              </mat-form-field>
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>Sotto</mat-label>
                <input matInput type="number" min="5" max="50"
                       [ngModel]="settings.marginBottom"
                       (ngModelChange)="patchSettings({ marginBottom: clamp($event, 5, 50) })" />
              </mat-form-field>
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>Sinistra</mat-label>
                <input matInput type="number" min="5" max="50"
                       [ngModel]="settings.marginLeft"
                       (ngModelChange)="patchSettings({ marginLeft: clamp($event, 5, 50) })" />
              </mat-form-field>
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>Destra</mat-label>
                <input matInput type="number" min="5" max="50"
                       [ngModel]="settings.marginRight"
                       (ngModelChange)="patchSettings({ marginRight: clamp($event, 5, 50) })" />
              </mat-form-field>
            </div>
          </mat-expansion-panel>
        </mat-accordion>
      </aside>
    </div>
  `,
  styles: [`
    .tpl-shell {
      display: flex;
      gap: 16px;
      align-items: flex-start;
      width: 100%;
    }
    .tpl-main { flex: 1 1 640px; min-width: 0; }
    .tpl-sidebar { flex: 0 0 300px; max-width: 300px; }

    .tpl-toolbar {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 2px;
      padding: 4px 8px;
      border-radius: 8px;
      background: var(--mat-sys-surface-container, #f5f5f5);
      position: sticky;
      top: 0;
      z-index: 5;
    }
    .tpl-toolbar-sep {
      width: 1px;
      height: 24px;
      background: rgba(0,0,0,0.12);
      margin: 0 6px;
    }
    .tpl-block-select { width: 130px; }
    .tpl-block-select .mat-mdc-text-field-wrapper { height: 40px; }
    .tpl-size-select { width: 92px; }
    .tpl-size-select .mat-mdc-text-field-wrapper { height: 40px; }
    .tpl-text-color {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      cursor: pointer;
      padding: 0 4px;
    }
    .tpl-text-color mat-icon { color: rgba(0,0,0,0.65); }
    .tpl-text-color input[type=color] {
      width: 28px;
      height: 28px;
      border: 1px solid rgba(0,0,0,0.2);
      border-radius: 4px;
      padding: 1px;
      background: none;
      cursor: pointer;
    }
    .tpl-image-toolbar { margin-top: 6px; background: #fff8e1; }
    .tpl-image-toolbar-label {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      color: rgba(0,0,0,0.65);
      margin-right: 4px;
    }
    .tpl-image-layout-select { width: 230px; }
    .tpl-image-layout-select .mat-mdc-text-field-wrapper { height: 40px; }
    .tpl-thickness-select { width: 170px; }
    .tpl-thickness-select .mat-mdc-text-field-wrapper { height: 40px; }
    .tpl-image-width {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      color: rgba(0,0,0,0.65);
    }
    .tpl-image-width input {
      width: 64px;
      padding: 6px 8px;
      border: 1px solid rgba(0,0,0,0.25);
      border-radius: 6px;
      font-family: inherit;
    }
    button.tpl-active {
      background: rgba(63, 81, 181, 0.14);
      border-radius: 8px;
    }

    .tpl-page-scroll {
      margin-top: 12px;
      overflow-x: auto;
      padding-bottom: 16px;
    }
    /* NB: le regole di contenuto del foglio (p, h1-h3, liste, hr, img, chip)
       NON stanno qui: sono in templateContentCss() e vengono iniettate a
       runtime scopate su .tpl-page, così sono letteralmente le stesse della
       pagina di stampa. Qui solo ciò che è specifico dell'editing. */
    .tpl-page {
      position: relative;
      width: 210mm;
      min-height: 297mm;
      margin: 0 auto;
      box-shadow: 0 2px 12px rgba(0,0,0,0.25);
      box-sizing: border-box;
      line-height: 1.5;
    }
    .tpl-page-break {
      position: absolute;
      left: 0;
      right: 0;
      border-top: 1px dashed #d32f2f;
      pointer-events: none;
    }
    .tpl-page-break span {
      position: absolute;
      right: 4px;
      top: 2px;
      font: 10px/1 Roboto, sans-serif;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      color: #d32f2f;
    }
    .tpl-overflow-warn {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 12px;
      padding: 8px 12px;
      border-radius: 6px;
      background: #fff3e0;
      border: 1px solid #ffb74d;
      color: #6d4c00;
      font-size: 13px;
    }
    .tpl-overflow-warn mat-icon { color: #ef6c00; flex: none; }

    .tpl-editor-host .ProseMirror {
      outline: none;
      min-height: 180mm;
    }
    .tpl-editor-host .ProseMirror img.ProseMirror-selectednode {
      outline: 2px solid #3f51b5;
      outline-offset: 1px;
    }
    .tpl-editor-host .ProseMirror hr.ProseMirror-selectednode {
      outline: 2px solid #3f51b5;
      outline-offset: 2px;
    }

    .tpl-page .merge-field-chip { cursor: default; }
    .ProseMirror-selectednode.merge-field-chip,
    .merge-field-chip.ProseMirror-selectednode {
      outline: 2px solid #3f51b5;
    }

    .tpl-panel-icon { margin-right: 8px; }
    .tpl-hint { font-size: 12px; color: rgba(0,0,0,0.6); margin: 4px 0 12px; }
    .tpl-field-group { margin-bottom: 12px; }
    .tpl-field-group-name {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: rgba(0,0,0,0.55);
      margin-bottom: 6px;
    }
    .tpl-field-chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .tpl-field-chip {
      background: #e8eaf6;
      border: 1px solid #9fa8da;
      border-radius: 14px;
      padding: 3px 10px;
      font-size: 12px;
      cursor: pointer;
      font-family: inherit;
    }
    .tpl-field-chip:hover { background: #c5cae9; }

    .tpl-setting-label {
      font-size: 12px;
      font-weight: 600;
      color: rgba(0,0,0,0.65);
      margin: 8px 0 6px;
    }
    .tpl-w100 { width: 100%; margin-bottom: 10px; }
    .tpl-logo-row { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
    .tpl-logo-thumb {
      max-height: 48px;
      max-width: 180px;
      border: 1px solid rgba(0,0,0,0.12);
      border-radius: 4px;
      padding: 2px;
    }
    .tpl-divider { margin: 12px 0; }
    .tpl-color-row { display: flex; gap: 12px; flex-wrap: wrap; }
    .tpl-color-row label {
      display: flex;
      flex-direction: column;
      font-size: 12px;
      color: rgba(0,0,0,0.65);
      gap: 4px;
    }
    .tpl-color-row input[type=color] {
      width: 56px;
      height: 32px;
      border: 1px solid rgba(0,0,0,0.2);
      border-radius: 4px;
      padding: 1px;
      background: none;
      cursor: pointer;
    }
    .tpl-margin-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }

    /* Responsive: sidebar sotto l'editor su schermi stretti */
    @media (max-width: 1100px) {
      .tpl-shell { flex-direction: column; }
      .tpl-sidebar { flex: 1 1 auto; max-width: none; width: 100%; }
    }
  `],
})
export class TemplateEditorComponent implements AfterViewInit, OnChanges, OnDestroy {
  /** Documento TipTap JSON iniziale (null → documento vuoto). */
  @Input() content: TemplateDocument | null = null;
  /** Impostazioni pagina (null → default). */
  @Input() pageSettings: Partial<TemplatePageSettings> | null = null;
  /** Campi dinamici disponibili per questo tipo di documento. */
  @Input() mergeFields: MergeFieldDef[] = [];

  @Output() contentChange = new EventEmitter<TemplateDocument>();
  @Output() pageSettingsChange = new EventEmitter<TemplatePageSettings>();

  @ViewChild('editorHost', { static: false }) editorHost?: ElementRef<HTMLElement>;
  @ViewChild('pageEl', { static: false }) pageEl?: ElementRef<HTMLElement>;

  /** Di quanti mm il contenuto sfora il primo foglio A4 (0 = ci sta). */
  overflowMm = 0;

  settings: TemplatePageSettings = { ...DEFAULT_PAGE_SETTINGS };
  readonly fontOptions = TEMPLATE_FONT_OPTIONS;
  /** Dimensioni (pt) selezionabili per il testo evidenziato. */
  readonly fontSizes = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32];

  private editor?: Editor;

  constructor(
    private readonly zone: NgZone,
    private readonly cdr: ChangeDetectorRef,
    private readonly snackBar: MatSnackBar,
  ) {}

  get fieldGroups(): MergeFieldGroup[] {
    const map = new Map<string, MergeFieldDef[]>();
    for (const f of this.mergeFields) {
      const list = map.get(f.group) ?? [];
      list.push(f);
      map.set(f.group, list);
    }
    return [...map.entries()].map(([name, fields]) => ({ name, fields }));
  }

  get pagePadding(): string {
    const s = this.settings;
    return `${s.marginTop}mm ${s.marginRight}mm ${s.marginBottom}mm ${s.marginLeft}mm`;
  }

  /** Fondo dell'area utile del primo foglio, rispetto al bordo della pagina. */
  get pageBreakTop(): string {
    return `${A4_HEIGHT_MM - this.settings.marginBottom}mm`;
  }

  /**
   * Misura quanto il contenuto sfora l'area utile del primo foglio.
   * La superficie di editing è a scorrimento continuo (`min-height: 297mm`),
   * quindi senza questo controllo un documento troppo lungo sembra entrare
   * in una pagina e poi in stampa se ne prende due.
   */
  private scheduleOverflowCheck(): void {
    this.zone.runOutsideAngular(() => {
      requestAnimationFrame(() => {
        const page = this.pageEl?.nativeElement;
        const pm = this.editorHost?.nativeElement.firstElementChild;
        if (!page || !pm) return;

        const pageTop = page.getBoundingClientRect().top;
        // Non uso il rect di .ProseMirror: ha `min-height` e mentirebbe.
        let contentBottom = pageTop;
        const blocks = Array.from(pm.children).concat(
          Array.from(page.querySelectorAll('.tpl-logo')),
        );
        for (const el of blocks) {
          contentBottom = Math.max(contentBottom, el.getBoundingClientRect().bottom);
        }

        const limitPx = mmToPx(A4_HEIGHT_MM - this.settings.marginBottom);
        const overflowPx = contentBottom - pageTop - limitPx;
        const next = overflowPx > 1 ? Math.ceil(overflowPx / mmToPx(1)) : 0;
        if (next !== this.overflowMm) {
          this.zone.run(() => {
            this.overflowMm = next;
            this.cdr.markForCheck();
          });
        }
      });
    });
  }

  /**
   * Stile del blocco logo: la stessa funzione usata dal rendering di stampa
   * (template-render.util → logoHtml).
   */
  get logoBlockStyle(): Record<string, string> {
    return logoBlockCss(this.settings);
  }

  get currentBlock(): string {
    const e = this.editor;
    if (!e) return 'p';
    for (const level of [1, 2, 3] as const) {
      if (e.isActive('heading', { level })) return `h${level}`;
    }
    return 'p';
  }

  /** Dimensione del testo alla selezione corrente ('' = eredita dal foglio). */
  get currentFontSize(): string {
    return String(this.editor?.getAttributes('textStyle')['fontSize'] ?? '');
  }

  /** Colore del testo alla selezione corrente (default: colore del foglio). */
  get currentTextColor(): string {
    return String(
      this.editor?.getAttributes('textStyle')['color'] ?? this.settings.textColor,
    );
  }

  /** Evidenziazione (sfondo testo) alla selezione corrente. */
  get currentHighlight(): string {
    return String(
      this.editor?.getAttributes('textStyle')['backgroundColor'] ?? '#ffff00',
    );
  }

  /** Sfondo del paragrafo corrente (banda a tutta larghezza). */
  get currentBandColor(): string {
    return String(this.editor?.getAttributes('paragraph')['bgColor'] ?? '#e8f5e9');
  }

  // ==================== LIFECYCLE ====================

  ngAfterViewInit(): void {
    ensureSharedContentStyles();
    if (!this.editorHost) return;
    // L'editor va creato fuori da NgZone: ProseMirror aggancia molti listener
    // DOM (mousemove, selection) che altrimenti innescherebbero change
    // detection continua. Gli eventi che ci interessano rientrano in zona
    // esplicitamente.
    this.zone.runOutsideAngular(() => {
      this.editor = new Editor({
        element: this.editorHost!.nativeElement,
        extensions: templateExtensions(),
        content: (this.content as never) ?? undefined,
        onUpdate: ({ editor }) => {
          this.zone.run(() => {
            this.contentChange.emit(editor.getJSON() as TemplateDocument);
            this.cdr.markForCheck();
          });
          this.scheduleOverflowCheck();
        },
        onSelectionUpdate: () => {
          this.zone.run(() => this.cdr.markForCheck());
        },
      });
    });
    this.scheduleOverflowCheck();
    this.cdr.markForCheck();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['pageSettings']) {
      this.settings = { ...DEFAULT_PAGE_SETTINGS, ...(this.pageSettings ?? {}) };
    }
    if (changes['content'] && this.editor && this.content) {
      const current = JSON.stringify(this.editor.getJSON());
      const incoming = JSON.stringify(this.content);
      if (current !== incoming) {
        this.editor.commands.setContent(this.content as never, { emitUpdate: false });
      }
    }
    this.scheduleOverflowCheck();
  }

  ngOnDestroy(): void {
    this.editor?.destroy();
  }

  // ==================== TOOLBAR ====================

  isActive(what: string): boolean {
    return this.editor?.isActive(what) ?? false;
  }

  isAligned(dir: string): boolean {
    return this.editor?.isActive({ textAlign: dir }) ?? false;
  }

  cmd(action: string): void {
    const e = this.editor;
    if (!e) return;
    const chain = e.chain().focus();
    switch (action) {
      case 'bold': chain.toggleBold().run(); break;
      case 'italic': chain.toggleItalic().run(); break;
      case 'underline': chain.toggleUnderline().run(); break;
      case 'bulletList': chain.toggleBulletList().run(); break;
      case 'orderedList': chain.toggleOrderedList().run(); break;
      case 'hr': chain.setHorizontalRule().run(); break;
      case 'undo': chain.undo().run(); break;
      case 'redo': chain.redo().run(); break;
    }
    this.cdr.markForCheck();
  }

  align(dir: 'left' | 'center' | 'right' | 'justify'): void {
    this.editor?.chain().focus().setTextAlign(dir).run();
    this.cdr.markForCheck();
  }

  /** Applica la dimensione carattere al testo selezionato ('' = ripristina). */
  setFontSize(size: string): void {
    const chain = this.editor?.chain().focus();
    if (!chain) return;
    if (size) {
      chain.setFontSize(size).run();
    } else {
      chain.unsetFontSize().run();
    }
    this.cdr.markForCheck();
  }

  setTextColor(event: Event): void {
    const color = (event.target as HTMLInputElement).value;
    this.editor?.chain().focus().setColor(color).run();
    this.cdr.markForCheck();
  }

  setHighlight(event: Event): void {
    const color = (event.target as HTMLInputElement).value;
    this.editor?.chain().focus().setBackgroundColor(color).run();
    this.cdr.markForCheck();
  }

  setBandColor(event: Event): void {
    const bgColor = (event.target as HTMLInputElement).value;
    this.editor?.chain().focus().updateAttributes('paragraph', { bgColor }).run();
    this.cdr.markForCheck();
  }

  /** Rimuove colore testo, evidenziazione e sfondo riga dalla selezione. */
  clearColors(): void {
    this.editor?.chain().focus()
      .unsetColor()
      .unsetBackgroundColor()
      .updateAttributes('paragraph', { bgColor: null })
      .run();
    this.cdr.markForCheck();
  }

  // ==================== LINEA SEPARATRICE ====================

  get currentRuleColor(): string {
    return String(
      this.editor?.getAttributes('horizontalRule')['color'] ?? this.settings.accentColor,
    );
  }

  get currentRuleThickness(): number {
    return Number(this.editor?.getAttributes('horizontalRule')['thickness'] ?? 1);
  }

  setRuleColor(event: Event): void {
    const color = (event.target as HTMLInputElement).value;
    this.editor?.chain().focus().updateAttributes('horizontalRule', { color }).run();
    this.cdr.markForCheck();
  }

  resetRuleColor(): void {
    this.editor?.chain().focus().updateAttributes('horizontalRule', { color: null }).run();
    this.cdr.markForCheck();
  }

  setRuleThickness(thickness: number): void {
    this.editor?.chain().focus().updateAttributes('horizontalRule', { thickness }).run();
    this.cdr.markForCheck();
  }

  setBlock(block: string): void {
    const e = this.editor;
    if (!e) return;
    if (block === 'p') {
      e.chain().focus().setParagraph().run();
    } else {
      const level = Number(block.replace('h', '')) as 1 | 2 | 3;
      e.chain().focus().setHeading({ level }).run();
    }
    this.cdr.markForCheck();
  }

  insertField(field: MergeFieldDef): void {
    this.editor?.chain().focus()
      .insertContent([
        { type: 'mergeField', attrs: { field: field.key, label: field.label } },
        { type: 'text', text: ' ' },
      ])
      .run();
  }

  // ==================== IMMAGINI NEL CORPO ====================

  get imageLayout(): string {
    return String(this.editor?.getAttributes('image')['layout'] ?? 'block-center');
  }

  get imageWidthPercent(): number {
    return Number(this.editor?.getAttributes('image')['widthPercent'] ?? 50);
  }

  setImageLayout(layout: string): void {
    this.editor?.chain().focus().updateAttributes('image', { layout }).run();
    this.cdr.markForCheck();
  }

  setImageWidth(value: number): void {
    const widthPercent = this.clamp(value, 10, 100);
    this.editor?.chain().focus().updateAttributes('image', { widthPercent }).run();
    this.cdr.markForCheck();
  }

  deleteSelectedImage(): void {
    this.editor?.chain().focus().deleteSelection().run();
    this.cdr.markForCheck();
  }

  onBodyImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result as string;
      if (file.type === 'image/svg+xml') {
        this.insertBodyImage(src);
        return;
      }
      const img = new Image();
      img.onload = () => {
        this.insertBodyImage(this.resizeBodyImageToDataUrl(img, file.type));
      };
      img.onerror = () => this.showLogoError('Immagine non leggibile');
      img.src = src;
    };
    reader.onerror = () => this.showLogoError('File non leggibile');
    reader.readAsDataURL(file);
  }

  private insertBodyImage(dataUrl: string): void {
    if (dataUrl.length > BODY_IMAGE_MAX_DATAURL_BYTES) {
      this.showLogoError('Immagine troppo grande anche dopo il ridimensionamento (max ~500KB)');
      return;
    }
    this.zone.run(() => {
      this.editor?.chain().focus()
        .insertContent({
          type: 'image',
          attrs: { src: dataUrl, widthPercent: 50, layout: 'block-center' },
        })
        .run();
      this.cdr.markForCheck();
    });
  }

  /**
   * Ridimensiona a max 1400px di larghezza. Le foto (jpeg) restano jpeg
   * (qualità 0.85) per contenere il peso del data-URL nel template.
   */
  private resizeBodyImageToDataUrl(img: HTMLImageElement, mimeType: string): string {
    const scale = Math.min(1, BODY_IMAGE_RESIZE_MAX_WIDTH_PX / img.naturalWidth);
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return img.src;
    ctx.drawImage(img, 0, 0, w, h);
    return mimeType === 'image/jpeg'
      ? canvas.toDataURL('image/jpeg', 0.85)
      : canvas.toDataURL('image/png');
  }

  // ==================== IMPOSTAZIONI PAGINA ====================

  clamp(value: number, min: number, max: number): number {
    const n = Number(value);
    if (Number.isNaN(n)) return min;
    return Math.min(max, Math.max(min, n));
  }

  patchSettings(patch: Partial<TemplatePageSettings>): void {
    this.settings = { ...this.settings, ...patch };
    this.pageSettingsChange.emit({ ...this.settings });
    this.cdr.markForCheck();
    this.scheduleOverflowCheck();
  }

  removeLogo(): void {
    this.patchSettings({ logoDataUrl: null });
  }

  onLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result as string;
      // SVG: già vettoriale e piccolo, nessun ridimensionamento
      if (file.type === 'image/svg+xml') {
        this.applyLogo(src);
        return;
      }
      const img = new Image();
      img.onload = () => {
        const dataUrl = this.resizeToDataUrl(img);
        this.applyLogo(dataUrl);
      };
      img.onerror = () => this.showLogoError('Immagine non leggibile');
      img.src = src;
    };
    reader.onerror = () => this.showLogoError('File non leggibile');
    reader.readAsDataURL(file);
  }

  private applyLogo(dataUrl: string): void {
    if (dataUrl.length > LOGO_MAX_DATAURL_BYTES) {
      this.showLogoError('Logo troppo grande anche dopo il ridimensionamento (max ~200KB)');
      return;
    }
    this.zone.run(() => this.patchSettings({ logoDataUrl: dataUrl }));
  }

  /** Ridimensiona a max 240px di altezza mantenendo le proporzioni. */
  private resizeToDataUrl(img: HTMLImageElement): string {
    const scale = Math.min(1, LOGO_RESIZE_MAX_HEIGHT_PX / img.naturalHeight);
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return img.src;
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/png');
  }

  private showLogoError(message: string): void {
    this.zone.run(() =>
      this.snackBar.open(message, 'OK', { duration: 5000 }),
    );
  }
}
