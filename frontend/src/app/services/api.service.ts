import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { User } from '../models/user.model';
import { Patient } from '../models/patient.model';
import { Appointment } from '../models/appointment.model';
import { Availability } from '../models/availability.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // Users
  getUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.baseUrl}/users`);
  }

  getUser(id: number): Observable<User> {
    return this.http.get<User>(`${this.baseUrl}/users/${id}`);
  }

  // Patients
  getPatients(search?: string): Observable<Patient[]> {
    const url = search
      ? `${this.baseUrl}/patients?search=${encodeURIComponent(search)}`
      : `${this.baseUrl}/patients`;
    return this.http.get<Patient[]>(url);
  }

  getPatient(id: number): Observable<Patient> {
    return this.http.get<Patient>(`${this.baseUrl}/patients/${id}`);
  }

  createPatient(patient: Partial<Patient>): Observable<Patient> {
    return this.http.post<Patient>(`${this.baseUrl}/patients`, patient);
  }

  updatePatient(id: number, patient: Partial<Patient>): Observable<Patient> {
    return this.http.put<Patient>(`${this.baseUrl}/patients/${id}`, patient);
  }

  // Appointments
  getAppointmentsByDate(date: string, operatorId?: string): Observable<Appointment[]> {
    const params = operatorId ? `?date=${date}&operatorId=${operatorId}` : `?date=${date}`;
    return this.http.get<Appointment[]>(`${this.baseUrl}/appointments/by-date${params}`);
  }

  getAppointmentsByDateRange(startDate: string, endDate: string, operatorId?: string): Observable<Appointment[]> {
    const params = operatorId
      ? `?startDate=${startDate}&endDate=${endDate}&operatorId=${operatorId}`
      : `?startDate=${startDate}&endDate=${endDate}`;
    return this.http.get<Appointment[]>(`${this.baseUrl}/appointments${params}`);
  }

  createAppointment(appointment: Partial<Appointment>): Observable<Appointment[]> {
    return this.http.post<Appointment[]>(`${this.baseUrl}/appointments`, appointment);
  }

  updateAppointment(id: number, appointment: Partial<Appointment>): Observable<Appointment> {
    return this.http.put<Appointment>(`${this.baseUrl}/appointments/${id}`, appointment);
  }

  deleteAppointment(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/appointments/${id}`);
  }

  checkAvailability(
    operatorId: string,
    date: string,
    startTime: string,
    endTime: string,
    excludeId?: number
  ): Observable<boolean> {
    let params = `operatorId=${operatorId}&date=${date}&startTime=${startTime}&endTime=${endTime}`;
    if (excludeId) {
      params += `&excludeId=${excludeId}`;
    }
    return this.http.get<boolean>(`${this.baseUrl}/appointments/check-availability?${params}`);
  }

  // Availabilities
  getAvailabilitiesByDate(date: string, userId?: number): Observable<Availability[]> {
    const params = userId ? `?date=${date}&userId=${userId}` : `?date=${date}`;
    return this.http.get<Availability[]>(`${this.baseUrl}/availabilities/by-date${params}`);
  }

  getAvailabilitiesByDateRange(startDate: string, endDate: string, userId?: number): Observable<Availability[]> {
    const params = userId
      ? `?startDate=${startDate}&endDate=${endDate}&userId=${userId}`
      : `?startDate=${startDate}&endDate=${endDate}`;
    return this.http.get<Availability[]>(`${this.baseUrl}/availabilities${params}`);
  }

  createAvailability(availability: Partial<Availability>): Observable<Availability> {
    return this.http.post<Availability>(`${this.baseUrl}/availabilities`, availability);
  }

  createBulkAvailabilities(availabilities: Partial<Availability>[]): Observable<Availability[]> {
    return this.http.post<Availability[]>(`${this.baseUrl}/availabilities/bulk`, availabilities);
  }

  setDefaultAvailability(data: {
    userId: number;
    startDate: string;
    endDate: string;
    startTime: string;
    endTime: string;
  }): Observable<Availability[]> {
    return this.http.post<Availability[]>(`${this.baseUrl}/availabilities/set-default`, data);
  }
}
