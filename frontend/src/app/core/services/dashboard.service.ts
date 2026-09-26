import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { DashboardGlobal, EventDashboard } from '../models/dashboard.model';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly url = environment.apiUrl;
  global() {
    return this.http.get<DashboardGlobal>(`${this.url}/dashboard`);
  }
  event(eventId: string, dateFrom?: string, dateTo?: string) {
    let params = new HttpParams();
    if (dateFrom) params = params.set('dateFrom', dateFrom);
    if (dateTo) params = params.set('dateTo', dateTo);
    return this.http.get<EventDashboard>(`${this.url}/events/${eventId}/dashboard`, { params });
  }
  downloadStockCsv(eventId: string) {
    return this.http.get(`${this.url}/events/${eventId}/reports/stock.csv`, {
      responseType: 'blob',
    });
  }
  downloadCashCsv(eventId: string) {
    return this.http.get(`${this.url}/events/${eventId}/reports/cash.csv`, {
      responseType: 'blob',
    });
  }
}
