import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';

import { GymRoomListComponent } from './gym-room-list/gym-room-list.component';
import { GymTemplateEditorComponent } from './gym-template-editor/gym-template-editor.component';
import { GymExceptionManagerComponent } from './gym-exception-manager/gym-exception-manager.component';

export interface GymRoom {
  id: string;
  name: string;
  maxCapacity: number;
  slotDuration: number;
  color?: string;
  defaultStartTime?: string;
  defaultEndTime?: string;
  isActive: boolean;
}

type GymTabType = 'rooms' | 'templates' | 'exceptions';

@Component({
  selector: 'app-gym-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    GymRoomListComponent,
    GymTemplateEditorComponent,
    GymExceptionManagerComponent,
  ],
  templateUrl: './gym-management.component.html',
  styleUrls: ['./gym-management.component.scss'],
})
export class GymManagementComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  activeTab: GymTabType = 'rooms';
  selectedGymRoom: GymRoom | null = null;
  gymRooms: GymRoom[] = [];

  constructor() {}

  ngOnInit() {
    // I dati delle palestre saranno caricati dal GymRoomListComponent
    // e emessi tramite output per essere usati qui
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  setActiveTab(tab: GymTabType) {
    this.activeTab = tab;
  }

  onGymRoomSelect(gymRoom: GymRoom) {
    this.selectedGymRoom = gymRoom;
  }

  onGymRoomsLoaded(gymRooms: GymRoom[]) {
    this.gymRooms = gymRooms;
    // Seleziona la prima palestra se disponibile e nessuna è selezionata
    if (gymRooms.length > 0 && !this.selectedGymRoom) {
      this.selectedGymRoom = gymRooms[0];
    }
  }

  openTemplateEditor(gymRoom: GymRoom) {
    this.selectedGymRoom = gymRoom;
    this.activeTab = 'templates';
  }

  openExceptionManager(gymRoom: GymRoom) {
    this.selectedGymRoom = gymRoom;
    this.activeTab = 'exceptions';
  }

  compareGymRooms(a: GymRoom | null, b: GymRoom | null): boolean {
    return a && b ? a.id === b.id : a === b;
  }
}
