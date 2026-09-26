import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import {
  Bar,
  Booth,
  CentralWarehouseOverview,
  CupType,
  DeliveryNote,
  EventModel,
  Location,
  StockMovement,
  StockMovementType,
  StockResponse,
} from '../models/event.model';
@Injectable({ providedIn: 'root' })
export class EventsService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}`;
  list(search = '') {
    let params = new HttpParams();
    if (search) params = params.set('search', search);
    return this.http.get<EventModel[]>(`${this.url}/events`, { params });
  }
  get(id: string) {
    return this.http.get<EventModel>(`${this.url}/events/${id}`);
  }
  create(data: unknown) {
    return this.http.post<EventModel>(`${this.url}/events`, data);
  }
  update(id: string, data: unknown) {
    return this.http.patch<EventModel>(`${this.url}/events/${id}`, data);
  }
  booths(eventId: string) {
    return this.http.get<Booth[]>(`${this.url}/events/${eventId}/booths`);
  }
  createBooth(eventId: string, data: unknown) {
    return this.http.post<Booth>(`${this.url}/events/${eventId}/booths`, data);
  }
  updateBooth(eventId: string, id: string, data: unknown) {
    return this.http.patch<Booth>(`${this.url}/events/${eventId}/booths/${id}`, data);
  }
  bars(eventId: string) {
    return this.http.get<Bar[]>(`${this.url}/events/${eventId}/bars`);
  }
  createBar(eventId: string, data: unknown) {
    return this.http.post<Bar>(`${this.url}/events/${eventId}/bars`, data);
  }
  updateBar(eventId: string, id: string, data: unknown) {
    return this.http.patch<Bar>(`${this.url}/events/${eventId}/bars/${id}`, data);
  }
  cupTypes() {
    return this.http.get<CupType[]>(`${this.url}/cup-types`);
  }
  createCupType(data: unknown) {
    return this.http.post<CupType>(`${this.url}/cup-types`, data);
  }
  updateCupType(id: string, data: unknown) {
    return this.http.patch<CupType>(`${this.url}/cup-types/${id}`, data);
  }
  locations(eventId: string) {
    return this.http.get<Location[]>(`${this.url}/events/${eventId}/locations`);
  }
  userCandidates(eventId: string) {
    return this.http.get<
      Array<{ id: string; name: string; email: string; active: boolean; globalRole: string }>
    >(`${this.url}/events/${eventId}/user-candidates`);
  }
  locationAssignments(eventId: string, locationId: string) {
    return this.http.get<
      Array<{
        id: string;
        userId: string;
        role: string;
        user: { id: string; name: string; email: string; globalRole: string };
      }>
    >(`${this.url}/events/${eventId}/locations/${locationId}/assignments`);
  }
  assignLocationUser(eventId: string, locationId: string, data: { userId: string; role: string }) {
    return this.http.post(
      `${this.url}/events/${eventId}/locations/${locationId}/assignments`,
      data,
    );
  }
  removeLocationUser(eventId: string, locationId: string, userId: string) {
    return this.http.delete(
      `${this.url}/events/${eventId}/locations/${locationId}/assignments/${userId}`,
    );
  }
  stock(eventId: string) {
    return this.http.get<StockResponse>(`${this.url}/events/${eventId}/stock`);
  }
  locationStock(eventId: string, locationId: string) {
    return this.http.get<{
      location: Location;
      items: import('../models/event.model').StockItem[];
    }>(`${this.url}/events/${eventId}/locations/${locationId}/stock`);
  }
  movements(eventId: string, type?: StockMovementType) {
    return this.http.get<{ items: StockMovement[]; total: number }>(
      `${this.url}/events/${eventId}/stock-movements`,
      { params: type ? { type } : {} },
    );
  }
  createMovement(eventId: string, data: unknown) {
    return this.http.post<StockMovement & { deliveryNote?: { id: string } }>(
      `${this.url}/events/${eventId}/stock-movements`,
      data,
    );
  }
  closeLocation(eventId: string, locationId: string, data: unknown) {
    return this.http.post<StockMovement & { deliveryNote?: { id: string } }>(
      `${this.url}/events/${eventId}/locations/${locationId}/close`,
      data,
    );
  }
  movement(eventId: string, id: string) {
    return this.http.get<StockMovement>(`${this.url}/events/${eventId}/stock-movements/${id}`);
  }
  deliveryNotes(eventId: string, params: Record<string, string> = {}) {
    return this.http.get<{ items: DeliveryNote[]; total: number }>(
      `${this.url}/events/${eventId}/delivery-notes`,
      { params },
    );
  }
  deliveryNote(eventId: string, id: string) {
    return this.http.get<DeliveryNote>(`${this.url}/events/${eventId}/delivery-notes/${id}`);
  }
  createDeliveryNote(eventId: string, stockMovementId: string, notes?: string) {
    return this.http.post<DeliveryNote>(`${this.url}/events/${eventId}/delivery-notes`, {
      stockMovementId,
      notes,
    });
  }
  signDeliveryNote(
    eventId: string,
    id: string,
    data: { type: string; signerName: string; file: Blob },
  ) {
    const form = new FormData();
    form.append('type', data.type);
    form.append('signerName', data.signerName);
    form.append('signature', data.file, 'signature.png');
    return this.http.post(`${this.url}/events/${eventId}/delivery-notes/${id}/signatures`, form);
  }
  downloadDeliveryNote(eventId: string, id: string) {
    return this.http.get(`${this.url}/events/${eventId}/delivery-notes/${id}/pdf`, {
      responseType: 'blob',
    });
  }
  emailDeliveryNote(
    eventId: string,
    id: string,
    data: { to: string[]; subject?: string; message?: string },
  ) {
    return this.http.post(`${this.url}/events/${eventId}/delivery-notes/${id}/email`, data);
  }
  centralWarehouse() {
    return this.http.get<CentralWarehouseOverview>(`${this.url}/warehouse/overview`);
  }
  receiveCentralStock(data: unknown) {
    return this.http.post(`${this.url}/warehouse/receipts`, data);
  }
}
