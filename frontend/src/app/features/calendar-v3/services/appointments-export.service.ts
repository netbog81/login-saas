/**
 * Appointments Export Service — Calendario V3
 * Layer 3
 *
 * Stampa e esportazione dell'elenco appuntamenti filtrato nella finestra
 * Gestisci Appuntamenti.
 *
 * Nessun GraphQL: lavora su ciò che è già a schermo. È il senso della cosa —
 * la segreteria filtra per operatore e periodo e vuole portarsi via
 * esattamente quello che sta guardando, senza rifare la selezione altrove.
 */

import { Injectable } from '@angular/core';
import { AvailabilityAppointment } from '../../../graphql/generated/types';

/** Una riga dell'elenco, già pronta per la stampa o il CSV. */
interface ExportRow {
  data: string;
  orario: string;
  paziente: string;
  operatore: string;
  servizi: string;
  note: string;
}

@Injectable({ providedIn: 'root' })
export class AppointmentsExportService {
  /**
   * Apre l'anteprima di stampa dell'elenco.
   *
   * Usa una finestra nuova invece di `@media print` sulla pagina corrente:
   * la finestra Gestisci Appuntamenti è un overlay dentro un calendario
   * fitto, e stamparla dal documento vivo significherebbe combattere con gli
   * stili di mezza applicazione.
   */
  print(title: string, subtitle: string, appointments: AvailabilityAppointment[]): void {
    const rows = appointments.map(a => this.toRow(a));
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) {
      // Popup bloccato dal browser: meglio dirlo che lasciare il pulsante muto.
      alert('Il browser ha bloccato la finestra di stampa. Consenti i popup per questo sito.');
      return;
    }

    win.document.write(this.buildPrintHtml(title, subtitle, rows));
    win.document.close();
    win.focus();
    // Il print parte dopo il render del documento appena scritto.
    win.onload = () => win.print();
  }

  /** Scarica l'elenco come CSV (separatore `;`, come si aspetta Excel in italiano). */
  exportCsv(fileName: string, appointments: AvailabilityAppointment[]): void {
    const rows = appointments.map(a => this.toRow(a));
    const header = ['Data', 'Orario', 'Paziente', 'Operatore', 'Servizi', 'Note'];
    const lines = [
      header.join(';'),
      ...rows.map(r => [r.data, r.orario, r.paziente, r.operatore, r.servizi, r.note]
        .map(v => this.csvCell(v)).join(';')),
    ];

    // BOM: senza, Excel apre il file in latin-1 e gli accenti diventano illeggibili.
    const blob = new Blob(['﻿' + lines.join('\r\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileName}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  private toRow(a: AvailabilityAppointment): ExportRow {
    const operator = a.operator
      ? `${a.operator.name ?? ''} ${a.operator.surname ?? ''}`.trim()
      : '';
    const services = (a.appointmentServices ?? [])
      .map(s => s.service?.name)
      .filter((n): n is string => !!n)
      .join(', ');

    return {
      data: this.formatDate(String(a.appointmentDate).slice(0, 10)),
      orario: `${String(a.startTime).slice(0, 5)} - ${String(a.endTime).slice(0, 5)}`,
      paziente: a.nonRetribuito
        ? (a.clientName?.trim() || 'Fascia non retribuita')
        : (a.clientName?.trim() || ''),
      operatore: operator,
      servizi: services,
      note: a.notes ?? '',
    };
  }

  private formatDate(date: string): string {
    return new Date(date + 'T00:00:00').toLocaleDateString('it-IT', {
      weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric',
    });
  }

  /** Escape CSV: virgolette raddoppiate e campo quotato se contiene separatori. */
  private csvCell(value: string): string {
    const v = value ?? '';
    return /[";\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  }

  private buildPrintHtml(title: string, subtitle: string, rows: ExportRow[]): string {
    const body = rows.length === 0
      ? '<p class="empty">Nessun appuntamento nel periodo selezionato.</p>'
      : `<table>
          <thead>
            <tr>
              <th>Data</th><th>Orario</th><th>Paziente</th>
              <th>Operatore</th><th>Servizi</th><th>Note</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => `<tr>
              <td>${this.escapeHtml(r.data)}</td>
              <td class="nowrap">${this.escapeHtml(r.orario)}</td>
              <td>${this.escapeHtml(r.paziente)}</td>
              <td>${this.escapeHtml(r.operatore)}</td>
              <td>${this.escapeHtml(r.servizi)}</td>
              <td class="notes">${this.escapeHtml(r.note)}</td>
            </tr>`).join('')}
          </tbody>
        </table>`;

    const printedAt = new Date().toLocaleString('it-IT', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });

    return `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<title>${this.escapeHtml(title)}</title>
<style>
  body { font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #1e293b; margin: 24px; }
  h1 { font-size: 1.15rem; margin: 0 0 2px; }
  .subtitle { font-size: 0.86rem; color: #475569; margin: 0 0 2px; }
  .meta { font-size: 0.74rem; color: #94a3b8; margin: 0 0 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
  th, td { border-bottom: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #f1f5f9; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.03em; color: #475569; }
  td.nowrap { white-space: nowrap; }
  td.notes { color: #64748b; font-style: italic; }
  .empty { font-style: italic; color: #64748b; }
  tr { page-break-inside: avoid; }
  thead { display: table-header-group; }
  @media print { body { margin: 0; } }
</style>
</head>
<body>
  <h1>${this.escapeHtml(title)}</h1>
  <p class="subtitle">${this.escapeHtml(subtitle)}</p>
  <p class="meta">${rows.length} ${rows.length === 1 ? 'appuntamento' : 'appuntamenti'} · stampato il ${printedAt}</p>
  ${body}
</body>
</html>`;
  }

  private escapeHtml(value: string): string {
    return (value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
