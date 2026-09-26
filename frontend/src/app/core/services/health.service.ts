import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { HealthStatus } from '../models/health.model';
@Injectable({ providedIn: 'root' })
export class HealthService {
  private readonly http = inject(HttpClient);
  getStatus() {
    return this.http.get<HealthStatus>(`${environment.apiUrl}/health`);
  }
}
