import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { CashMovementType, CashSession } from '../models/cash.model';

@Injectable({ providedIn: 'root' })
export class CashService {
  private readonly http = inject(HttpClient);
  private readonly url = environment.apiUrl;
  sessions(eventId: string) {
    return this.http.get<CashSession[]>(`${this.url}/events/${eventId}/cash/sessions`);
  }
  open(eventId: string, data: { locationId: string; openingAmount: number; notes?: string }) {
    return this.http.post<CashSession>(`${this.url}/events/${eventId}/cash/sessions`, data);
  }
  movement(
    eventId: string,
    sessionId: string,
    data: {
      type: CashMovementType;
      amount: number;
      concept: string;
      notes?: string;
      cupTypeId?: string;
      cupQuantity?: number;
    },
  ) {
    return this.http.post<CashSession>(
      `${this.url}/events/${eventId}/cash/sessions/${sessionId}/movements`,
      data,
    );
  }
  close(eventId: string, sessionId: string, closingAmount: number, notes?: string) {
    return this.http.post<CashSession>(
      `${this.url}/events/${eventId}/cash/sessions/${sessionId}/close`,
      { closingAmount, notes },
    );
  }
  transfer(
    eventId: string,
    data: {
      originSessionId: string;
      destinationSessionId: string;
      amount: number;
      concept: string;
      notes?: string;
    },
  ) {
    return this.http.post(`${this.url}/events/${eventId}/cash/transfers`, data);
  }

  centralSessions() {
    return this.http.get<CashSession[]>(`${this.url}/warehouse/cash/sessions`);
  }
  centralOpen(data: { locationId: string; openingAmount: number; notes?: string }) {
    return this.http.post<CashSession>(`${this.url}/warehouse/cash/sessions`, data);
  }
  centralMovement(
    sessionId: string,
    data: { type: CashMovementType; amount: number; concept: string; notes?: string },
  ) {
    return this.http.post<CashSession>(
      `${this.url}/warehouse/cash/sessions/${sessionId}/movements`,
      data,
    );
  }
  centralClose(sessionId: string, closingAmount: number, notes?: string) {
    return this.http.post<CashSession>(`${this.url}/warehouse/cash/sessions/${sessionId}/close`, {
      closingAmount,
      notes,
    });
  }
  centralTransfer(data: {
    originSessionId: string;
    destinationSessionId: string;
    amount: number;
    concept: string;
    notes?: string;
  }) {
    return this.http.post(`${this.url}/warehouse/cash/transfers`, data);
  }
  centralSettlement(data: {
    originSessionId: string;
    destinationSessionId: string;
    amount: number;
    concept: string;
    notes?: string;
  }) {
    return this.http.post(`${this.url}/warehouse/cash/settlements`, data);
  }
}
