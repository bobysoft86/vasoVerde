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
  readonly events = signal<EventModel[]>([]);
  readonly state = new OperationalState();
  readonly loading = this.state.loading;
  readonly error = this.state.readError;
  readonly showInstallHint =
    typeof window !== 'undefined' && !window.matchMedia('(display-mode: standalone)').matches;
  constructor() {
    this.state.watch(() => this.api.list(), (events) => this.events.set(events));
  }
  logout() {
    this.auth.logout().pipe(takeUntilDestroyed(this.state.destroyRef)).subscribe({
      next: () => void this.router.navigateByUrl('/login'),
      error: () => this.error.set('No se pudo cerrar la sesión.'),
    });
  }
}
