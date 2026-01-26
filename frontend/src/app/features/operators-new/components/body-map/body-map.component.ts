/**
 * Body Map Component
 * Layer 1: Dumb Component (Presentational)
 *
 * Responsabilità:
 * - Visualizzare immagine del corpo umano
 * - Permettere click per aggiungere marker X
 * - Permettere click su marker esistente per rimuoverlo
 * - Supporto touch per mobile
 * - Coordinate normalizzate (0-1) per responsiveness
 */

import {
  Component,
  Input,
  Output,
  EventEmitter,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BodyMapMarker, generateId } from '../../models/anamnesis.model';

@Component({
  selector: 'app-body-map',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule
  ],
  template: `
    <div class="body-map-container" [class.readonly]="readonly" [class.edit-mode]="!readonly">
      <!-- Header con istruzioni -->
      @if (!readonly) {
        <div class="instructions">
          <mat-icon>touch_app</mat-icon>
          <span>Clicca sull'immagine per aggiungere un punto. Clicca su un punto esistente per rimuoverlo.</span>
        </div>
      }

      <!-- Canvas container -->
      <div class="canvas-wrapper" #canvasWrapper>
        <canvas
          #canvas
          class="body-canvas"
          (click)="onCanvasClick($event)"
          (touchend)="onCanvasTouchEnd($event)">
        </canvas>

        <!-- Markers overlay (per migliore interattività) -->
        <div class="markers-overlay">
          @for (marker of markers; track marker.id) {
            <div
              class="marker"
              [style.left.%]="marker.x * 100"
              [style.top.%]="marker.y * 100"
              [class.clickable]="!readonly"
              [matTooltip]="marker.note || 'Punto dolore'"
              (click)="onMarkerClick($event, marker)">
              <span class="marker-x">X</span>
            </div>
          }
        </div>
      </div>

      <!-- Counter e azioni -->
      <div class="footer">
        <span class="marker-count">
          {{ markers.length }} {{ markers.length === 1 ? 'punto' : 'punti' }} segnati
        </span>
        @if (!readonly && markers.length > 0) {
          <button mat-button color="warn" (click)="onClearAll()">
            <mat-icon>clear_all</mat-icon>
            Rimuovi tutti
          </button>
        }
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .body-map-container {
      background: #f8fafc;
      border-radius: 12px;
      padding: 16px;
      border: 2px dashed #e2e8f0;
      transition: border-color 0.2s;

      &.edit-mode {
        border-color: #667eea;

        &:hover {
          border-color: #5a67d8;
        }
      }

      &.readonly {
        border-style: solid;
        border-color: #e2e8f0;
      }
    }

    .instructions {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
      padding: 8px 12px;
      background: #eef2ff;
      border-radius: 8px;
      font-size: 0.8125rem;
      color: #4338ca;

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
    }

    .canvas-wrapper {
      position: relative;
      width: 100%;
      max-width: 600px;
      margin: 0 auto;
      background: white;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    }

    .body-canvas {
      display: block;
      width: 100%;
      height: auto;
      cursor: crosshair;

      .readonly & {
        cursor: default;
      }
    }

    .markers-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      pointer-events: none;
    }

    .marker {
      position: absolute;
      transform: translate(-50%, -50%);
      pointer-events: auto;
      z-index: 10;

      &.clickable {
        cursor: pointer;

        &:hover .marker-x {
          color: #dc2626;
          transform: scale(1.2);
        }
      }

      .marker-x {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        font-size: 18px;
        font-weight: 700;
        color: #ef4444;
        text-shadow:
          -1px -1px 0 white,
          1px -1px 0 white,
          -1px 1px 0 white,
          1px 1px 0 white,
          0 0 4px rgba(0, 0, 0, 0.3);
        transition: all 0.15s ease;
      }
    }

    .footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid #e2e8f0;
    }

    .marker-count {
      font-size: 0.8125rem;
      color: #64748b;
    }

    /* Responsive */
    @media (max-width: 599px) {
      .body-map-container {
        padding: 12px;
      }

      .instructions {
        font-size: 0.75rem;
        padding: 6px 10px;
      }

      .marker .marker-x {
        width: 20px;
        height: 20px;
        font-size: 16px;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BodyMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('canvasWrapper') canvasWrapperRef!: ElementRef<HTMLDivElement>;

  @Input() markers: BodyMapMarker[] = [];
  @Input() readonly = false;
  @Input() imageSrc = 'assets/images/digital-body.png';

  @Output() markersChange = new EventEmitter<BodyMapMarker[]>();
  @Output() markerAdded = new EventEmitter<BodyMapMarker>();
  @Output() markerRemoved = new EventEmitter<BodyMapMarker>();

  private image: HTMLImageElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private resizeObserver: ResizeObserver | null = null;

  constructor(private cdr: ChangeDetectorRef) {}

  ngAfterViewInit(): void {
    this.initCanvas();
    this.setupResizeObserver();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['markers'] && this.ctx) {
      this.drawCanvas();
    }
    if (changes['imageSrc'] && this.ctx) {
      this.loadImage();
    }
  }

  ngOnDestroy(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.resizeCanvas();
  }

  private initCanvas(): void {
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d');
    this.loadImage();
  }

  private setupResizeObserver(): void {
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        this.resizeCanvas();
      });
      this.resizeObserver.observe(this.canvasWrapperRef.nativeElement);
    }
  }

  private loadImage(): void {
    this.image = new Image();
    this.image.onload = () => {
      this.resizeCanvas();
    };
    this.image.onerror = () => {
      console.error('[BodyMapComponent] Failed to load image:', this.imageSrc);
    };
    this.image.src = this.imageSrc;
  }

  private resizeCanvas(): void {
    if (!this.image || !this.ctx) return;

    const canvas = this.canvasRef.nativeElement;
    const wrapper = this.canvasWrapperRef.nativeElement;
    const wrapperWidth = wrapper.clientWidth;

    // Mantieni aspect ratio dell'immagine
    const aspectRatio = this.image.height / this.image.width;
    const canvasWidth = wrapperWidth;
    const canvasHeight = wrapperWidth * aspectRatio;

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    canvas.style.height = `${canvasHeight}px`;

    this.drawCanvas();
  }

  private drawCanvas(): void {
    if (!this.ctx || !this.image) return;

    const canvas = this.canvasRef.nativeElement;

    // Clear canvas
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw image
    this.ctx.drawImage(this.image, 0, 0, canvas.width, canvas.height);
  }

  onCanvasClick(event: MouseEvent): void {
    if (this.readonly) return;

    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();

    // Calcola coordinate normalizzate (0-1)
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;

    // Verifica se il click è vicino a un marker esistente (threshold 3%)
    const threshold = 0.03;
    const existingMarker = this.markers.find(m =>
      Math.abs(m.x - x) < threshold && Math.abs(m.y - y) < threshold
    );

    if (existingMarker) {
      // Rimuovi marker esistente
      this.removeMarker(existingMarker);
    } else {
      // Aggiungi nuovo marker
      this.addMarker(x, y);
    }
  }

  onCanvasTouchEnd(event: TouchEvent): void {
    if (this.readonly) return;

    event.preventDefault();
    const touch = event.changedTouches[0];
    if (!touch) return;

    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();

    const x = (touch.clientX - rect.left) / rect.width;
    const y = (touch.clientY - rect.top) / rect.height;

    // Verifica se il touch è vicino a un marker esistente
    const threshold = 0.05; // Threshold più grande per touch
    const existingMarker = this.markers.find(m =>
      Math.abs(m.x - x) < threshold && Math.abs(m.y - y) < threshold
    );

    if (existingMarker) {
      this.removeMarker(existingMarker);
    } else {
      this.addMarker(x, y);
    }
  }

  onMarkerClick(event: MouseEvent, marker: BodyMapMarker): void {
    event.stopPropagation();
    if (this.readonly) return;
    this.removeMarker(marker);
  }

  private addMarker(x: number, y: number): void {
    const newMarker: BodyMapMarker = {
      id: generateId(),
      x,
      y
    };

    const updatedMarkers = [...this.markers, newMarker];
    this.markers = updatedMarkers;
    this.markersChange.emit(updatedMarkers);
    this.markerAdded.emit(newMarker);
    this.cdr.markForCheck();
  }

  private removeMarker(marker: BodyMapMarker): void {
    const updatedMarkers = this.markers.filter(m => m.id !== marker.id);
    this.markers = updatedMarkers;
    this.markersChange.emit(updatedMarkers);
    this.markerRemoved.emit(marker);
    this.cdr.markForCheck();
  }

  onClearAll(): void {
    const removedMarkers = [...this.markers];
    this.markers = [];
    this.markersChange.emit([]);
    removedMarkers.forEach(m => this.markerRemoved.emit(m));
    this.cdr.markForCheck();
  }
}
