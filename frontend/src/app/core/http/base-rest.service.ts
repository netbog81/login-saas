import { inject } from '@angular/core';
import { HttpEvent, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { HttpZoneService } from './http-zone.service';
import { environment } from '../../../environments/environment';

/**
 * Base class astratta per i service di feature che parlano col backend
 * clinico via REST (operazioni binary: upload/download file).
 *
 * Stesso pattern del modulo accounting (core/http/base-rest.service.ts).
 * Per i metadati/CRUD il clinico resta GraphQL-first (BaseGraphQLService):
 * questa base serve SOLO dove REST è la scelta giusta (multipart, blob).
 *
 * **Da estendere**, non da iniettare. NON usare HttpClient direttamente
 * nei service di feature: tutto passa da qui (NgZone + hook futuri).
 */
export abstract class BaseRestService {
  protected readonly http = inject(HttpZoneService);
  protected readonly baseUrl = environment.apiUrl;

  /** Componi l'URL assoluto da un path relativo (es. "api/patient-documents"). */
  protected url(path: string): string {
    const cleaned = path.replace(/^\/+/, '');
    return `${this.baseUrl}/${cleaned}`;
  }

  protected toParams(
    query?: Record<string, string | number | boolean | undefined | null>,
  ): HttpParams {
    let params = new HttpParams();
    if (!query) return params;
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue;
      params = params.set(key, String(value));
    }
    return params;
  }

  protected getList<T>(
    path: string,
    query?: Record<string, string | number | boolean | undefined | null>,
  ): Observable<T[]> {
    return this.http.get<T[]>(this.url(path), { params: this.toParams(query) });
  }

  protected getOne<T>(
    path: string,
    query?: Record<string, string | number | boolean | undefined | null>,
  ): Observable<T> {
    return this.http.get<T>(this.url(path), { params: this.toParams(query) });
  }

  protected post<T>(path: string, body: unknown): Observable<T> {
    return this.http.post<T>(this.url(path), body);
  }

  protected put<T>(path: string, body: unknown): Observable<T> {
    return this.http.put<T>(this.url(path), body);
  }

  protected patch<T>(path: string, body: unknown): Observable<T> {
    return this.http.patch<T>(this.url(path), body);
  }

  protected remove<T>(path: string): Observable<T> {
    return this.http.delete<T>(this.url(path));
  }

  /** Upload multipart con progress events (per barre di avanzamento). */
  protected uploadWithProgress<T>(path: string, formData: FormData): Observable<HttpEvent<T>> {
    return this.http.uploadWithProgress<T>(this.url(path), formData);
  }

  /** Download binario come Blob. */
  protected downloadBlob(path: string): Observable<Blob> {
    return this.http.getBlob(this.url(path));
  }
}
