import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/services/auth.service';
import { EventsService } from '../../core/services/events.service';
import { EventModel } from '../../core/models/event.model';
import { OperationalState } from '../operations/operational-state';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { Location } from '../../core/models/event.model';

interface WorkEvent extends EventModel { workLocations: Location[] }

@Component({
  selector: 'app-portal',
  imports: [CommonModule, RouterLink, MatButtonModule, MatCardModule, MatIconModule],
  templateUrl: './portal.component.html',
  styleUrl: './portal.component.scss',
})
export class PortalComponent {
  readonly auth = inject(AuthService);
  private readonly api = inject(EventsService);
  private readonly router = inject(Router);
  readonly events = signal<WorkEvent[]>([]);
  readonly lastWork = signal<{ eventId: string; eventName: string; locationId: string; locationName: string } | null>(null);
  readonly state = new OperationalState();
  readonly loading = this.state.loading;
  readonly error = this.state.readError;
  readonly showInstallHint =
    typeof window !== 'undefined' && !window.matchMedia('(display-mode: standalone)').matches;
  constructor() {
    this.state.watch(() => this.api.list().pipe(switchMap((events) =>
      events.length ? forkJoin(events.map((event) => this.api.operationalLocations(event.id).pipe(
        map((locations) => ({ ...event, workLocations: locations.filter((item) => item.active) })),
        catchError(() => of({ ...event, workLocations: [] })),
      ))) : of([]),
    )), (events) => {
      const sorted = [...events].sort((a, b) => this.eventRank(a.status) - this.eventRank(b.status) || new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
      this.events.set(sorted);
      if (typeof localStorage !== 'undefined') {
        try {
          const saved = JSON.parse(localStorage.getItem('vv:last-work') || 'null') as { eventId?: string; locationId?: string } | null;
          const event = sorted.find((item) => item.id === saved?.eventId && this.canOperate(item.status));
          const location = event?.workLocations.find((item) => item.id === saved?.locationId);
          if (event && location) this.lastWork.set({ eventId: event.id, eventName: event.name, locationId: location.id, locationName: location.name });
        } catch { this.lastWork.set(null); }
      }
    });
  }
  eventRank(status: string) { return ({ ACTIVE: 0, PLANNED: 1, DRAFT: 2, FINISHED: 3, ARCHIVED: 4, CANCELLED: 5 } as Record<string, number>)[status] ?? 6; }
  eventStatus(status: string) { return ({ ACTIVE: 'En curso', PLANNED: 'Próximo', DRAFT: 'Borrador', FINISHED: 'Finalizado', ARCHIVED: 'Archivado', CANCELLED: 'Cancelado' } as Record<string, string>)[status] ?? status; }
  locationType(type: string) { return ({ BAR: 'Barra', BOOTH: 'Caseta', EVENT_WAREHOUSE: 'Almacén de evento' } as Record<string, string>)[type] ?? type; }
  canOperate(status: string) { return !['FINISHED', 'ARCHIVED', 'CANCELLED'].includes(status); }
  logout() {
    this.auth.logout().pipe(takeUntilDestroyed(this.state.destroyRef)).subscribe({
      next: () => void this.router.navigateByUrl('/login'),
      error: () => this.error.set('No se pudo cerrar la sesión.'),
    });
  }
}
