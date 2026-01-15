import { Component, OnInit, OnDestroy, Output, EventEmitter, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';

import { GymRoomService, GymRoom, CreateGymRoomInput, UpdateGymRoomInput } from '../../../../services/gym-room.service';

@Component({
  selector: 'app-gym-room-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './gym-room-list.component.html',
  styleUrls: ['./gym-room-list.component.scss'],
})
export class GymRoomListComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  @Output() gymRoomSelected = new EventEmitter<GymRoom>();
  @Output() gymRoomsLoaded = new EventEmitter<GymRoom[]>();
  @Output() openTemplate = new EventEmitter<GymRoom>();
  @Output() openExceptions = new EventEmitter<GymRoom>();

  gymRooms: GymRoom[] = [];
  selectedGymRoom: GymRoom | null = null;
  loading = false;
  error: string | null = null;

  // Form state
  showForm = false;
  isEditMode = false;
  editingGymRoom: Partial<CreateGymRoomInput> & { id?: string; isActive?: boolean } = {
    name: '',
    maxCapacity: 4,
    slotDuration: 60,
    color: '#4A90E2',
    defaultStartTime: '07:00',
    defaultEndTime: '21:00',
    isActive: true,
  };

  // Overlay click tracking (per evitare chiusura durante click-and-drag)
  overlayMouseDownTarget: EventTarget | null = null;

  constructor(
    private gymRoomService: GymRoomService,
    private ngZone: NgZone
  ) {}

  ngOnInit() {
    this.loadGymRooms();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadGymRooms() {
    this.loading = true;
    this.error = null;

    this.gymRoomService.getAll()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (gymRooms) => {
          this.gymRooms = gymRooms;
          this.gymRoomsLoaded.emit(gymRooms);
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading gym rooms:', error);
          this.error = 'Errore nel caricamento delle palestre';
          this.loading = false;
        },
      });
  }

  selectGymRoom(gymRoom: GymRoom) {
    this.ngZone.run(() => {
      this.selectedGymRoom = gymRoom;
      this.gymRoomSelected.emit(gymRoom);
    });
  }

  openForm(gymRoom?: GymRoom) {
    this.ngZone.run(() => {
      if (gymRoom) {
        this.isEditMode = true;
        this.editingGymRoom = {
          id: gymRoom.id,
          name: gymRoom.name,
          maxCapacity: gymRoom.maxCapacity,
          slotDuration: gymRoom.slotDuration,
          color: gymRoom.color || '#4A90E2',
          defaultStartTime: gymRoom.defaultStartTime || '07:00',
          defaultEndTime: gymRoom.defaultEndTime || '21:00',
          isActive: gymRoom.isActive,
        };
      } else {
        this.isEditMode = false;
        this.editingGymRoom = {
          name: '',
          maxCapacity: 4,
          slotDuration: 60,
          color: '#4A90E2',
          defaultStartTime: '07:00',
          defaultEndTime: '21:00',
          isActive: true,
        };
      }
      this.showForm = true;
      this.error = null;
    });
  }

  closeForm() {
    this.ngZone.run(() => {
      this.showForm = false;
      this.isEditMode = false;
      this.editingGymRoom = {
        name: '',
        maxCapacity: 4,
        slotDuration: 60,
        color: '#4A90E2',
        defaultStartTime: '07:00',
        defaultEndTime: '21:00',
        isActive: true,
      };
      this.error = null;
    });
  }

  saveGymRoom() {
    if (this.loading) return;

    const name = this.editingGymRoom.name?.trim();
    if (!name) {
      this.error = 'Il nome è obbligatorio';
      return;
    }

    this.loading = true;
    this.error = null;

    if (this.isEditMode && this.editingGymRoom.id) {
      const input: UpdateGymRoomInput = {
        name,
        maxCapacity: this.editingGymRoom.maxCapacity,
        slotDuration: this.editingGymRoom.slotDuration,
        color: this.editingGymRoom.color,
        defaultStartTime: this.editingGymRoom.defaultStartTime,
        defaultEndTime: this.editingGymRoom.defaultEndTime,
        isActive: this.editingGymRoom.isActive,
      };

      this.gymRoomService.update(this.editingGymRoom.id, input)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.loadGymRooms();
            this.closeForm();
          },
          error: (error) => {
            console.error('Error updating gym room:', error);
            this.error = 'Errore nell\'aggiornamento della palestra';
            this.loading = false;
          },
        });
    } else {
      const input: CreateGymRoomInput = {
        name,
        maxCapacity: this.editingGymRoom.maxCapacity,
        slotDuration: this.editingGymRoom.slotDuration,
        color: this.editingGymRoom.color,
        defaultStartTime: this.editingGymRoom.defaultStartTime,
        defaultEndTime: this.editingGymRoom.defaultEndTime,
      };

      this.gymRoomService.create(input)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.loadGymRooms();
            this.closeForm();
          },
          error: (error) => {
            console.error('Error creating gym room:', error);
            this.error = 'Errore nella creazione della palestra';
            this.loading = false;
          },
        });
    }
  }

  deleteGymRoom(gymRoom: GymRoom) {
    this.ngZone.run(() => {
      if (!confirm(`Sei sicuro di voler eliminare la palestra "${gymRoom.name}"? Verranno eliminati anche tutti i template e le eccezioni associate.`)) {
        return;
      }

      this.loading = true;
      this.gymRoomService.delete(gymRoom.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.loadGymRooms();
            if (this.selectedGymRoom?.id === gymRoom.id) {
              this.selectedGymRoom = null;
            }
          },
          error: (error) => {
            console.error('Error deleting gym room:', error);
            this.error = 'Errore nell\'eliminazione della palestra';
            this.loading = false;
          },
        });
    });
  }

  onOpenTemplate(gymRoom: GymRoom) {
    this.ngZone.run(() => {
      this.openTemplate.emit(gymRoom);
    });
  }

  onOpenExceptions(gymRoom: GymRoom) {
    this.ngZone.run(() => {
      this.openExceptions.emit(gymRoom);
    });
  }

  // Overlay click handlers (previene chiusura durante selezione testo con click-and-drag)
  onOverlayMouseDown(event: MouseEvent): void {
    this.overlayMouseDownTarget = event.target;
  }

  onOverlayClick(event: MouseEvent): void {
    if (this.overlayMouseDownTarget === event.currentTarget &&
        event.target === event.currentTarget) {
      this.closeForm();
    }
    this.overlayMouseDownTarget = null;
  }
}
