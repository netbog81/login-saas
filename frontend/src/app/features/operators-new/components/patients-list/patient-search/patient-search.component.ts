/**
 * Patient Search Component
 * Layer 1: UI Component (Dumb)
 *
 * Responsabilità:
 * - Renderizzare il campo di ricerca con icona
 * - Emettere evento di ricerca con debounce
 */

import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-patient-search',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule
  ],
  template: `
    <div class="search-container">
      <mat-form-field appearance="outline" class="search-field">
        <mat-icon matPrefix class="search-icon">search</mat-icon>
        <input matInput
               type="text"
               [placeholder]="placeholder"
               [(ngModel)]="searchValue"
               (ngModelChange)="onSearchChange($event)"
               [disabled]="disabled">
        @if (searching) {
          <mat-spinner matSuffix diameter="20"></mat-spinner>
        } @else if (searchValue) {
          <button matSuffix mat-icon-button (click)="clearSearch()">
            <mat-icon>close</mat-icon>
          </button>
        }
      </mat-form-field>
    </div>
  `,
  styles: [`
    .search-container {
      width: 100%;
      max-width: 400px;
    }

    .search-field {
      width: 100%;

      ::ng-deep .mat-mdc-form-field-subscript-wrapper {
        display: none;
      }
    }

    .search-icon {
      color: #64748b;
    }

    /* Responsive */
    @media (max-width: 599px) {
      .search-container {
        max-width: 100%;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientSearchComponent implements OnInit, OnDestroy {
  @Input() placeholder: string = 'Cerca paziente per nome, cognome o telefono...';
  @Input() searching: boolean = false;
  @Input() disabled: boolean = false;
  @Input() debounceMs: number = 300;

  @Output() search = new EventEmitter<string>();

  searchValue: string = '';

  private searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.searchSubject.pipe(
      debounceTime(this.debounceMs),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(term => {
      this.search.emit(term);
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSearchChange(value: string): void {
    this.searchSubject.next(value);
  }

  clearSearch(): void {
    this.searchValue = '';
    this.search.emit('');
  }
}
