import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { EventsService } from '../../core/services/events.service';
import { Location } from '../../core/models/event.model';

type Assignment = {
  id: string;
  userId: string;
  role: string;
  user: { id: string; name: string; email: string; globalRole: string };
};

@Component({
  selector: 'app-location-assignments',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatSelectModule,
  ],
  templateUrl: './location-assignments.component.html',
  styleUrl: './location-assignments.component.scss',
})
export class LocationAssignmentsComponent {
  private readonly api = inject(EventsService);
  private readonly route = inject(ActivatedRoute);
  private readonly eventId = this.route.parent?.snapshot.paramMap.get('eventId') ?? '';
  readonly locations = signal<Location[]>([]);
  readonly users = signal<
    Array<{ id: string; name: string; email: string; active: boolean; globalRole: string }>
  >([]);
  readonly assignments = signal<Assignment[]>([]);
  readonly error = signal('');
  locationId = '';
  userId = '';
  role = 'WORKER';
  readonly labels: Record<string, string> = {
    WORKER: 'Trabajador',
    RESPONSIBLE: 'Responsable',
    CLIENT: 'Cliente',
  };
  constructor() {
    this.api
      .locations(this.eventId)
      .subscribe((locations) =>
        this.locations.set(
          locations.filter((location) =>
            ['BAR', 'BOOTH', 'EVENT_WAREHOUSE'].includes(location.type),
          ),
        ),
      );
    this.api
      .userCandidates(this.eventId)
      .subscribe((users) =>
        this.users.set(
          users.filter((user) => ['WORKER', 'RESPONSIBLE', 'CLIENT'].includes(user.globalRole)),
        ),
      );
  }
  selectedLocation() {
    return this.locations().find((location) => location.id === this.locationId);
  }
  availableUsers() {
    const assigned = new Set(this.assignments().map((item) => item.userId));
    return this.users().filter((user) => !assigned.has(user.id) && user.globalRole === this.role);
  }
  loadAssignments() {
    this.userId = '';
    this.error.set('');
    if (this.locationId)
      this.api
        .locationAssignments(this.eventId, this.locationId)
        .subscribe({
          next: (items) => this.assignments.set(items),
          error: (err) =>
            this.error.set(err?.error?.message || 'No se pudieron cargar las asignaciones.'),
        });
  }
  assign() {
    if (!this.locationId || !this.userId) return;
    this.api
      .assignLocationUser(this.eventId, this.locationId, { userId: this.userId, role: this.role })
      .subscribe({
        next: () => this.loadAssignments(),
        error: (err) => this.error.set(err?.error?.message || 'No se pudo asignar el usuario.'),
      });
  }
  remove(userId: string) {
    this.api
      .removeLocationUser(this.eventId, this.locationId, userId)
      .subscribe({
        next: () => this.loadAssignments(),
        error: (err) => this.error.set(err?.error?.message || 'No se pudo quitar la asignación.'),
      });
  }
}
