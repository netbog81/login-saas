import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDropList, CdkDrag, CdkDragDrop, CdkDragPlaceholder, moveItemInArray } from '@angular/cdk/drag-drop';
import { MatIconModule } from '@angular/material/icon';
import { WaitingListEntry, UpdateWaitingListEntryInput } from '../../../../models/waiting-list.model';
import { WaitingListCardComponent } from '../waiting-list-card/waiting-list-card.component';
import { WaitingListOperator } from '../waiting-list-form/waiting-list-form.component';

@Component({
  selector: 'app-waiting-list-cards-list',
  standalone: true,
  imports: [
    CommonModule,
    CdkDropList,
    CdkDrag,
    CdkDragPlaceholder,
    MatIconModule,
    WaitingListCardComponent,
  ],
  templateUrl: './waiting-list-cards-list.component.html',
  styleUrls: ['./waiting-list-cards-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WaitingListCardsListComponent {
  @Input() entries: WaitingListEntry[] = [];
  @Input() operators: WaitingListOperator[] = [];
  @Output() update = new EventEmitter<{ id: string; changes: UpdateWaitingListEntryInput }>();
  @Output() delete = new EventEmitter<string>();
  @Output() reorder = new EventEmitter<{ id: string; position: number }[]>();

  onDrop(event: CdkDragDrop<WaitingListEntry[]>): void {
    if (event.previousIndex === event.currentIndex) return;

    const reordered = [...this.entries];
    moveItemInArray(reordered, event.previousIndex, event.currentIndex);

    const newOrder = reordered.map((entry, index) => ({
      id: entry.id,
      position: index,
    }));

    this.reorder.emit(newOrder);
  }

  onUpdate(event: { id: string; changes: UpdateWaitingListEntryInput }): void {
    this.update.emit(event);
  }

  onDelete(id: string): void {
    this.delete.emit(id);
  }

  trackById(_index: number, entry: WaitingListEntry): string {
    return entry.id;
  }
}
