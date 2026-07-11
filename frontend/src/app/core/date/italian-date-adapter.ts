import { Injectable } from '@angular/core';
import { NativeDateAdapter } from '@angular/material/core';

/**
 * DateAdapter che accetta l'input testuale nel formato italiano GG/MM/AAAA.
 *
 * Il `NativeDateAdapter` di Angular Material ignora il locale in `parse()` e usa
 * `Date.parse()`, che segue la convenzione US MM/GG/AAAA: digitando a mano
 * "15/06/2026" il campo va in errore (rosso), mentre "06/15/2026" viene
 * accettato. `MAT_DATE_LOCALE = 'it-IT'` sistema solo la VISUALIZZAZIONE, non
 * il parsing di ciò che l'utente digita.
 *
 * Qui sovrascriviamo SOLO `parse()` per interpretare GG/MM/AAAA (accettando
 * anche i separatori `-` e `.`). La selezione dal calendario e la
 * visualizzazione restano invariate (native, già GG/MM/AAAA con it-IT), quindi
 * `format()` non va toccato. Provider unico in `app.config.ts` → vale per ogni
 * `matDatepicker` dell'app.
 */
@Injectable()
export class ItalianDateAdapter extends NativeDateAdapter {
  override parse(value: any, parseFormat?: any): Date | null {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) {
        return null;
      }
      // GG/MM/AAAA (giorno e mese 1-2 cifre, anno 2 o 4 cifre), separatori / - .
      const match = trimmed.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
      if (match) {
        const day = Number(match[1]);
        const month = Number(match[2]);
        let year = Number(match[3]);
        if (year < 100) {
          year += 2000;
        }
        if (month < 1 || month > 12 || day < 1 || day > 31) {
          return this.invalid();
        }
        // Costruzione in ora locale a mezzanotte, come fa il native adapter per
        // le date scelte dal popup. `new Date(...)` normalizza gli overflow
        // (es. 31/02 → 03/03): li rifiutiamo verificando che i componenti
        // combacino con quanto digitato.
        const date = new Date(year, month - 1, day);
        if (
          date.getFullYear() !== year ||
          date.getMonth() !== month - 1 ||
          date.getDate() !== day
        ) {
          return this.invalid();
        }
        return date;
      }
    }
    return super.parse(value, parseFormat);
  }
}
