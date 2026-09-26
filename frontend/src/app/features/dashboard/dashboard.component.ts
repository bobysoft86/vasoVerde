import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { HealthService } from '../../core/services/health.service';
import { HealthStatus } from '../../core/models/health.model';
import { DashboardGlobal } from '../../core/models/dashboard.model';
import { DashboardService } from '../../core/services/dashboard.service';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, RouterLink, MatCardModule, MatIconModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  private readonly health = inject(HealthService);
  private readonly dashboard = inject(DashboardService);
  readonly apiStatus = signal('Checking…');
  readonly databaseStatus = signal('Checking…');
  readonly data = signal<DashboardGlobal | null>(null);
  readonly today = new Intl.DateTimeFormat('es-ES', { dateStyle: 'long' }).format(new Date());
  constructor() {
    this.health.getStatus().subscribe({
      next: (s: HealthStatus) => {
        this.apiStatus.set(s.status === 'ok' ? 'Connected' : 'Unavailable');
        this.databaseStatus.set(s.database === 'connected' ? 'Connected' : 'Unavailable');
      },
      error: () => {
        this.apiStatus.set('Unavailable');
        this.databaseStatus.set('Unavailable');
      },
    });
    this.dashboard.global().subscribe({ next: (data) => this.data.set(data) });
  }
}
