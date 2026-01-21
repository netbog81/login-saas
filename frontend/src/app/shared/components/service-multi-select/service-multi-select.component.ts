import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';

// Angular Material imports
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

/**
 * Interfaccia per un servizio disponibile per la selezione
 */
export interface SelectableService {
  id: string;
  name: string;
  defaultPrice?: number;
  discountFE?: number;
  defaultDuration?: number;
}

/**
 * Interfaccia per un servizio selezionato (con prezzo personalizzato opzionale)
 */
export interface SelectedServiceItem {
  serviceId: string;
  service?: SelectableService;
  customPrice?: number;
  customDuration?: number;
  orderPosition: number;
  /**
   * True se il prezzo è stato personalizzato manualmente dall'operatore.
   * Se false, il prezzo segue la logica scontoFE/defaultPrice.
   */
  isCustomPrice?: boolean;
}

/**
 * Componente per la selezione multipla di servizi con:
 * - Dropdown Angular Material per aggiungere servizi
 * - Lista di servizi selezionati
 * - Drag & drop per riordinare
 * - Possibilità di modificare prezzo individuale
 * - Calcolo automatico del totale
 *
 * ARCHITETTURA: Componente dumb con ChangeDetectionStrategy.OnPush
 * - Solo @Input/@Output, nessuna logica business
 * - Usa Angular Material per integrazione corretta con NgZone
 * - markForCheck() dopo ogni modifica di stato locale
 */
@Component({
  selector: 'app-service-multi-select',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DragDropModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule
  ],
  templateUrl: './service-multi-select.component.html',
  styleUrls: ['./service-multi-select.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ServiceMultiSelectComponent implements OnInit, OnChanges {
  /**
   * Lista di tutti i servizi disponibili per la selezione
   */
  @Input() availableServices: SelectableService[] = [];

  /**
   * Servizi attualmente selezionati
   */
  @Input() selectedServices: SelectedServiceItem[] = [];

  /**
   * Se true, applica i prezzi scontati (discountFE) invece di defaultPrice
   */
  @Input() useScontoFE: boolean = false;

  /**
   * Se true, mostra i prezzi dei servizi
   */
  @Input() showPrices: boolean = true;

  /**
   * Se true, permette di modificare i prezzi individuali
   */
  @Input() editablePrices: boolean = false;

  /**
   * Se true, il componente è disabilitato
   */
  @Input() disabled: boolean = false;

  /**
   * Placeholder del dropdown
   */
  @Input() placeholder: string = 'Aggiungi servizio';

  /**
   * Evento emesso quando cambia la selezione
   */
  @Output() selectedServicesChange = new EventEmitter<SelectedServiceItem[]>();

  /**
   * Evento emesso quando cambia il totale calcolato
   */
  @Output() totalPriceChange = new EventEmitter<number>();

  // ID del servizio selezionato nel dropdown (per aggiunta)
  serviceToAdd: string | null = null;

  // Servizio con prezzo in modifica
  editingPriceIndex: number | null = null;
  editingPriceValue: number | null = null;

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.recalculateTotal();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedServices'] || changes['useScontoFE'] || changes['availableServices']) {
      this.recalculateTotal();
      this.cdr.markForCheck();
    }
  }

  /**
   * Restituisce i servizi disponibili che non sono già selezionati
   */
  get availableToAdd(): SelectableService[] {
    const selectedIds = new Set(this.selectedServices.map(s => s.serviceId));
    return this.availableServices.filter(s => !selectedIds.has(s.id));
  }

  /**
   * Calcola il prezzo totale di tutti i servizi selezionati
   */
  get totalPrice(): number {
    return this.selectedServices.reduce((sum, item) => {
      const price = this.getServicePrice(item);
      return sum + (price ?? 0);
    }, 0);
  }

  /**
   * Restituisce il prezzo da usare per un servizio selezionato.
   * Se isCustomPrice è true, usa customPrice fisso.
   * Altrimenti calcola in base al toggle useScontoFE.
   */
  getServicePrice(item: SelectedServiceItem): number {
    // Se c'è un prezzo personalizzato E il flag isCustomPrice è true, usa quello
    if (item.isCustomPrice && item.customPrice !== undefined && item.customPrice !== null) {
      return item.customPrice;
    }
    // Altrimenti calcola in base a useScontoFE
    const service = item.service || this.availableServices.find(s => s.id === item.serviceId);
    if (!service) return 0;

    if (this.useScontoFE && service.discountFE !== undefined && service.discountFE !== null) {
      return service.discountFE;
    }
    return service.defaultPrice ?? 0;
  }

  /**
   * Restituisce il prezzo per la visualizzazione nel dropdown
   */
  getDisplayPrice(service: SelectableService): number {
    if (this.useScontoFE && service.discountFE !== undefined && service.discountFE !== null) {
      return service.discountFE;
    }
    return service.defaultPrice ?? 0;
  }

  /**
   * Restituisce il nome del servizio
   */
  getServiceName(item: SelectedServiceItem): string {
    const service = item.service || this.availableServices.find(s => s.id === item.serviceId);
    return service?.name ?? 'Servizio sconosciuto';
  }

  /**
   * Aggiunge un servizio alla selezione
   */
  addService(): void {
    if (!this.serviceToAdd || this.disabled) return;

    const service = this.availableServices.find(s => s.id === this.serviceToAdd);
    if (!service) return;

    // Verifica che non sia già selezionato
    if (this.selectedServices.some(s => s.serviceId === this.serviceToAdd)) {
      this.serviceToAdd = null;
      this.cdr.markForCheck();
      return;
    }

    const newItem: SelectedServiceItem = {
      serviceId: service.id,
      service: service,
      orderPosition: this.selectedServices.length
    };

    const updated = [...this.selectedServices, newItem];
    this.emitChange(updated);
    this.serviceToAdd = null;
    this.cdr.markForCheck();
  }

  /**
   * Rimuove un servizio dalla selezione
   */
  removeService(index: number): void {
    if (this.disabled) return;

    const updated = this.selectedServices.filter((_, i) => i !== index);
    // Ricalcola orderPosition
    updated.forEach((item, i) => item.orderPosition = i);
    this.emitChange(updated);
    this.cdr.markForCheck();
  }

  /**
   * Gestisce il drag & drop per riordinare i servizi
   */
  onDrop(event: CdkDragDrop<SelectedServiceItem[]>): void {
    if (this.disabled) return;

    const updated = [...this.selectedServices];
    moveItemInArray(updated, event.previousIndex, event.currentIndex);
    // Aggiorna orderPosition
    updated.forEach((item, i) => item.orderPosition = i);
    this.emitChange(updated);
    this.cdr.markForCheck();
  }

  /**
   * Inizia la modifica del prezzo per un servizio
   */
  startEditPrice(index: number): void {
    if (!this.editablePrices || this.disabled) return;

    this.editingPriceIndex = index;
    this.editingPriceValue = this.getServicePrice(this.selectedServices[index]);
    this.cdr.markForCheck();
  }

  /**
   * Conferma la modifica del prezzo.
   * Imposta isCustomPrice = true per indicare che il prezzo è stato personalizzato.
   */
  confirmEditPrice(): void {
    if (this.editingPriceIndex === null || this.editingPriceValue === null) return;

    const updated = [...this.selectedServices];
    updated[this.editingPriceIndex] = {
      ...updated[this.editingPriceIndex],
      customPrice: this.editingPriceValue,
      isCustomPrice: true
    };

    this.emitChange(updated);
    this.editingPriceIndex = null;
    this.editingPriceValue = null;
    this.cdr.markForCheck();
  }

  /**
   * Annulla la modifica del prezzo
   */
  cancelEditPrice(): void {
    this.editingPriceIndex = null;
    this.editingPriceValue = null;
    this.cdr.markForCheck();
  }

  /**
   * Resetta il prezzo personalizzato (usa il default).
   * Imposta isCustomPrice = false per far seguire la logica scontoFE.
   */
  resetPrice(index: number): void {
    if (this.disabled) return;

    const updated = [...this.selectedServices];
    updated[index] = {
      ...updated[index],
      customPrice: undefined,
      isCustomPrice: false
    };
    this.emitChange(updated);
    this.cdr.markForCheck();
  }

  /**
   * Emette il cambio di selezione e ricalcola il totale
   */
  private emitChange(services: SelectedServiceItem[]): void {
    this.selectedServicesChange.emit(services);
    this.recalculateTotal();
  }

  /**
   * Ricalcola e emette il totale
   */
  private recalculateTotal(): void {
    const total = this.selectedServices.reduce((sum, item) => {
      return sum + this.getServicePrice(item);
    }, 0);
    this.totalPriceChange.emit(total);
  }

  /**
   * Verifica se un servizio ha un prezzo personalizzato manualmente.
   * Usa il flag isCustomPrice per determinarlo.
   */
  hasCustomPrice(item: SelectedServiceItem): boolean {
    return item.isCustomPrice === true;
  }

  /**
   * Gestisce il keydown nel campo prezzo (Enter per confermare, Escape per annullare)
   */
  onPriceKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.confirmEditPrice();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.cancelEditPrice();
    }
  }
}
