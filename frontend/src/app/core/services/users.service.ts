import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AppUser, EventSummary } from '../models/auth.model';

@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}`;
  list() {
    return this.http.get<AppUser[]>(`${this.url}/users`);
  }
  create(data: unknown) {
    return this.http.post<AppUser>(`${this.url}/users`, data);
  }
  update(id: string, data: unknown) {
    return this.http.patch<AppUser>(`${this.url}/users/${id}`, data);
  }
  setStatus(id: string, active: boolean) {
    return this.http.patch<AppUser>(`${this.url}/users/${id}/status`, { active });
  }
  events() {
    return this.http.get<EventSummary[]>(`${this.url}/events`);
  }
  assignments(eventId: string) {
    return this.http.get<unknown[]>(`${this.url}/events/${eventId}/users`);
  }
  candidates(eventId: string) {
    return this.http.get<
      Array<{ id: string; name: string; email: string; active: boolean; globalRole: string }>
    >(`${this.url}/events/${eventId}/user-candidates`);
  }
  assign(eventId: string, userId: string, role: string) {
    return this.http.post(`${this.url}/events/${eventId}/users`, { userId, role });
  }
  updateAssignment(eventId: string, userId: string, role: string) {
    return this.http.patch(`${this.url}/events/${eventId}/users/${userId}`, { userId, role });
  }
  remove(eventId: string, userId: string) {
    return this.http.delete(`${this.url}/events/${eventId}/users/${userId}`);
  }
}
