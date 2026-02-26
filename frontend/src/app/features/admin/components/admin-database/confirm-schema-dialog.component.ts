import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-confirm-schema-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>
      <mat-icon color="warn">warning</mat-icon>
      Conferma Creazione Schema
    </h2>
    <mat-dialog-content>
      <p>
        Stai per creare lo schema database per il tenant corrente:
      </p>
      <p><code>{{ data.schemaName }}</code></p>
      <p>
        Questa operazione:
      </p>
      <ul>
        <li>Creerà il schema PostgreSQL <strong>{{ data.schemaName }}</strong></li>
        <li>Eseguirà tutte le migrazioni del database</li>
        <li>Notificherà l'Auth DB per attivare il tenant</li>
      </ul>
      <p>L'operazione non è reversibile. Vuoi procedere?</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-stroked-button [mat-dialog-close]="false">Annulla</button>
      <button mat-raised-button color="primary" [mat-dialog-close]="true">
        Sì, Crea Schema
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    h2 { display: flex; align-items: center; gap: 8px; }
    code { background: #f5f5f5; padding: 2px 8px; border-radius: 4px; font-size: 1rem; }
    ul { margin: 8px 0; padding-left: 20px; }
    li { margin-bottom: 4px; }
  `],
})
export class ConfirmSchemaDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<ConfirmSchemaDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { schemaName: string },
  ) {}
}
