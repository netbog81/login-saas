import { Component, OnInit, OnDestroy, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { RoomService, Room, Chair } from '../../../services/room.service';

/**
 * Configurazione "Studi e Poltrone": CRUD degli studi (rooms) e delle
 * poltrone (chairs) al loro interno. Studi e poltrone vengono poi associati
 * alle assegnazioni template degli operatori.
 */
@Component({
  selector: 'app-room-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './room-management.component.html',
  styleUrls: ['./room-management.component.scss'],
})
export class RoomManagementComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  rooms: Room[] = [];
  loading = false;
  error: string | null = null;
  showInactive = false;

  // Form studio (modal)
  showRoomForm = false;
  isEditMode = false;
  editingRoom: { id?: string; name: string; capacity: number; color: string; isActive: boolean } =
    this.emptyRoomForm();

  // Form poltrona inline (per studio)
  chairFormRoomId: string | null = null;
  editingChairId: string | null = null;
  chairName = '';

  // Overlay click tracking (per evitare chiusura durante click-and-drag)
  overlayMouseDownTarget: EventTarget | null = null;

  constructor(
    private roomService: RoomService,
    private ngZone: NgZone
  ) {}

  ngOnInit() {
    this.loadRooms();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private emptyRoomForm() {
    return { name: '', capacity: 1, color: '#4A90E2', isActive: true };
  }

  get visibleRooms(): Room[] {
    return this.showInactive ? this.rooms : this.rooms.filter((r) => r.isActive);
  }

  visibleChairs(room: Room): Chair[] {
    const chairs = room.chairs || [];
    return this.showInactive ? chairs : chairs.filter((c) => c.isActive);
  }

  /** Capacità effettiva ai fini dei conflitti: poltrone attive o fallback capacity. */
  effectiveCapacity(room: Room): number {
    const activeChairs = (room.chairs || []).filter((c) => c.isActive).length;
    return activeChairs > 0 ? activeChairs : room.capacity || 1;
  }

  loadRooms() {
    this.loading = true;
    this.error = null;

    this.roomService.getRooms()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (rooms) => {
          this.rooms = rooms;
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading rooms:', error);
          this.error = 'Errore nel caricamento degli studi';
          this.loading = false;
        },
      });
  }

  // ==================== Studi ====================

  openRoomForm(room?: Room) {
    this.ngZone.run(() => {
      if (room) {
        this.isEditMode = true;
        this.editingRoom = {
          id: room.id,
          name: room.name,
          capacity: room.capacity,
          color: room.color || '#4A90E2',
          isActive: room.isActive,
        };
      } else {
        this.isEditMode = false;
        this.editingRoom = this.emptyRoomForm();
      }
      this.showRoomForm = true;
      this.error = null;
    });
  }

  closeRoomForm() {
    this.ngZone.run(() => {
      this.showRoomForm = false;
      this.isEditMode = false;
      this.editingRoom = this.emptyRoomForm();
    });
  }

  saveRoom() {
    if (this.loading) return;

    const name = this.editingRoom.name?.trim();
    if (!name) {
      this.error = 'Il nome dello studio è obbligatorio';
      return;
    }

    this.loading = true;
    this.error = null;

    const obs$ = this.isEditMode && this.editingRoom.id
      ? this.roomService.updateRoom(this.editingRoom.id, {
          name,
          capacity: this.editingRoom.capacity,
          color: this.editingRoom.color,
          isActive: this.editingRoom.isActive,
        })
      : this.roomService.createRoom({
          name,
          capacity: this.editingRoom.capacity,
          color: this.editingRoom.color,
        });

    obs$.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.loadRooms();
        this.closeRoomForm();
      },
      error: (error) => {
        console.error('Error saving room:', error);
        this.error = this.extractErrorMessage(error, 'Errore nel salvataggio dello studio');
        this.loading = false;
      },
    });
  }

  toggleRoomActive(room: Room) {
    this.roomService.updateRoom(room.id, { isActive: !room.isActive })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.loadRooms(),
        error: (error) => {
          this.error = this.extractErrorMessage(error, 'Errore nell\'aggiornamento dello studio');
        },
      });
  }

  deleteRoom(room: Room) {
    this.ngZone.run(() => {
      const chairCount = room.chairs?.length || 0;
      const chairNote = chairCount > 0
        ? `\nVerranno eliminate anche le ${chairCount} poltrone configurate.`
        : '';
      if (!confirm(`Eliminare lo studio "${room.name}"?${chairNote}`)) return;

      this.loading = true;
      this.roomService.deleteRoom(room.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => this.loadRooms(),
          error: (error) => {
            console.error('Error deleting room:', error);
            this.error = this.extractErrorMessage(error, 'Errore nell\'eliminazione dello studio');
            this.loading = false;
          },
        });
    });
  }

  // ==================== Poltrone ====================

  openChairForm(room: Room, chair?: Chair) {
    this.ngZone.run(() => {
      this.chairFormRoomId = room.id;
      this.editingChairId = chair?.id || null;
      this.chairName = chair?.name || '';
      this.error = null;
    });
  }

  closeChairForm() {
    this.ngZone.run(() => {
      this.chairFormRoomId = null;
      this.editingChairId = null;
      this.chairName = '';
    });
  }

  saveChair() {
    const name = this.chairName?.trim();
    if (!name || !this.chairFormRoomId) {
      this.error = 'Il nome della poltrona è obbligatorio';
      return;
    }

    const obs$ = this.editingChairId
      ? this.roomService.updateChair(this.editingChairId, { name })
      : this.roomService.createChair({ roomId: this.chairFormRoomId, name });

    obs$.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.closeChairForm();
        this.loadRooms();
      },
      error: (error) => {
        console.error('Error saving chair:', error);
        this.error = this.extractErrorMessage(error, 'Errore nel salvataggio della poltrona');
      },
    });
  }

  toggleChairActive(chair: Chair) {
    this.roomService.updateChair(chair.id, { isActive: !chair.isActive })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.loadRooms(),
        error: (error) => {
          this.error = this.extractErrorMessage(error, 'Errore nell\'aggiornamento della poltrona');
        },
      });
  }

  deleteChair(room: Room, chair: Chair) {
    this.ngZone.run(() => {
      if (!confirm(`Eliminare la poltrona "${chair.name}" dello studio "${room.name}"?`)) return;

      this.roomService.deleteChair(chair.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => this.loadRooms(),
          error: (error) => {
            console.error('Error deleting chair:', error);
            this.error = this.extractErrorMessage(error, 'Errore nell\'eliminazione della poltrona');
          },
        });
    });
  }

  private extractErrorMessage(err: any, fallback: string): string {
    return err?.graphQLErrors?.[0]?.message || err?.message || fallback;
  }

  trackByRoomId(index: number, room: Room): string {
    return room.id;
  }

  trackByChairId(index: number, chair: Chair): string {
    return chair.id;
  }

  // Overlay click handlers (previene chiusura durante selezione testo con click-and-drag)
  onOverlayMouseDown(event: MouseEvent): void {
    this.overlayMouseDownTarget = event.target;
  }

  onOverlayClick(event: MouseEvent): void {
    if (this.overlayMouseDownTarget === event.currentTarget &&
        event.target === event.currentTarget) {
      this.closeRoomForm();
    }
    this.overlayMouseDownTarget = null;
  }
}
