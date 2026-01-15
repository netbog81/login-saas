import { Component, EventEmitter, Input, Output, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.scss'
})
export class ConfirmDialogComponent {
  @Input() title: string = 'Conferma';
  @Input() message: string = 'Sei sicuro di voler procedere?';
  @Input() confirmText: string = 'Conferma';
  @Input() cancelText: string = 'Annulla';
  @Input() confirmButtonClass: string = 'btn-danger';

  @Output() confirm = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  // Overlay click tracking (per evitare chiusura durante click-and-drag)
  overlayMouseDownTarget: EventTarget | null = null;

  constructor(private ngZone: NgZone) {}

  onConfirm(): void {
    this.ngZone.run(() => {
      this.confirm.emit();
    });
  }

  onCancel(): void {
    this.ngZone.run(() => {
      this.cancel.emit();
    });
  }

  onOverlayMouseDown(event: MouseEvent): void {
    this.overlayMouseDownTarget = event.target;
  }

  onOverlayClick(event: MouseEvent): void {
    if (this.overlayMouseDownTarget === event.currentTarget &&
        event.target === event.currentTarget) {
      this.onCancel();
    }
    this.overlayMouseDownTarget = null;
  }
}
