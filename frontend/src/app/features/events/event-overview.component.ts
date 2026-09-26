import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { EventDashboard } from '../../core/models/dashboard.model';
import { DashboardService } from '../../core/services/dashboard.service';

@Component({
  selector: 'app-event-overview',
  imports: [CommonModule, RouterLink, MatButtonModule, MatCardModule, MatIconModule],
  templateUrl: './event-overview.component.html',
  styleUrl: './event-overview.component.scss',
})
export class EventOverviewComponent {
  private readonly dashboard = inject(DashboardService);
  private readonly route = inject(ActivatedRoute);
  readonly data = signal<EventDashboard | null>(null);
  private readonly eventId = this.route.parent?.snapshot.paramMap.get('eventId') ?? '';
  constructor() {
    this.dashboard.event(this.eventId).subscribe((data) => this.data.set(data));
  }
}
