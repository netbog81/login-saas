import { Injectable, NgZone, inject } from '@angular/core';
import {
  HttpClient,
  HttpEvent,
  HttpHeaders,
  HttpParams,
} from '@angular/common/http';
import { Observable } from 'rxjs';

/**
 * Wrapper di `HttpClient` che garantisce che ogni emissione (next/error/complete)
 * avvenga dentro la NgZone Angular.
 *
 * Stesso pattern del modulo accounting (core/http/http-zone.service.ts):
 * centralizzando qui il `runInZone` evitiamo di pepare `ngZone.run()` nei
 * service di feature il giorno che si passa a zoneless change detection.
 *
 * Tutti i service di feature REST DEVONO ereditare da BaseRestService che
 * usa internamente questo service — niente injection diretto di HttpClient.
 * (La controparte GraphQL è ApolloZoneService/BaseGraphQLService.)
 */
@Injectable({ providedIn: 'root' })
export class HttpZoneService {
  private readonly http = inject(HttpClient);
  private readonly ngZone = inject(NgZone);

  private runInZone<T>(source$: Observable<T>): Observable<T> {
    return new Observable<T>((subscriber) => {
      const sub = source$.subscribe({
        next: (value) => this.ngZone.run(() => subscriber.next(value)),
        error: (err) => this.ngZone.run(() => subscriber.error(err)),
        complete: () => this.ngZone.run(() => subscriber.complete()),
      });
      return () => sub.unsubscribe();
    });
  }

  get<T>(url: string, options?: { params?: HttpParams; headers?: HttpHeaders }): Observable<T> {
    return this.runInZone(this.http.get<T>(url, options));
  }

  post<T>(url: string, body: unknown, options?: { headers?: HttpHeaders }): Observable<T> {
    return this.runInZone(this.http.post<T>(url, body, options));
  }

  put<T>(url: string, body: unknown, options?: { headers?: HttpHeaders }): Observable<T> {
    return this.runInZone(this.http.put<T>(url, body, options));
  }

  patch<T>(url: string, body: unknown, options?: { headers?: HttpHeaders }): Observable<T> {
    return this.runInZone(this.http.patch<T>(url, body, options));
  }

  delete<T>(url: string, options?: { headers?: HttpHeaders }): Observable<T> {
    return this.runInZone(this.http.delete<T>(url, options));
  }

  /**
   * Upload multipart/form-data con progress events (HttpEvent stream).
   * Il browser imposta il Content-Type col boundary corretto da solo.
   */
  uploadWithProgress<T>(url: string, formData: FormData): Observable<HttpEvent<T>> {
    return this.runInZone(
      this.http.post<T>(url, formData, {
        reportProgress: true,
        observe: 'events',
      }),
    );
  }

  /** Download binario (es. documento decifrato dal backend). */
  getBlob(url: string): Observable<Blob> {
    return this.runInZone(this.http.get(url, { responseType: 'blob' }));
  }
}
