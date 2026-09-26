import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Location } from '../../core/models/event.model';
import { OperationalState } from './operational-state';

@Component({
  selector: 'app-operations',
  imports: [CommonModule, RouterLink, MatButtonModule, MatCardModule, MatIconModule],
  templateUrl: './operations.component.html',
  styleUrl: './operations.component.scss',
})
export class OperationsComponent {
  private readonly http = inject(HttpClient);
  readonly state = new OperationalState();
  private readonly route = inject(ActivatedRoute);
  readonly eventId = this.route.parent?.snapshot.paramMap.get('eventId') ?? '';
  readonly locations = signal<Location[]>([]);
  readonly loading = this.state.loading;
  readonly error = this.state.readError;
  readonly labels: Record<string, string> = {
    BOOTH: 'Caseta',
    BAR: 'Barra',
    EVENT_WAREHOUSE: 'Almacén del evento',
    CENTRAL_WAREHOUSE: 'Almacén central',
  };
  constructor() {
    this.state.watch(
      () => this.http.get<Location[]>(`${environment.apiUrl}/events/${this.eventId}/operational-locations`),
      (locations) => this.locations.set(locations),
    );
  }
}
